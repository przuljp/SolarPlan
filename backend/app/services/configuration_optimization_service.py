from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    OptimizationCandidateNotFoundError,
    OptimizationInputsIncompleteError,
    OptimizationNotFoundError,
    StaleOptimizationError,
)
from app.integrations.pvgis_client import PvgisClient, PvgisParameters, pvgis_client
from app.models.configuration_optimization import ConfigurationOptimization
from app.models.energy_simulation import EnergySimulation
from app.models.panel_layout import PanelLayout
from app.models.project import ProjectStatus
from app.repositories import (
    configuration_optimization_repository,
    consumption_repository,
    energy_simulation_repository,
    panel_layout_repository,
    project_location_repository,
    roof_surface_repository,
    solar_panel_repository,
)
from app.schemas.consumption import ConsumptionProfileRead
from app.schemas.optimization import OptimizationRead, OptimizationRequest
from app.schemas.solar_panel import SolarPanelRead
from app.services import (
    consumption_service,
    energy_simulation_service,
    layout_engine,
    project_service,
)

METHODOLOGY = "solarplan-optimizer-v1"
BEAM_WIDTH = 4000


def _monthly_scaled(monthly: list[dict[str, Any]], factor: float) -> list[dict[str, Any]]:
    return [
        {"month": int(item["month"]), "energy_kwh": round(float(item["energy_kwh"]) * factor, 2)}
        for item in monthly
    ]


def _monthly_sum(items: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    totals = {month: 0.0 for month in range(1, 13)}
    for monthly in items:
        for item in monthly:
            totals[int(item["month"])] += float(item["energy_kwh"])
    return [{"month": month, "energy_kwh": round(totals[month], 2)} for month in range(1, 13)]


def _json_hash(payload: Any) -> str:
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _panel_snapshot(panel) -> dict[str, Any]:
    return SolarPanelRead.model_validate(panel).model_dump(mode="json")


def _input_payload(location, surfaces, panels, criterion: str) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "location": [round(location.lat, 6), round(location.lon, 6)],
        "surfaces": [
            {
                "id": str(surface.id),
                "shape_type": surface.shape_type,
                "bottom_width_m": surface.bottom_width_m,
                "top_width_m": surface.top_width_m,
                "top_offset_m": surface.top_offset_m,
                "length_m": surface.length_m,
                "tilt_deg": surface.tilt_deg,
                "azimuth_deg": surface.azimuth_deg,
                "edge_margin_m": surface.edge_margin_m,
                "panel_gap_m": surface.panel_gap_m,
            }
            for surface in surfaces
        ],
        "panels": [
            [str(panel.id), panel.power_wp, panel.width_mm, panel.length_mm]
            for panel in panels
        ],
    }
    if criterion == "manual":
        payload["layouts"] = [
            [
                str(surface.id),
                str(surface.panel_layout.solar_panel_id) if surface.panel_layout else None,
                surface.panel_layout.orientation if surface.panel_layout else None,
                surface.panel_layout.panel_count if surface.panel_layout else None,
            ]
            for surface in surfaces
        ]
    return payload


def _choose_capacity_layout(surface, panel) -> dict[str, Any]:
    portrait = layout_engine.calculate_layout(surface, panel, "portrait")
    landscape = layout_engine.calculate_layout(surface, panel, "landscape")
    if landscape["maximum_panel_count"] > portrait["maximum_panel_count"]:
        return landscape
    return portrait


def _closest_consumption_counts(
    capacities: list[int], annual_per_panel: list[float], target: float
) -> list[int]:
    states: list[tuple[float, tuple[int, ...]]] = [(0.0, ())]
    for capacity, per_panel in zip(capacities, annual_per_panel, strict=True):
        expanded = [
            (energy + count * per_panel, counts + (count,))
            for energy, counts in states
            for count in range(1, capacity + 1)
        ]
        if len(expanded) > BEAM_WIDTH:
            expanded.sort(key=lambda item: (abs(item[0] - target), -item[0], item[1]))
            expanded = expanded[:BEAM_WIDTH]
        states = expanded
    if not states:
        return [0] * len(capacities)
    return list(min(states, key=lambda item: (abs(item[0] - target), -item[0], item[1]))[1])


