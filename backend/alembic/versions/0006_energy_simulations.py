"""Add PVGIS cache and immutable energy simulations.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pvgis_cache_entries",
        sa.Column("cache_key", sa.String(length=64), nullable=False),
        sa.Column("provider_version", sa.String(length=24), nullable=False),
        sa.Column("method_version", sa.String(length=40), nullable=False),
        sa.Column("request_params_json", sa.JSON(), nullable=False),
        sa.Column("normalized_result_json", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("cache_key"),
    )
    op.create_table(
        "energy_simulations",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_version", sa.String(length=24), nullable=False),
        sa.Column("method_version", sa.String(length=40), nullable=False),
        sa.Column("system_loss_percent", sa.Float(), nullable=False),
        sa.Column("installed_kwp", sa.Float(), nullable=False),
        sa.Column("annual_kwh", sa.Float(), nullable=False),
        sa.Column("specific_yield_kwh_per_kwp", sa.Float(), nullable=False),
        sa.Column("input_snapshot_json", sa.JSON(), nullable=False),
        sa.Column("monthly_results_json", sa.JSON(), nullable=False),
        sa.Column("surface_results_json", sa.JSON(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "system_loss_percent >= 0 AND system_loss_percent <= 100",
            name="ck_energy_simulations_loss_range",
        ),
        sa.CheckConstraint(
            "installed_kwp > 0",
            name="ck_energy_simulations_installed_kwp_positive",
        ),
        sa.CheckConstraint(
            "annual_kwh >= 0",
            name="ck_energy_simulations_annual_kwh_nonnegative",
        ),
        sa.CheckConstraint(
            "specific_yield_kwh_per_kwp >= 0",
            name="ck_energy_simulations_specific_yield_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["solar_projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_energy_simulations_project_created",
        "energy_simulations",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_energy_simulations_project_created",
        table_name="energy_simulations",
    )
    op.drop_table("energy_simulations")
    op.drop_table("pvgis_cache_entries")
