from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project


class ProjectLocation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One geographic calculation point shared by every roof surface in a project."""

    __tablename__ = "project_locations"
    __table_args__ = (
        CheckConstraint("lat >= -90 AND lat <= 90", name="ck_project_locations_latitude_range"),
        CheckConstraint("lon >= -180 AND lon <= 180", name="ck_project_locations_longitude_range"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    location_label: Mapped[str | None] = mapped_column(String(500), nullable=True)

    project: Mapped[Project] = relationship(back_populates="location")