def _candidate(
    panel,
    surfaces,
    layouts: list[dict[str, Any]],
    counts: list[int],
    yields: dict[UUID, dict[str, Any]],
    criterion: str,
    target: float | None,
) -> dict[str, Any]:
    surface_results: list[dict[str, Any]] = []
    for surface, calculated, count in zip(surfaces, layouts, counts, strict=True):
        installed_kwp = count * panel.power_wp / 1000
        monthly = _monthly_scaled(yields[surface.id]["monthly_results"], installed_kwp)
        annual = round(yields[surface.id]["annual_kwh_per_kwp"] * installed_kwp, 2)
        occupied_area = count * panel.width_mm * panel.length_mm / 1_000_000
        surface_results.append(
            {
                "roof_surface_id": str(surface.id),
                "name": surface.name,
                "orientation": calculated["orientation"],
                "panel_count": count,
                "maximum_panel_count": calculated["maximum_panel_count"],
                "installed_kwp": round(installed_kwp, 3),
                "occupied_area_m2": round(occupied_area, 3),
                "utilization_percent": round(
                    occupied_area / calculated["usable_roof_area_m2"] * 100, 1
                ),
                "tilt_deg": surface.tilt_deg,
                "azimuth_deg": surface.azimuth_deg,
                "annual_kwh": annual,
                "monthly_results": monthly,
            }
        )
    total_panels = sum(counts)
    installed_kwp = round(sum(item["installed_kwp"] for item in surface_results), 3)
    annual_kwh = round(sum(item["annual_kwh"] for item in surface_results), 2)
    monthly_results = _monthly_sum([item["monthly_results"] for item in surface_results])
    candidate_id = _json_hash(
        {
            "panel_id": str(panel.id),
            "surfaces": [
                [item["roof_surface_id"], item["orientation"], item["panel_count"]]
                for item in surface_results
            ],
        }
    )[:16]
    difference = round(abs(annual_kwh - target), 2) if target is not None else None
    coverage = round(annual_kwh / target * 100, 1) if target else None
    if criterion == "maximum_production":
        explanation = "Uses the highest feasible panel count on every roof surface."
    elif criterion == "consumption_match":
        explanation = (
            f"Estimated annual production is {difference:,.0f} kWh from the saved annual "
            "consumption."
        )
    else:
        explanation = (
            "Evaluates the panel model, orientations and counts currently saved on the roof."
        )
    return {
        "candidate_id": candidate_id,
        "rank": 1,
        "recommended": False,
        "panel": _panel_snapshot(panel),
        "total_panel_count": total_panels,
        "installed_kwp": installed_kwp,
        "occupied_area_m2": round(sum(item["occupied_area_m2"] for item in surface_results), 3),
        "annual_kwh": annual_kwh,
        "specific_yield_kwh_per_kwp": round(annual_kwh / installed_kwp, 2),
        "target_difference_kwh": difference,
        "target_coverage_percent": coverage,
        "monthly_results": monthly_results,
        "surfaces": surface_results,
        "explanation": explanation,
    }


async def _load_context(session: AsyncSession, project_id: UUID, owner_id: UUID):
    project = await project_service.get_project(session, project_id, owner_id)
    location = await project_location_repository.get_by_project_id(session, project_id)
    if location is None:
        raise OptimizationInputsIncompleteError("Save a project location before optimization.")
    surfaces = await roof_surface_repository.list_by_project(session, project_id)
    if not surfaces:
        raise OptimizationInputsIncompleteError(
            "Add at least one roof surface before optimization."
        )
    panels = await solar_panel_repository.list_all(session)
    if not panels:
        raise OptimizationInputsIncompleteError("The verified panel catalog is empty.")
    return project, location, surfaces, panels


async def _surface_yields(
    session: AsyncSession, location, surfaces, system_loss: float, client: PvgisClient
) -> dict[UUID, dict[str, Any]]:
    results: dict[UUID, dict[str, Any]] = {}
    for surface in surfaces:
        parameters = PvgisParameters(
            lat=location.lat,
            lon=location.lon,
            peakpower=1.0,
            angle=surface.tilt_deg,
            aspect=energy_simulation_service.compass_to_pvgis_aspect(surface.azimuth_deg),
            loss=system_loss,
        )
        estimate = await energy_simulation_service._estimate_surface(session, parameters, client)
        results[surface.id] = {
            "annual_kwh_per_kwp": estimate.annual_kwh,
            "monthly_results": [
                {"month": item.month, "energy_kwh": item.energy_kwh}
                for item in estimate.monthly_results
            ],
        }
    return results


