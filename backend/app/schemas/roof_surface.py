from datetime import datetime
from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.panel_layout import PanelLayoutRead


class RoofSurfaceInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    name: str = Field(min_length=1, max_length=120)
    width_m: float = Field(gt=0)
    length_m: float = Field(gt=0)
    tilt_deg: float = Field(ge=0, le=90)
    azimuth_deg: float = Field(ge=0, lt=360)
    edge_margin_m: float = Field(ge=0)
    panel_gap_m: float = Field(ge=0)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return " ".join(value.split())

    @model_validator(mode="after")
    def require_usable_area(self) -> Self:
        if self.edge_margin_m * 2 >= min(self.width_m, self.length_m):
            raise ValueError("Twice the edge margin must be smaller than both surface dimensions.")
        return self


class RoofSurfaceRead(RoofSurfaceInput):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class RoofSurfaceWithLayout(RoofSurfaceRead):
    panel_layout: PanelLayoutRead | None = None
