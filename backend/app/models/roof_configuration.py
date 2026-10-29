from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project


class RoofConfiguration(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Location and usable rectangular roof plane for one project."""

    __tablename__ = "roof_configurations"
    __table_args__ = (
        CheckConstraint("width_m > 0", name="ck_roof_configurations_width_positive"),
        CheckConstraint("length_m > 0", name="ck_roof_configurations_length_positive"),
        CheckConstraint(
            "tilt_deg >= 0 AND tilt_deg <= 90",
            name="ck_roof_configurations_tilt_range",
        ),
        CheckConstraint(
            "azimuth_deg >= 0 AND azimuth_deg < 360",
            name="ck_roof_configurations_azimuth_range",
        ),
        CheckConstraint(
            "edge_margin_m >= 0",
            name="ck_roof_configurations_edge_margin_nonnegative",
        ),
        CheckConstraint(
            "panel_gap_m >= 0",
            name="ck_roof_configurations_panel_gap_nonnegative",
        ),
        CheckConstraint(
            "edge_margin_m * 2 < width_m AND edge_margin_m * 2 < length_m",
            name="ck_roof_configurations_usable_area",
        ),
        CheckConstraint(
            "lat >= -90 AND lat <= 90",
            name="ck_roof_configurations_latitude_range",
        ),
        CheckConstraint(
            "lon >= -180 AND lon <= 180",
            name="ck_roof_configurations_longitude_range",
        ),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    width_m: Mapped[float] = mapped_column(Float, nullable=False)
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    tilt_deg: Mapped[float] = mapped_column(Float, nullable=False)
    azimuth_deg: Mapped[float] = mapped_column(Float, nullable=False)
    edge_margin_m: Mapped[float] = mapped_column(Float, nullable=False)
    panel_gap_m: Mapped[float] = mapped_column(Float, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    location_label: Mapped[str | None] = mapped_column(String(500), nullable=True)

    project: Mapped[Project] = relationship(back_populates="roof_configuration")
