from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.exceptions import (
    EnergySimulationNotFoundError,
    SimulationComparisonInvalidError,
    SimulationInputsIncompleteError,
)
from app.integrations.pvgis_client import (
    PvgisEstimate,
    PvgisMonthlyEstimate,
    PvgisParameters,
)
from app.schemas.energy_simulation import EnergySimulationRequest
from app.schemas.optimization import OptimizationRequest
from app.services import energy_simulation_service
from app.services.energy_simulation_service import (
    aggregate_monthly_results,
    build_cache_key,
    compass_to_pvgis_aspect,
)


@pytest.mark.parametrize(
    ("compass", "pvgis"),
    [
        (0, -180),
        (90, -90),
        (180, 0),
        (270, 90),
        (359, 179),
    ],
)
def test_compass_azimuth_conversion(compass: float, pvgis: float) -> None:
    assert compass_to_pvgis_aspect(compass) == pytest.approx(pvgis)


def test_cache_key_is_stable_and_changes_with_inputs() -> None:
    original = PvgisParameters(43.8563, 18.4131, 4.35, 30, 0, 14)
    same = PvgisParameters(43.8563, 18.4131, 4.35, 30, 0, 14)
    changed = PvgisParameters(43.8563, 18.4131, 4.35, 35, 0, 14)

    assert build_cache_key(original) == build_cache_key(same)
    assert build_cache_key(original) != build_cache_key(changed)
    assert len(build_cache_key(original)) == 64


def test_monthly_results_are_aggregated_across_roof_surfaces() -> None:
    surfaces = [
        {
            "monthly_results": [
                {"month": month, "energy_kwh": float(month)} for month in range(1, 13)
            ]
        },
        {
            "monthly_results": [
                {"month": month, "energy_kwh": float(month * 2)} for month in range(1, 13)
            ]
        },
    ]

    result = aggregate_monthly_results(surfaces)

    assert result[0] == {"month": 1, "energy_kwh": 3.0}
    assert result[-1] == {"month": 12, "energy_kwh": 36.0}


def test_system_loss_requests_default_to_fourteen_percent() -> None:
    assert EnergySimulationRequest().system_loss_percent == 14
    assert (
        OptimizationRequest(criterion="maximum_production").system_loss_percent == 14
    )


@pytest.mark.parametrize("loss", [-0.1, 30.1])
def test_system_loss_requests_reject_values_outside_supported_range(loss: float) -> None:
    with pytest.raises(ValidationError):
        EnergySimulationRequest(system_loss_percent=loss)
    with pytest.raises(ValidationError):
        OptimizationRequest(
            criterion="maximum_production", system_loss_percent=loss
        )