async def run_optimization(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
    data: OptimizationRequest,
    *,
    client: PvgisClient = pvgis_client,
) -> ConfigurationOptimization:
    _, location, surfaces, panels = await _load_context(session, project_id, owner_id)
    target: float | None = None
    if data.criterion == "consumption_match":
        profile = await consumption_repository.get_by_project_id(session, project_id)
        if profile is None:
            raise OptimizationInputsIncompleteError(
                "Add a complete monthly or annual consumption profile before matching consumption."
            )
        profile_read: ConsumptionProfileRead = consumption_service.build_consumption_read(profile)
        target = profile_read.annual_consumption_kwh
        if target is None or target <= 0:
            raise OptimizationInputsIncompleteError(
                "A reliable annual consumption total is required for consumption matching."
            )

    yields = await _surface_yields(session, location, surfaces, data.system_loss_percent, client)
    candidates: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []
    selected_panels = panels
    if data.criterion == "manual":
        layouts = [surface.panel_layout for surface in surfaces]
        if any(layout is None or layout.panel_count <= 0 for layout in layouts):
            raise OptimizationInputsIncompleteError(
                "Save a positive panel layout for every roof surface before evaluating the "
                "manual configuration."
            )
        panel_ids = {layout.solar_panel_id for layout in layouts if layout is not None}
        if len(panel_ids) != 1:
            raise OptimizationInputsIncompleteError(
                "All roof surfaces must use one shared panel model."
            )
        selected_panels = [next(panel for panel in panels if panel.id in panel_ids)]

    for panel in selected_panels:
        if data.criterion == "manual":
            calculations = [
                layout_engine.calculate_layout(
                    surface,
                    panel,
                    surface.panel_layout.orientation,
                    surface.panel_layout.panel_count,
                )
                for surface in surfaces
            ]
            counts = [surface.panel_layout.panel_count for surface in surfaces]
        else:
            calculations = [_choose_capacity_layout(surface, panel) for surface in surfaces]
            capacities = [item["maximum_panel_count"] for item in calculations]
            if any(capacity == 0 for capacity in capacities):
                rejected.append(
                    {
                        "panel_id": str(panel.id),
                        "panel_name": f"{panel.manufacturer} {panel.model_sku}",
                        "reason": "This module does not fit on every saved roof surface.",
                    }
                )
                continue
            if data.criterion == "consumption_match":
                annual_per_panel = [
                    yields[surface.id]["annual_kwh_per_kwp"] * panel.power_wp / 1000
                    for surface in surfaces
                ]
                counts = _closest_consumption_counts(capacities, annual_per_panel, target or 0)
            else:
                counts = capacities
        candidates.append(
            _candidate(panel, surfaces, calculations, counts, yields, data.criterion, target)
        )

    if not candidates:
        raise OptimizationInputsIncompleteError(
            "None of the verified panel models fit the saved roof geometry."
        )
    if data.criterion == "consumption_match":
        candidates.sort(
            key=lambda item: (
                item["target_difference_kwh"],
                -item["annual_kwh"],
                item["panel"]["model_sku"],
            )
        )
    else:
        candidates.sort(key=lambda item: (-item["annual_kwh"], item["panel"]["model_sku"]))
    candidates = candidates[: data.candidate_limit]
    for rank, candidate in enumerate(candidates, start=1):
        candidate["rank"] = rank
        candidate["recommended"] = rank == 1

    input_hash = _json_hash(_input_payload(location, surfaces, panels, data.criterion))
    optimization = ConfigurationOptimization(
        project_id=project_id,
        criterion=data.criterion,
        system_loss_percent=data.system_loss_percent,
        target_consumption_kwh=target,
        input_hash=input_hash,
        candidates=candidates,
        rejected_candidates=rejected,
        methodology=METHODOLOGY,
    )
    configuration_optimization_repository.add(session, optimization)
    await session.commit()
    await session.refresh(optimization)
    return optimization


