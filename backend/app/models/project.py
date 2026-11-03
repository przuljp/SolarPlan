from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.consumption_profile import ElectricityConsumptionProfile
    from app.models.energy_simulation import EnergySimulation
    from app.models.panel_layout import PanelLayout
    from app.models.project_location import ProjectLocation
    from app.models.roof_configuration import RoofConfiguration
    from app.models.roof_surface import RoofSurface
    from app.models.user import User


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    READY_FOR_ANALYSIS = "ready_for_analysis"
    ANALYZED = "analyzed"


class Project(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User-owned container for one solar planning scenario."""

    __tablename__ = "solar_projects"
    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'ready_for_analysis', 'analyzed')",
            name="ck_solar_projects_status",
        ),
        Index("ix_solar_projects_user_id", "user_id"),
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default=ProjectStatus.DRAFT.value,
        server_default=ProjectStatus.DRAFT.value,
    )

    owner: Mapped[User] = relationship(back_populates="projects")
    location: Mapped[ProjectLocation | None] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    roof_configuration: Mapped[RoofConfiguration | None] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
    roof_surfaces: Mapped[list[RoofSurface]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    panel_layouts: Mapped[list[PanelLayout]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    energy_simulations: Mapped[list[EnergySimulation]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    consumption_profile: Mapped[ElectricityConsumptionProfile | None] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )
