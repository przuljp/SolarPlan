from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.roof_surface import RoofSurface
    from app.models.solar_panel import SolarPanel


class PanelLayout(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Saved module choice and rectangular placement for a project roof."""

    __tablename__ = "panel_layouts"
    __table_args__ = (
        CheckConstraint(
            "orientation IN ('portrait', 'landscape')",
            name="ck_panel_layouts_orientation",
        ),
        CheckConstraint(
            "rows >= 0 AND columns >= 0",
            name="ck_panel_layouts_grid_nonnegative",
        ),
        CheckConstraint("panel_count >= 0", name="ck_panel_layouts_count_nonnegative"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"), nullable=False
    )
    roof_surface_id: Mapped[UUID] = mapped_column(
        ForeignKey("roof_surfaces.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    solar_panel_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_panels.id", ondelete="RESTRICT"), nullable=False
    )
    orientation: Mapped[str] = mapped_column(String(16), nullable=False)
    rows: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[int] = mapped_column(Integer, nullable=False)
    panel_count: Mapped[int] = mapped_column(Integer, nullable=False)
    installed_kwp: Mapped[float] = mapped_column(Float, nullable=False)
    occupied_area_m2: Mapped[float] = mapped_column(Float, nullable=False)
    utilization_percent: Mapped[float] = mapped_column(Float, nullable=False)
    layout_json: Mapped[list[dict[str, float | int]]] = mapped_column(JSON, nullable=False)

    project: Mapped[Project] = relationship(back_populates="panel_layouts")
    roof_surface: Mapped[RoofSurface] = relationship(back_populates="panel_layout")
    solar_panel: Mapped[SolarPanel] = relationship()
