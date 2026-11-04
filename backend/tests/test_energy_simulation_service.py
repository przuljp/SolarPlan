from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import EnergySimulationNotFoundError, SimulationInputsIncompleteError
from app.integrations.pvgis_client import PvgisParameters
from app.schemas.energy_simulation import EnergySimulationRequest
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
