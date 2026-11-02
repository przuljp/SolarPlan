from pydantic import BaseModel, Field


class GeocodingResult(BaseModel):
    """Provider-independent location returned to the SolarPlan frontend."""

    display_name: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    category: str | None = None
    type: str | None = None
