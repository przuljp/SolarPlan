"""Create roof configurations.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "roof_configurations",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("width_m", sa.Float(), nullable=False),
        sa.Column("length_m", sa.Float(), nullable=False),
        sa.Column("tilt_deg", sa.Float(), nullable=False),
        sa.Column("azimuth_deg", sa.Float(), nullable=False),
        sa.Column("edge_margin_m", sa.Float(), nullable=False),
        sa.Column("panel_gap_m", sa.Float(), nullable=False),
        sa.Column("lat", sa.Float(), nullable=False),
        sa.Column("lon", sa.Float(), nullable=False),
        sa.Column("location_label", sa.String(length=500), nullable=True),
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
            "width_m > 0",
            name="ck_roof_configurations_width_positive",
        ),
        sa.CheckConstraint(
            "length_m > 0",
            name="ck_roof_configurations_length_positive",
        ),
        sa.CheckConstraint(
            "tilt_deg >= 0 AND tilt_deg <= 90",
            name="ck_roof_configurations_tilt_range",
        ),
        sa.CheckConstraint(
            "azimuth_deg >= 0 AND azimuth_deg < 360",
            name="ck_roof_configurations_azimuth_range",
        ),
        sa.CheckConstraint(
            "edge_margin_m >= 0",
            name="ck_roof_configurations_edge_margin_nonnegative",
        ),
        sa.CheckConstraint(
            "panel_gap_m >= 0",
            name="ck_roof_configurations_panel_gap_nonnegative",
        ),
        sa.CheckConstraint(
            "edge_margin_m * 2 < width_m AND edge_margin_m * 2 < length_m",
            name="ck_roof_configurations_usable_area",
        ),
        sa.CheckConstraint(
            "lat >= -90 AND lat <= 90",
            name="ck_roof_configurations_latitude_range",
        ),
        sa.CheckConstraint(
            "lon >= -180 AND lon <= 180",
            name="ck_roof_configurations_longitude_range",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["solar_projects.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )


def downgrade() -> None:
    op.drop_table("roof_configurations")
