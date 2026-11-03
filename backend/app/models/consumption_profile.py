from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project


class ElectricityConsumptionProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One manually maintained household-consumption profile per project."""

    __tablename__ = "electricity_consumption_profiles"
    __table_args__ = (
        CheckConstraint(
            "source IN ('manual', 'bill_extracted', 'estimated')",
            name="ck_consumption_profiles_source",
        ),
        CheckConstraint(
            "annual_consumption_kwh IS NULL OR annual_consumption_kwh >= 0",
            name="ck_consumption_profiles_annual_nonnegative",
        ),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    source: Mapped[str] = mapped_column(String(24), nullable=False, default="manual")
    annual_consumption_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    monthly_values: Mapped[list[dict[str, Any]]] = mapped_column(
        "monthly_values_json", JSON, nullable=False, default=list
    )

    project: Mapped[Project] = relationship(back_populates="consumption_profile")