async def get_latest_optimization(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> ConfigurationOptimization:
    await project_service.get_project(session, project_id, owner_id)
    optimization = await configuration_optimization_repository.get_latest(session, project_id)
    if optimization is None:
        raise OptimizationNotFoundError
    return optimization


async def select_candidate(
    session: AsyncSession,
    project_id: UUID,
    optimization_id: UUID,
    owner_id: UUID,
    candidate_id: str,
) -> tuple[ConfigurationOptimization, EnergySimulation]:
    project, location, surfaces, panels = await _load_context(session, project_id, owner_id)
    optimization = await configuration_optimization_repository.get_by_id_for_project(
        session, optimization_id, project_id
    )
    if optimization is None:
        raise OptimizationNotFoundError
    current_hash = _json_hash(_input_payload(location, surfaces, panels, optimization.criterion))
    if current_hash != optimization.input_hash:
        raise StaleOptimizationError
    candidate = next(
        (item for item in optimization.candidates if item["candidate_id"] == candidate_id), None
    )
    if candidate is None:
        raise OptimizationCandidateNotFoundError
    panel = next((item for item in panels if str(item.id) == candidate["panel"]["id"]), None)
    if panel is None:
        raise StaleOptimizationError
    surfaces_by_id = {str(surface.id): surface for surface in surfaces}
    for result in candidate["surfaces"]:
        surface = surfaces_by_id.get(result["roof_surface_id"])
        if surface is None:
            raise StaleOptimizationError
        calculation = layout_engine.calculate_layout(
            surface, panel, result["orientation"], result["panel_count"]
        )
        layout = await panel_layout_repository.get_by_surface_id(session, surface.id)
        values = {
            "solar_panel_id": panel.id,
            "orientation": calculation["orientation"],
            "rows": calculation["rows"],
            "columns": calculation["columns"],
            "panel_count": calculation["panel_count"],
            "installed_kwp": calculation["installed_kwp"],
            "occupied_area_m2": calculation["occupied_area_m2"],
            "utilization_percent": calculation["utilization_percent"],
            "layout_json": calculation["positions"],
        }
        if layout is None:
            panel_layout_repository.add(
                session,
                PanelLayout(project_id=project_id, roof_surface_id=surface.id, **values),
            )
        else:
            for field, value in values.items():
                setattr(layout, field, value)

    surface_results = [
        {
            "roof_surface_id": item["roof_surface_id"],
            "name": item["name"],
            "installed_kwp": item["installed_kwp"],
            "tilt_deg": item["tilt_deg"],
            "azimuth_deg": item["azimuth_deg"],
            "pvgis_aspect": energy_simulation_service.compass_to_pvgis_aspect(
                item["azimuth_deg"]
            ),
            "annual_kwh": item["annual_kwh"],
            "specific_yield_kwh_per_kwp": round(
                item["annual_kwh"] / item["installed_kwp"], 2
            ),
            "monthly_results": item["monthly_results"],
        }
        for item in candidate["surfaces"]
        if item["panel_count"] > 0
    ]
    simulation = EnergySimulation(
        project_id=project_id,
        provider_version=settings.pvgis_version,
        method_version=METHODOLOGY,
        system_loss_percent=optimization.system_loss_percent,
        installed_kwp=candidate["installed_kwp"],
        annual_kwh=candidate["annual_kwh"],
        specific_yield_kwh_per_kwp=candidate["specific_yield_kwh_per_kwp"],
        input_snapshot={
            "source": "configuration_optimizer",
            "optimization_id": str(optimization.id),
            "candidate_id": candidate_id,
            "criterion": optimization.criterion,
            "location": {
                "lat": location.lat,
                "lon": location.lon,
                "location_label": location.location_label,
            },
            "panel": candidate["panel"],
            "surfaces": candidate["surfaces"],
        },
        monthly_results=candidate["monthly_results"],
        surface_results=surface_results,
    )
    energy_simulation_repository.add_simulation(session, simulation)
    await session.flush()
    optimization.selected_candidate_id = candidate_id
    optimization.selected_simulation_id = simulation.id
    project.status = ProjectStatus.ANALYZED.value
    await session.commit()
    await session.refresh(optimization)
    await session.refresh(simulation)
    return optimization, simulation


def optimization_read(optimization: ConfigurationOptimization) -> OptimizationRead:
    return OptimizationRead.model_validate(optimization)
