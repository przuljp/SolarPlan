from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.energy_simulation import EnergySimulation
    from app.models.project import Project


class ConfigurationOptimization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Saved deterministic ranking of feasible project configurations."""

    __tablename__ = "configuration_optimizations"
    __table_args__ = (
        CheckConstraint(
            "criterion IN ('maximum_production', 'consumption_match', 'manual')",
            name="ck_configuration_optimizations_criterion",
        ),
        CheckConstraint(
            "system_loss_percent >= 0 AND system_loss_percent <= 100",
            name="ck_configuration_optimizations_loss_range",
        ),
        Index("ix_configuration_optimizations_project_created", "project_id", "created_at"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"), nullable=False
    )
    criterion: Mapped[str] = mapped_column(String(32), nullable=False)
    system_loss_percent: Mapped[float] = mapped_column(Float, nullable=False)
    target_consumption_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    candidates: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    rejected_candidates: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    methodology: Mapped[str] = mapped_column(String(80), nullable=False)
    selected_candidate_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    selected_simulation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("energy_simulations.id", ondelete="SET NULL"), nullable=True
    )

    project: Mapped[Project] = relationship()
    selected_simulation: Mapped[EnergySimulation | None] = relationship()