@pytest.mark.asyncio
async def test_custom_system_loss_is_forwarded_once_to_pvgis(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock()
    client = AsyncMock()
    project = SimpleNamespace(status="draft")
    panel = SimpleNamespace(
        id=uuid4(), manufacturer="LONGi", model_sku="435M", power_wp=435
    )
    layout = SimpleNamespace(
        panel_count=10, installed_kwp=4.35, solar_panel=panel
    )
    surface = SimpleNamespace(
        id=uuid4(),
        name="South roof",
        shape_type="rectangle",
        tilt_deg=30,
        azimuth_deg=180,
        panel_layout=layout,
    )
    location = SimpleNamespace(
        lat=43.8563, lon=18.4131, location_label="Sarajevo"
    )
    estimate = PvgisEstimate(
        annual_kwh=5000,
        monthly_results=tuple(
            PvgisMonthlyEstimate(month=month, energy_kwh=400)
            for month in range(1, 13)
        ),
    )
    client.calculate.return_value = estimate
    monkeypatch.setattr(
        energy_simulation_service.project_service,
        "get_project",
        AsyncMock(return_value=project),
    )
    monkeypatch.setattr(
        energy_simulation_service.project_location_repository,
        "get_by_project_id",
        AsyncMock(return_value=location),
    )
    monkeypatch.setattr(
        energy_simulation_service.roof_surface_repository,
        "list_by_project",
        AsyncMock(return_value=[surface]),
    )
    monkeypatch.setattr(
        energy_simulation_service.energy_simulation_repository,
        "get_cache_entry",
        AsyncMock(return_value=None),
    )
    monkeypatch.setattr(
        energy_simulation_service.energy_simulation_repository,
        "add_cache_entry",
        lambda session, entry: None,
    )
    captured = []
    monkeypatch.setattr(
        energy_simulation_service.energy_simulation_repository,
        "add_simulation",
        lambda session, simulation: captured.append(simulation),
    )

    result = await energy_simulation_service.run_simulation(
        session,
        uuid4(),
        uuid4(),
        EnergySimulationRequest(system_loss_percent=9.5),
        client=client,
    )

    parameters = client.calculate.await_args.args[0]
    assert parameters.loss == 9.5
    assert result.system_loss_percent == 9.5
    assert result.annual_kwh == 5000
    assert captured == [result]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("panel_count", "installed_kwp"),
    [(0, 0.0), (0, 1.0), (1, 0.0)],
)
async def test_zero_power_or_panel_layout_is_rejected_before_pvgis_call(
    monkeypatch: pytest.MonkeyPatch,
    panel_count: int,
    installed_kwp: float,
) -> None:
    session = AsyncMock()
    client = AsyncMock()
    project = SimpleNamespace(status="draft")
    location = SimpleNamespace(lat=43.8563, lon=18.4131)
    surface = SimpleNamespace(
        panel_layout=SimpleNamespace(
            panel_count=panel_count,
            installed_kwp=installed_kwp,
        )
    )
    monkeypatch.setattr(
        energy_simulation_service.project_service,
        "get_project",
        AsyncMock(return_value=project),
    )
    monkeypatch.setattr(
        energy_simulation_service.project_location_repository,
        "get_by_project_id",
        AsyncMock(return_value=location),
    )
    monkeypatch.setattr(
        energy_simulation_service.roof_surface_repository,
        "list_by_project",
        AsyncMock(return_value=[surface]),
    )

    with pytest.raises(
        SimulationInputsIncompleteError,
        match="positive installed power",
    ):
        await energy_simulation_service.run_simulation(
            session,
            uuid4(),
            uuid4(),
            EnergySimulationRequest(),
            client=client,
        )

    client.calculate.assert_not_awaited()
    session.commit.assert_not_awaited()


def test_simulation_summary_reads_manual_snapshot() -> None:
    simulation = SimpleNamespace(
        id=uuid4(),
        project_id=uuid4(),
        provider_version="5.3",
        method_version="solarplan-pvgis-v1",
        system_loss_percent=14,
        installed_kwp=5.22,
        annual_kwh=6450,
        specific_yield_kwh_per_kwp=1235.6,
        input_snapshot={
            "surfaces": [
                {
                    "panel_count": 12,
                    "panel": {"manufacturer": "LONGi", "model_sku": "LR5-54HTH-435M"},
                }
            ]
        },
        surface_results=[{"name": "South roof"}],
        created_at="2026-11-04T10:00:00Z",
    )

    summary = energy_simulation_service.simulation_summary(simulation)

    assert summary.source == "manual_analysis"
    assert summary.panel_count == 12
    assert summary.roof_surface_count == 1
    assert summary.panel_manufacturer == "LONGi"
    assert summary.panel_model_sku == "LR5-54HTH-435M"


def test_simulation_summary_reads_optimizer_snapshot() -> None:
    simulation = SimpleNamespace(
        id=uuid4(),
        project_id=uuid4(),
        provider_version="5.3",
        method_version="solarplan-optimizer-v1",
        system_loss_percent=14,
        installed_kwp=4.2,
        annual_kwh=5026,
        specific_yield_kwh_per_kwp=1196.67,
        input_snapshot={
            "source": "configuration_optimizer",
            "panel": {"manufacturer": "Hanersun", "model_sku": "HN21N-66HT700W"},
            "surfaces": [{"panel_count": 6}],
        },
        surface_results=[{"name": "South roof"}],
        created_at="2026-11-04T10:00:00Z",
    )

    summary = energy_simulation_service.simulation_summary(simulation)

    assert summary.source == "configuration_optimizer"
    assert summary.panel_count == 6
    assert summary.panel_manufacturer == "Hanersun"


