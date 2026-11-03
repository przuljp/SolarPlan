from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, CheckConstraint, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project


class PvgisCacheEntry(TimestampMixin, Base):
    """Normalized PVGIS result cached by a deterministic input hash."""

    __tablename__ = "pvgis_cache_entries"

    cache_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    provider_version: Mapped[str] = mapped_column(String(24), nullable=False)
    method_version: Mapped[str] = mapped_column(String(40), nullable=False)
    request_params: Mapped[dict[str, Any]] = mapped_column(
        "request_params_json", JSON, nullable=False
    )
    normalized_result: Mapped[dict[str, Any]] = mapped_column(
        "normalized_result_json", JSON, nullable=False
    )


class EnergySimulation(UUIDPrimaryKeyMixin, Base):
    """Immutable project-level aggregation of one or more PVGIS roof estimates."""

    __tablename__ = "energy_simulations"
    __table_args__ = (
        CheckConstraint(
            "system_loss_percent >= 0 AND system_loss_percent <= 100",
            name="ck_energy_simulations_loss_range",
        ),
        CheckConstraint(
            "installed_kwp > 0",
            name="ck_energy_simulations_installed_kwp_positive",
        ),
        CheckConstraint(
            "annual_kwh >= 0",
            name="ck_energy_simulations_annual_kwh_nonnegative",
        ),
        CheckConstraint(
            "specific_yield_kwh_per_kwp >= 0",
            name="ck_energy_simulations_specific_yield_nonnegative",
        ),
        Index("ix_energy_simulations_project_created", "project_id", "created_at"),
    )

    project_id: Mapped[UUID] = mapped_column(
        ForeignKey("solar_projects.id", ondelete="CASCADE"), nullable=False
    )
    provider_version: Mapped[str] = mapped_column(String(24), nullable=False)
    method_version: Mapped[str] = mapped_column(String(40), nullable=False)
    system_loss_percent: Mapped[float] = mapped_column(Float, nullable=False)
    installed_kwp: Mapped[float] = mapped_column(Float, nullable=False)
    annual_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    specific_yield_kwh_per_kwp: Mapped[float] = mapped_column(Float, nullable=False)
    input_snapshot: Mapped[dict[str, Any]] = mapped_column(
        "input_snapshot_json", JSON, nullable=False
    )
    monthly_results: Mapped[list[dict[str, Any]]] = mapped_column(
        "monthly_results_json", JSON, nullable=False
    )
    surface_results: Mapped[list[dict[str, Any]]] = mapped_column(
        "surface_results_json", JSON, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    project: Mapped[Project] = relationship(back_populates="energy_simulations")
