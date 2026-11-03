from datetime import UTC, datetime
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.main import app
from app.schemas.consumption import ConsumptionProfileUpsert
from app.services.consumption_service import build_consumption_read


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


def test_partial_monthly_profile_reports_coverage_without_inventing_annual_total() -> None:
    result = build_consumption_read(
        profile(
            monthly_values=[
                {"month": 2, "consumption_kwh": 300},
                {"month": 1, "consumption_kwh": 500},
            ]
        )
    )

    assert [item.month for item in result.monthly_values] == [1, 2]
    assert result.total_known_consumption_kwh == 800
    assert result.average_known_monthly_kwh == 400
    assert result.known_months == 2
    assert result.coverage_percent == 16.7
    assert result.annual_consumption_kwh is None
    assert result.profile_kind == "partial_monthly"


def test_complete_monthly_and_annual_only_profiles_are_distinguished() -> None:
    complete = build_consumption_read(
        profile(
            monthly_values=[
                {"month": month, "consumption_kwh": 100} for month in range(1, 13)
            ]
        )
    )
    annual = build_consumption_read(profile(annual=4200))

    assert complete.annual_consumption_kwh == 1200
    assert complete.coverage_percent == 100
    assert complete.profile_kind == "complete_monthly"
    assert annual.annual_consumption_kwh == 4200
    assert annual.known_months == 0
    assert annual.coverage_percent == 0
    assert annual.profile_kind == "annual_only"


def test_consumption_input_rejects_duplicate_months_and_mixed_modes() -> None:
    with pytest.raises(ValidationError, match="calendar month"):
        ConsumptionProfileUpsert(
            monthly_values=[
                {"month": 1, "consumption_kwh": 100},
                {"month": 1, "consumption_kwh": 120},
            ]
        )
    with pytest.raises(ValidationError, match="either annual consumption or monthly"):
        ConsumptionProfileUpsert(
            annual_consumption_kwh=1200,
            monthly_values=[{"month": 1, "consumption_kwh": 100}],
        )


def test_consumption_routes_are_exposed_and_protected() -> None:
    operations = app.openapi()["paths"]["/api/v1/projects/{project_id}/consumption"]

    assert {"get", "put"}.issubset(operations)
    assert operations["get"]["security"] == [{"HTTPBearer": []}]
    assert operations["put"]["security"] == [{"HTTPBearer": []}]
