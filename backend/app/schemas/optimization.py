from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import settings
from app.schemas.energy_simulation import MonthlyEnergyResult
from app.schemas.solar_panel import SolarPanelRead

OptimizationCriterion = Literal["maximum_production", "consumption_match", "manual"]


class OptimizationRequest(BaseModel):
    criterion: OptimizationCriterion
    system_loss_percent: float = Field(
        default=settings.pvgis_default_system_loss_percent, ge=0, le=100
    )
    candidate_limit: int = Field(default=3, ge=2, le=5)


class OptimizationSurfaceResult(BaseModel):
    roof_surface_id: UUID
    name: str
    orientation: Literal["portrait", "landscape"]
    panel_count: int = Field(ge=0)
    maximum_panel_count: int = Field(ge=0)
    installed_kwp: float = Field(ge=0)
    occupied_area_m2: float = Field(ge=0)
    utilization_percent: float = Field(ge=0)
    tilt_deg: float
    azimuth_deg: float
    annual_kwh: float = Field(ge=0)
    monthly_results: list[MonthlyEnergyResult]


class OptimizationCandidate(BaseModel):
    candidate_id: str
    rank: int = Field(ge=1)
    recommended: bool
    panel: SolarPanelRead
    total_panel_count: int = Field(gt=0)
    installed_kwp: float = Field(gt=0)
    occupied_area_m2: float = Field(gt=0)
    annual_kwh: float = Field(ge=0)
    specific_yield_kwh_per_kwp: float = Field(ge=0)
    target_difference_kwh: float | None = None
    target_coverage_percent: float | None = None
    monthly_results: list[MonthlyEnergyResult]
    surfaces: list[OptimizationSurfaceResult]
    explanation: str


class RejectedOptimizationCandidate(BaseModel):
    panel_id: UUID
    panel_name: str
    reason: str


class OptimizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    criterion: OptimizationCriterion
    system_loss_percent: float
    target_consumption_kwh: float | None
    input_hash: str
    candidates: list[OptimizationCandidate]
    rejected_candidates: list[RejectedOptimizationCandidate]
    selected_candidate_id: str | None
    selected_simulation_id: UUID | None
    methodology: str
    created_at: datetime


class OptimizationSelectionRequest(BaseModel):
    candidate_id: str = Field(min_length=8, max_length=64)


class OptimizationSelectionRead(BaseModel):
    optimization: OptimizationRead
    simulation_id: UUID
    applied_candidate_id: str


def serialize_json(value: Any) -> Any:
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_json(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_json(item) for key, item in value.items()}
    return value
