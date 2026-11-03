from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

from app.main import app
from app.services.energy_comparison_service import build_energy_comparison


def simulation(*, annual_kwh: float = 1800):
    return SimpleNamespace(
        id=uuid4(),
        project_id=uuid4(),
        annual_kwh=annual_kwh,
        monthly_results=[
            {"month": month, "energy_kwh": float(month * 10)}
            for month in range(1, 13)
        ],
    )


def profile(*, monthly_values: list[dict] | None = None, annual: float | None = None):
    timestamp = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        project_id=uuid4(),
        source="manual",
        annual_consumption_kwh=annual,
        monthly_values=monthly_values or [],
        created_at=timestamp,
        updated_at=timestamp,
    )


def test_complete_profile_calculates_monthly_balance_and_annual_coverage() -> None:
    result = build_energy_comparison(
        simulation(annual_kwh=1800),
        profile(
            monthly_values=[
                {"month": month, "consumption_kwh": 100.0}
                for month in range(1, 13)
            ]
        ),
    )

    assert result.annual_consumption_kwh == 1200
    assert result.annual_balance_kwh == 600
    assert result.annual_coverage_ratio_percent == 150
    assert result.monthly_comparison[0].balance_kwh == -90
    assert result.monthly_comparison[-1].balance_kwh == 20
    assert result.months_with_deficit == 9
    assert result.months_balanced == 1
    assert result.months_with_surplus == 2


def test_partial_profile_does_not_invent_annual_or_missing_months() -> None:
    result = build_energy_comparison(
        simulation(),
        profile(monthly_values=[{"month": 2, "consumption_kwh": 25.0}]),
    )

    assert result.annual_consumption_kwh is None
    assert result.annual_balance_kwh is None
    assert result.annual_coverage_ratio_percent is None
    assert result.known_months == 1
    assert result.monthly_comparison[0].status == "unavailable"
    assert result.monthly_comparison[0].consumption_kwh is None
    assert result.monthly_comparison[1].balance_kwh == -5


def test_zero_annual_consumption_has_balance_but_no_ratio() -> None:
    result = build_energy_comparison(simulation(annual_kwh=900), profile(annual=0))

    assert result.annual_balance_kwh == 900
    assert result.annual_coverage_ratio_percent is None
    assert all(item.status == "unavailable" for item in result.monthly_comparison)


def test_energy_comparison_route_is_exposed_and_protected() -> None:
    operation = app.openapi()["paths"][
        "/api/v1/projects/{project_id}/energy-comparison"
    ]["get"]

    assert operation["security"] == [{"HTTPBearer": []}]
