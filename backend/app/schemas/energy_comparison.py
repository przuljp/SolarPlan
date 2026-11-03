from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class MonthlyEnergyComparison(BaseModel):
    month: int = Field(ge=1, le=12)
    production_kwh: float = Field(ge=0)
    consumption_kwh: float | None = Field(default=None, ge=0)
    balance_kwh: float | None = None
    status: Literal["surplus", "deficit", "balanced", "unavailable"]


class EnergyComparisonRead(BaseModel):
    project_id: UUID
    simulation_id: UUID
    consumption_profile_id: UUID
    annual_production_kwh: float = Field(ge=0)
    annual_consumption_kwh: float | None = Field(default=None, ge=0)
    annual_balance_kwh: float | None = None
    annual_coverage_ratio_percent: float | None = Field(default=None, ge=0)
    consumption_profile_kind: Literal[
        "annual_only", "partial_monthly", "complete_monthly"
    ]
    known_months: int = Field(ge=0, le=12)
    months_with_surplus: int = Field(ge=0, le=12)
    months_with_deficit: int = Field(ge=0, le=12)
    months_balanced: int = Field(ge=0, le=12)
    monthly_comparison: list[MonthlyEnergyComparison]
