import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ExplanationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The browser sends IDs only; numerical inputs always come from the database.
    comparison_simulation_id: UUID | None = None
    include_current_consumption: bool = False


class ExplanationContent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=1000)
    production_insights: list[str] = Field(min_length=1, max_length=4)
    seasonal_insights: str = Field(min_length=1, max_length=1000)
    consumption_insights: str | None = Field(max_length=1000)
    comparison_insights: str | None = Field(max_length=1000)
    limitations: list[str] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def validate_narrative(self):
        narratives = [
            self.summary,
            *self.production_insights,
            self.seasonal_insights,
            self.consumption_insights,
            self.comparison_insights,
            *self.limitations,
        ]
        for text in narratives:
            if text is not None and (
                not text.strip() or len(text) > 1000 or re.search(r"\d", text)
            ):
                raise ValueError("Explanations must be concise qualitative text without digits.")
        return self


class ExplanationRead(BaseModel):
    simulation_id: UUID
    comparison_simulation_id: UUID | None
    consumption_included: bool
    consumption_updated_at: datetime | None
    content: ExplanationContent
    model: str
    generated_at: datetime
    cached: bool = False
    source: Literal["openai"] = "openai"


class AiStatusRead(BaseModel):
    available: bool
