from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.core.exceptions import SimulationInputsIncompleteError
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
