"""Add project electricity-consumption profiles.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "electricity_consumption_profiles",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("annual_consumption_kwh", sa.Float(), nullable=True),
        sa.Column("monthly_values_json", sa.JSON(), nullable=False),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.CheckConstraint(
            "source IN ('manual', 'bill_extracted', 'estimated')",
            name="ck_consumption_profiles_source",
        ),
        sa.CheckConstraint(
            "annual_consumption_kwh IS NULL OR annual_consumption_kwh >= 0",
            name="ck_consumption_profiles_annual_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["solar_projects.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )


def downgrade() -> None:
    op.drop_table("electricity_consumption_profiles")