@pytest.mark.asyncio
async def test_get_simulation_rejects_unknown_simulation(monkeypatch: pytest.MonkeyPatch) -> None:
    session = AsyncMock()
    project_id = uuid4()
    owner_id = uuid4()
    simulation_id = uuid4()
    get_project = AsyncMock(return_value=SimpleNamespace(id=project_id))
    monkeypatch.setattr(energy_simulation_service.project_service, "get_project", get_project)
    monkeypatch.setattr(
        energy_simulation_service.energy_simulation_repository,
        "get_by_id",
        AsyncMock(return_value=None),
    )

    with pytest.raises(EnergySimulationNotFoundError):
        await energy_simulation_service.get_simulation(
            session, project_id, simulation_id, owner_id
        )

    get_project.assert_awaited_once_with(session, project_id, owner_id)


@pytest.mark.asyncio
async def test_compare_simulations_calculates_project_level_deltas(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = AsyncMock()
    project_id = uuid4()
    owner_id = uuid4()
    baseline_id = uuid4()
    comparison_id = uuid4()

    def simulation(simulation_id, panel_count, kwp, annual, loss, monthly):
        return SimpleNamespace(
            id=simulation_id,
            project_id=project_id,
            provider_version="5.3",
            method_version="solarplan-pvgis-v1",
            system_loss_percent=loss,
            installed_kwp=kwp,
            annual_kwh=annual,
            specific_yield_kwh_per_kwp=annual / kwp,
            input_snapshot={
                "surfaces": [
                    {
                        "panel_count": panel_count,
                        "panel": {"manufacturer": "LONGi", "model_sku": "435M"},
                    }
                ]
            },
            monthly_results=[
                {"month": month, "energy_kwh": monthly + month} for month in range(1, 13)
            ],
            surface_results=[{"name": "Roof"}],
            created_at="2026-11-04T10:00:00Z",
        )

    baseline = simulation(baseline_id, 10, 4.35, 5200, 14, 300)
    comparison = simulation(comparison_id, 12, 5.22, 6500, 12, 400)
    monkeypatch.setattr(
        energy_simulation_service.project_service,
        "get_project",
        AsyncMock(return_value=SimpleNamespace(id=project_id)),
    )
    get_by_ids = AsyncMock(return_value=[comparison, baseline])
    monkeypatch.setattr(
        energy_simulation_service.energy_simulation_repository,
        "get_by_ids",
        get_by_ids,
    )

    result = await energy_simulation_service.compare_simulations(
        session, project_id, baseline_id, comparison_id, owner_id
    )

    assert result.baseline.id == baseline_id
    assert result.comparison.id == comparison_id
    assert result.deltas.panel_count == 2
    assert result.deltas.installed_kwp == pytest.approx(0.87)
    assert result.deltas.annual_kwh == pytest.approx(1300)
    assert result.deltas.system_loss_percent == pytest.approx(-2)
    assert result.monthly_comparison[0].delta_kwh == pytest.approx(100)
    assert len(result.monthly_comparison) == 12
    get_by_ids.assert_awaited_once_with(
        session, project_id, {baseline_id, comparison_id}
    )


@pytest.mark.asyncio
async def test_compare_simulations_requires_two_distinct_snapshots(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    simulation_id = uuid4()
    monkeypatch.setattr(
        energy_simulation_service.project_service,
        "get_project",
        AsyncMock(return_value=SimpleNamespace(id=uuid4())),
    )

    with pytest.raises(SimulationComparisonInvalidError):
        await energy_simulation_service.compare_simulations(
            AsyncMock(), uuid4(), simulation_id, simulation_id, uuid4()
        )
