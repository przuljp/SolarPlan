from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    EnergySimulationNotFoundError,
    SimulationComparisonInvalidError,
    SimulationInputsIncompleteError,
)
from app.integrations.pvgis_client import (
    PvgisClient,
    PvgisEstimate,
    PvgisMonthlyEstimate,
    PvgisParameters,
    pvgis_client,
)
from app.models.energy_simulation import EnergySimulation, PvgisCacheEntry
from app.models.project import ProjectStatus
from app.repositories import (
    energy_simulation_repository,
    project_location_repository,
    roof_surface_repository,
)
from app.schemas.energy_simulation import (
    EnergySimulationComparisonItemRead,
    EnergySimulationComparisonRead,
    EnergySimulationMetricDeltasRead,
    EnergySimulationRequest,
    EnergySimulationSummaryRead,
    MonthlyEnergyComparisonRead,
)
from app.services import project_service

METHOD_VERSION = "solarplan-pvgis-v1"


def compass_to_pvgis_aspect(azimuth_deg: float) -> float:
    """Convert clockwise-from-north compass azimuth to PVGIS south-zero aspect."""

    return ((azimuth_deg - 180.0 + 180.0) % 360.0) - 180.0


def build_cache_key(parameters: PvgisParameters) -> str:
    canonical = {
        "method_version": METHOD_VERSION,
        "provider_version": settings.pvgis_version,
        "parameters": {
            key: round(value, 6) if isinstance(value, float) else value
            for key, value in parameters.query_params().items()
        },
    }
    payload = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def aggregate_monthly_results(
    surface_results: list[dict[str, Any]],
) -> list[dict[str, float | int]]:
    monthly = {month: 0.0 for month in range(1, 13)}
    for surface in surface_results:
        for item in surface["monthly_results"]:
            monthly[int(item["month"])] += float(item["energy_kwh"])
    return [{"month": month, "energy_kwh": round(monthly[month], 2)} for month in range(1, 13)]


async def _estimate_surface(
    session: AsyncSession,
    parameters: PvgisParameters,
    client: PvgisClient,
) -> PvgisEstimate:
    cache_key = build_cache_key(parameters)
    cached = await energy_simulation_repository.get_cache_entry(session, cache_key)
    if cached is not None:
        result = cached.normalized_result
        return PvgisEstimate(
            annual_kwh=float(result["annual_kwh"]),
            monthly_results=tuple(
                PvgisMonthlyEstimate(
                    month=int(item["month"]),
                    energy_kwh=float(item["energy_kwh"]),
                )
                for item in result["monthly_results"]
            ),
        )

    result = await client.calculate(parameters)
    energy_simulation_repository.add_cache_entry(
        session,
        PvgisCacheEntry(
            cache_key=cache_key,
            provider_version=settings.pvgis_version,
            method_version=METHOD_VERSION,
            request_params=parameters.query_params(),
            normalized_result=result.as_dict(),
        ),
    )
    return result


