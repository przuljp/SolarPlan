from datetime import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.panel_layout import PanelLayoutRead


class RoofSurfaceInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    name: str = Field(min_length=1, max_length=120)
    shape_type: Literal["rectangle", "trapezoid"] = "rectangle"
    bottom_width_m: float = Field(gt=0)
    top_width_m: float | None = Field(default=None, gt=0)
    top_offset_m: float = Field(default=0, ge=0)
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
    def validate_geometry(self) -> Self:
        if self.shape_type == "rectangle":
            self.top_width_m = self.bottom_width_m
            self.top_offset_m = 0
        elif self.top_width_m is None:
            raise ValueError("Top width is required for a trapezoid roof surface.")
        elif self.top_width_m > self.bottom_width_m:
            raise ValueError("Top width cannot be greater than bottom width.")
        elif self.top_offset_m + self.top_width_m > self.bottom_width_m:
            raise ValueError("The shifted top edge must stay inside the bottom edge.")

        if self.top_width_m is None:
            raise ValueError("Top width could not be determined.")
        if self.edge_margin_m * 2 >= min(
            self.top_width_m, self.bottom_width_m, self.length_m
        ):
            raise ValueError("Twice the edge margin must be smaller than every surface dimension.")
        return self


class RoofSurfaceRead(RoofSurfaceInput):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    top_width_m: float
    created_at: datetime
    updated_at: datetime


class RoofSurfaceWithLayout(RoofSurfaceRead):
    panel_layout: PanelLayoutRead | None = None