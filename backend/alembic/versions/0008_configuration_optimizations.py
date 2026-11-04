"""Store deterministic configuration optimization comparisons.

Revision ID: 0008
Revises: 0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "configuration_optimizations",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("criterion", sa.String(length=32), nullable=False),
        sa.Column("system_loss_percent", sa.Float(), nullable=False),
        sa.Column("target_consumption_kwh", sa.Float(), nullable=True),
        sa.Column("input_hash", sa.String(length=64), nullable=False),
        sa.Column("candidates", sa.JSON(), nullable=False),
        sa.Column("rejected_candidates", sa.JSON(), nullable=False),
        sa.Column("methodology", sa.String(length=80), nullable=False),
        sa.Column("selected_candidate_id", sa.String(length=64), nullable=True),
        sa.Column("selected_simulation_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "criterion IN ('maximum_production', 'consumption_match', 'manual')",
            name="ck_configuration_optimizations_criterion",
        ),
        sa.CheckConstraint(
            "system_loss_percent >= 0 AND system_loss_percent <= 100",
            name="ck_configuration_optimizations_loss_range",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["solar_projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["selected_simulation_id"], ["energy_simulations.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_configuration_optimizations_project_created",
        "configuration_optimizations",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_configuration_optimizations_project_created",
        table_name="configuration_optimizations",
    )
    op.drop_table("configuration_optimizations")
