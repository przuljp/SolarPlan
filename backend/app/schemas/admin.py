from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from app.schemas.user import UserRead


class ActivityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    is_active: bool


class PanelInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True, allow_inf_nan=False)

    manufacturer: str = Field(min_length=1, max_length=100)
    model_sku: str = Field(min_length=1, max_length=160)
    category: Literal["compact", "standard", "high-power"]
    power_wp: int = Field(gt=0, le=10000)
    width_mm: int = Field(gt=0, le=10000)
    length_mm: int = Field(gt=0, le=10000)
    thickness_mm: int = Field(gt=0, le=1000)
    efficiency_percent: float = Field(gt=0, le=100)
    cell_technology: str = Field(min_length=1, max_length=180)
    temperature_coefficient_pmax: float = Field(ge=-1, le=0)
    datasheet_url: HttpUrl
    bih_source_name: str = Field(min_length=1, max_length=160)
    bih_source_url: HttpUrl
    verified_at: date

    @field_validator("verified_at")
    @classmethod
    def no_future_verification(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("Verification date cannot be in the future.")
        return value


class AdminUserRead(UserRead):
    project_count: int


class AdminUsersPage(BaseModel):
    items: list[AdminUserRead]
    total: int
    offset: int
    limit: int


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_projects: int
    panel_models: int