async def run_simulation(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
    data: EnergySimulationRequest,
    *,
    client: PvgisClient = pvgis_client,
) -> EnergySimulation:
    project = await project_service.get_project(session, project_id, owner_id)
    location = await project_location_repository.get_by_project_id(session, project_id)
    if location is None:
        raise SimulationInputsIncompleteError("Save a project location before analysis.")

    surfaces = await roof_surface_repository.list_by_project(session, project_id)
    if not surfaces:
        raise SimulationInputsIncompleteError("Add at least one roof surface before analysis.")
    if any(surface.panel_layout is None for surface in surfaces):
        raise SimulationInputsIncompleteError(
            "Save a panel layout for every roof surface before analysis."
        )

    layouts = [surface.panel_layout for surface in surfaces]
    if any(
        layout is None or layout.panel_count <= 0 or layout.installed_kwp <= 0
        for layout in layouts
    ) or sum(layout.installed_kwp for layout in layouts if layout is not None) <= 0:
        raise SimulationInputsIncompleteError(
            "The saved layouts must contain panels with positive installed power."
        )

    surface_results: list[dict[str, Any]] = []
    surface_snapshots: list[dict[str, Any]] = []
    for surface in surfaces:
        layout = surface.panel_layout
        if layout is None:
            raise SimulationInputsIncompleteError(
                "Save a panel layout for every roof surface before analysis."
            )
        parameters = PvgisParameters(
            lat=location.lat,
            lon=location.lon,
            peakpower=layout.installed_kwp,
            angle=surface.tilt_deg,
            aspect=compass_to_pvgis_aspect(surface.azimuth_deg),
            loss=data.system_loss_percent,
        )
        estimate = await _estimate_surface(session, parameters, client)
        monthly_results = [
            {"month": item.month, "energy_kwh": round(item.energy_kwh, 2)}
            for item in estimate.monthly_results
        ]
        surface_results.append(
            {
                "roof_surface_id": str(surface.id),
                "name": surface.name,
                "installed_kwp": round(layout.installed_kwp, 3),
                "tilt_deg": surface.tilt_deg,
                "azimuth_deg": surface.azimuth_deg,
                "pvgis_aspect": parameters.aspect,
                "annual_kwh": round(estimate.annual_kwh, 2),
                "specific_yield_kwh_per_kwp": round(estimate.annual_kwh / layout.installed_kwp, 2),
                "monthly_results": monthly_results,
            }
        )
        surface_snapshots.append(
            {
                "roof_surface_id": str(surface.id),
                "name": surface.name,
                "shape_type": surface.shape_type,
                "tilt_deg": surface.tilt_deg,
                "azimuth_deg": surface.azimuth_deg,
                "panel_count": layout.panel_count,
                "installed_kwp": layout.installed_kwp,
                "panel": {
                    "id": str(layout.solar_panel.id),
                    "manufacturer": layout.solar_panel.manufacturer,
                    "model_sku": layout.solar_panel.model_sku,
                    "power_wp": layout.solar_panel.power_wp,
                    "pvtechchoice": parameters.pvtechchoice,
                },
                "pvgis_parameters": parameters.query_params(),
            }
        )

    installed_kwp = round(
        sum(float(item["installed_kwp"]) for item in surface_results),
        3,
    )
    annual_kwh = round(sum(float(item["annual_kwh"]) for item in surface_results), 2)
    if installed_kwp <= 0:
        raise SimulationInputsIncompleteError("The saved layouts contain no installed power.")

    simulation = EnergySimulation(
        project_id=project_id,
        provider_version=settings.pvgis_version,
        method_version=METHOD_VERSION,
        system_loss_percent=data.system_loss_percent,
        installed_kwp=installed_kwp,
        annual_kwh=annual_kwh,
        specific_yield_kwh_per_kwp=round(annual_kwh / installed_kwp, 2),
        input_snapshot={
            "location": {
                "lat": location.lat,
                "lon": location.lon,
                "location_label": location.location_label,
            },
            "surfaces": surface_snapshots,
        },
        monthly_results=aggregate_monthly_results(surface_results),
        surface_results=surface_results,
    )
    energy_simulation_repository.add_simulation(session, simulation)
    project.status = ProjectStatus.ANALYZED.value
    await session.commit()
    await session.refresh(simulation)
    return simulation


