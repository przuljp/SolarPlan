from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def normalize_location_label(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = " ".join(value.split())
    return normalized or None


class RoofConfigurationUpsert(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    width_m: float = Field(gt=0)
    length_m: float = Field(gt=0)
    tilt_deg: float = Field(ge=0, le=90)
    azimuth_deg: float = Field(ge=0, lt=360)
    edge_margin_m: float = Field(ge=0)
    panel_gap_m: float = Field(ge=0)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    location_label: str | None = Field(default=None, max_length=500)

    @field_validator("location_label")
    @classmethod
    def validate_location_label(cls, value: str | None) -> str | None:
        return normalize_location_label(value)

    @model_validator(mode="after")
    def require_usable_roof_area(self) -> Self:
        if self.edge_margin_m * 2 >= min(self.width_m, self.length_m):
            raise ValueError("Twice the edge margin must be smaller than both roof dimensions.")
        return self


class RoofConfigurationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    width_m: float
    length_m: float
    tilt_deg: float
    azimuth_deg: float
    edge_margin_m: float
    panel_gap_m: float
    lat: float
    lon: float
    location_label: str | None
    created_at: datetime
    updated_at: datetime
