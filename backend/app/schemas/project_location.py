from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.roof_configuration import normalize_location_label


class ProjectLocationUpsert(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    location_label: str | None = Field(default=None, max_length=500)

    @field_validator("location_label")
    @classmethod
    def validate_location_label(cls, value: str | None) -> str | None:
        return normalize_location_label(value)


class ProjectLocationRead(ProjectLocationUpsert):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime
