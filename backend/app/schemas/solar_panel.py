from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class SolarPanelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    manufacturer: str
    model_sku: str
    category: str
    power_wp: int
    width_mm: int
    length_mm: int
    thickness_mm: int
    efficiency_percent: float
    cell_technology: str
    temperature_coefficient_pmax: float
    datasheet_url: str
    bih_source_name: str
    bih_source_url: str
    verified_at: date
    created_at: datetime
    updated_at: datetime