async def get_latest_simulation(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> EnergySimulation:
    await project_service.get_project(session, project_id, owner_id)
    simulation = await energy_simulation_repository.get_latest(session, project_id)
    if simulation is None:
        raise EnergySimulationNotFoundError
    return simulation


def simulation_summary(simulation: EnergySimulation) -> EnergySimulationSummaryRead:
    snapshot = simulation.input_snapshot if isinstance(simulation.input_snapshot, dict) else {}
    surfaces = snapshot.get("surfaces")
    surface_snapshots = surfaces if isinstance(surfaces, list) else []
    panel_count = sum(
        int(surface.get("panel_count", 0))
        for surface in surface_snapshots
        if isinstance(surface, dict)
    )

    panel = snapshot.get("panel")
    if not isinstance(panel, dict):
        panel = next(
            (
                surface.get("panel")
                for surface in surface_snapshots
                if isinstance(surface, dict) and isinstance(surface.get("panel"), dict)
            ),
            {},
        )

    return EnergySimulationSummaryRead(
        id=simulation.id,
        project_id=simulation.project_id,
        provider_version=simulation.provider_version,
        method_version=simulation.method_version,
        source=(
            "configuration_optimizer"
            if snapshot.get("source") == "configuration_optimizer"
            else "manual_analysis"
        ),
        system_loss_percent=simulation.system_loss_percent,
        installed_kwp=simulation.installed_kwp,
        annual_kwh=simulation.annual_kwh,
        specific_yield_kwh_per_kwp=simulation.specific_yield_kwh_per_kwp,
        roof_surface_count=len(simulation.surface_results),
        panel_count=panel_count,
        panel_manufacturer=panel.get("manufacturer") if isinstance(panel, dict) else None,
        panel_model_sku=panel.get("model_sku") if isinstance(panel, dict) else None,
        created_at=simulation.created_at,
    )


async def list_simulations(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> list[EnergySimulationSummaryRead]:
    await project_service.get_project(session, project_id, owner_id)
    simulations = await energy_simulation_repository.list_by_project(session, project_id)
    return [simulation_summary(simulation) for simulation in simulations]


async def get_simulation(
    session: AsyncSession,
    project_id: UUID,
    simulation_id: UUID,
    owner_id: UUID,
) -> EnergySimulation:
    await project_service.get_project(session, project_id, owner_id)
    simulation = await energy_simulation_repository.get_by_id(
        session, project_id, simulation_id
    )
    if simulation is None:
        raise EnergySimulationNotFoundError
    return simulation


async def compare_simulations(
    session: AsyncSession,
    project_id: UUID,
    baseline_id: UUID,
    comparison_id: UUID,
    owner_id: UUID,
) -> EnergySimulationComparisonRead:
    await project_service.get_project(session, project_id, owner_id)
    if baseline_id == comparison_id:
        raise SimulationComparisonInvalidError(
            "Choose two different saved simulations to compare."
        )

    simulations = await energy_simulation_repository.get_by_ids(
        session, project_id, {baseline_id, comparison_id}
    )
    by_id = {simulation.id: simulation for simulation in simulations}
    if baseline_id not in by_id or comparison_id not in by_id:
        raise EnergySimulationNotFoundError

    baseline = by_id[baseline_id]
    comparison = by_id[comparison_id]
    baseline_summary = simulation_summary(baseline)
    comparison_summary = simulation_summary(comparison)
    baseline_months = {
        int(result["month"]): float(result["energy_kwh"])
        for result in baseline.monthly_results
    }
    comparison_months = {
        int(result["month"]): float(result["energy_kwh"])
        for result in comparison.monthly_results
    }

    return EnergySimulationComparisonRead(
        baseline=EnergySimulationComparisonItemRead(
            **baseline_summary.model_dump(), monthly_results=baseline.monthly_results
        ),
        comparison=EnergySimulationComparisonItemRead(
            **comparison_summary.model_dump(), monthly_results=comparison.monthly_results
        ),
        deltas=EnergySimulationMetricDeltasRead(
            panel_count=comparison_summary.panel_count - baseline_summary.panel_count,
            installed_kwp=comparison.installed_kwp - baseline.installed_kwp,
            annual_kwh=comparison.annual_kwh - baseline.annual_kwh,
            specific_yield_kwh_per_kwp=(
                comparison.specific_yield_kwh_per_kwp
                - baseline.specific_yield_kwh_per_kwp
            ),
            system_loss_percent=(
                comparison.system_loss_percent - baseline.system_loss_percent
            ),
        ),
        monthly_comparison=[
            MonthlyEnergyComparisonRead(
                month=month,
                baseline_kwh=baseline_months.get(month, 0),
                comparison_kwh=comparison_months.get(month, 0),
                delta_kwh=(
                    comparison_months.get(month, 0) - baseline_months.get(month, 0)
                ),
            )
            for month in range(1, 13)
        ],
    )
