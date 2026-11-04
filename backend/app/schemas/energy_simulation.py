from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings


class EnergySimulationRequest(BaseModel):
    system_loss_percent: float = Field(
        default=settings.pvgis_default_system_loss_percent, ge=0, le=100
    )


class MonthlyEnergyResult(BaseModel):
    month: int = Field(ge=1, le=12)
    energy_kwh: float = Field(ge=0)


class SurfaceEnergyResult(BaseModel):
    roof_surface_id: UUID
    name: str
    installed_kwp: float = Field(gt=0)
    tilt_deg: float
    azimuth_deg: float
    pvgis_aspect: float
    annual_kwh: float = Field(ge=0)
    specific_yield_kwh_per_kwp: float = Field(ge=0)
    monthly_results: list[MonthlyEnergyResult]


class EnergySimulationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    provider_version: str
    method_version: str
    system_loss_percent: float
    installed_kwp: float
    annual_kwh: float
    specific_yield_kwh_per_kwp: float
    input_snapshot: dict[str, Any]
    monthly_results: list[MonthlyEnergyResult]
    surface_results: list[SurfaceEnergyResult]
    created_at: datetime


class EnergySimulationSummaryRead(BaseModel):
    id: UUID
    project_id: UUID
    provider_version: str
    method_version: str
    source: Literal["manual_analysis", "configuration_optimizer"]
    system_loss_percent: float
    installed_kwp: float
    annual_kwh: float
    specific_yield_kwh_per_kwp: float
    roof_surface_count: int = Field(ge=0)
    panel_count: int = Field(ge=0)
    panel_manufacturer: str | None
    panel_model_sku: str | None
    created_at: datetime
