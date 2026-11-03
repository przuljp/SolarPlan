from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.panel_layout import PanelLayout
    from app.models.project import Project


class RoofSurfaceShape(StrEnum):
    RECTANGLE = "rectangle"
    TRAPEZOID = "trapezoid"


class RoofSurface(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One independently oriented polygonal roof plane inside a project."""

    __tablename__ = "roof_surfaces"
    __table_args__ = (
        CheckConstraint(
            "shape_type IN ('rectangle', 'trapezoid')",
            name="ck_roof_surfaces_shape_type",
        ),
        CheckConstraint(
            "bottom_width_m > 0",
            name="ck_roof_surfaces_bottom_width_positive",
        ),
        CheckConstraint("top_width_m > 0", name="ck_roof_surfaces_top_width_positive"),
        CheckConstraint("length_m > 0", name="ck_roof_surfaces_length_positive"),
        CheckConstraint("top_offset_m >= 0", name="ck_roof_surfaces_top_offset_nonnegative"),
        CheckConstraint(
            "(shape_type = 'rectangle' AND top_width_m = bottom_width_m "
            "AND top_offset_m = 0) OR "
            "(shape_type = 'trapezoid' AND top_width_m <= bottom_width_m "
            "AND top_offset_m + top_width_m <= bottom_width_m)",
            name="ck_roof_surfaces_shape_geometry",
        ),
        CheckConstraint("tilt_deg >= 0 AND tilt_deg <= 90", name="ck_roof_surfaces_tilt_range"),
        CheckConstraint(
            "azimuth_deg >= 0 AND azimuth_deg < 360", name="ck_roof_surfaces_azimuth_range"
        ),
        CheckConstraint("edge_margin_m >= 0", name="ck_roof_surfaces_edge_margin_nonnegative"),
        CheckConstraint("panel_gap_m >= 0", name="ck_roof_surfaces_panel_gap_nonnegative"),
        CheckConstraint(
            "edge_margin_m * 2 < top_width_m "
            "AND edge_margin_m * 2 < bottom_width_m "
            "AND edge_margin_m * 2 < length_m",
            name="ck_roof_surfaces_usable_area",
        ),
        Index("ix_roof_surfaces_project_id", "project_id"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    shape_type: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default=RoofSurfaceShape.RECTANGLE.value,
        server_default=RoofSurfaceShape.RECTANGLE.value,
    )
    bottom_width_m: Mapped[float] = mapped_column(Float, nullable=False)
    top_width_m: Mapped[float] = mapped_column(Float, nullable=False)
    top_offset_m: Mapped[float] = mapped_column(
        Float, nullable=False, default=0, server_default="0"
    )
    length_m: Mapped[float] = mapped_column(Float, nullable=False)
    tilt_deg: Mapped[float] = mapped_column(Float, nullable=False)
    azimuth_deg: Mapped[float] = mapped_column(Float, nullable=False)
    edge_margin_m: Mapped[float] = mapped_column(Float, nullable=False)
    panel_gap_m: Mapped[float] = mapped_column(Float, nullable=False)

    project: Mapped[Project] = relationship(back_populates="roof_surfaces")
    panel_layout: Mapped[PanelLayout | None] = relationship(
        back_populates="roof_surface",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )