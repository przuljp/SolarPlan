from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class MonthlyConsumptionValue(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    month: int = Field(ge=1, le=12)
    consumption_kwh: float = Field(ge=0)


class ConsumptionProfileUpsert(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    annual_consumption_kwh: float | None = Field(default=None, ge=0)
    monthly_values: list[MonthlyConsumptionValue] = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def validate_profile_mode(self) -> "ConsumptionProfileUpsert":
        months = [item.month for item in self.monthly_values]
        if len(months) != len(set(months)):
            raise ValueError("Each calendar month can appear only once.")
        if self.annual_consumption_kwh is not None and self.monthly_values:
            raise ValueError("Provide either annual consumption or monthly values, not both.")
        if self.annual_consumption_kwh is None and not self.monthly_values:
            raise ValueError("Provide annual consumption or at least one monthly value.")
        return self


class ConsumptionProfileRead(BaseModel):
    id: UUID
    project_id: UUID
    source: Literal["manual", "bill_extracted", "estimated"]
    annual_consumption_kwh: float | None
    monthly_values: list[MonthlyConsumptionValue]
    known_months: int
    total_known_consumption_kwh: float
    average_known_monthly_kwh: float | None
    coverage_percent: float
    profile_kind: Literal["annual_only", "partial_monthly", "complete_monthly"]
    created_at: datetime
    updated_at: datetime
