from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.solar_panel import SolarPanelRead


class LayoutRequest(BaseModel):
    solar_panel_id: UUID
    orientation: Literal["portrait", "landscape"] = "portrait"
    panel_count: int | None = Field(default=None, ge=0)


class PanelPosition(BaseModel):
    index: int
    row: int
    column: int
    x_m: float
    y_m: float
    width_m: float
    length_m: float


class LayoutPreview(BaseModel):
    solar_panel: SolarPanelRead
    orientation: Literal["portrait", "landscape"]
    rows: int
    columns: int
    maximum_panel_count: int
    panel_count: int
    installed_kwp: float
    occupied_area_m2: float
    usable_roof_area_m2: float
    utilization_percent: float
    panel_width_m: float
    panel_length_m: float
    roof_width_m: float
    roof_length_m: float
    edge_margin_m: float
    panel_gap_m: float
    positions: list[PanelPosition]


class PanelLayoutRead(LayoutPreview):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    roof_surface_id: UUID
    solar_panel_id: UUID
    created_at: datetime
    updated_at: datetime
