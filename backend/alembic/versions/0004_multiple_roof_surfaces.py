"""Split project location from multiple roof surfaces.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-02
"""

from collections.abc import Sequence
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE solar_panels SET bih_source_url = :url WHERE id = :id").bindparams(
            url="https://energoshop.ba/product/trinasolar-half-cell-tsm-460neg9r-28-460w-1762x1134x30-mm/",
            id=UUID("10000000-0000-4000-8000-000000000004"),
        )
    )
    op.execute(
        sa.text("UPDATE solar_panels SET bih_source_url = :url WHERE id = :id").bindparams(
            url="https://energoshop.ba/product/fuji-solar-fj550m-144m10-550w/",
            id=UUID("10000000-0000-4000-8000-000000000005"),
        )
    )

    op.create_table(
        "project_locations",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
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
        sa.CheckConstraint("lat >= -90 AND lat <= 90", name="ck_project_locations_latitude_range"),
        sa.CheckConstraint(
            "lon >= -180 AND lon <= 180", name="ck_project_locations_longitude_range"
        ),
        sa.ForeignKeyConstraint(["project_id"], ["solar_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )
    op.create_table(
        "roof_surfaces",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("width_m", sa.Float(), nullable=False),
        sa.Column("length_m", sa.Float(), nullable=False),
        sa.Column("tilt_deg", sa.Float(), nullable=False),
        sa.Column("azimuth_deg", sa.Float(), nullable=False),
        sa.Column("edge_margin_m", sa.Float(), nullable=False),
        sa.Column("panel_gap_m", sa.Float(), nullable=False),
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
        sa.CheckConstraint("width_m > 0", name="ck_roof_surfaces_width_positive"),
        sa.CheckConstraint("length_m > 0", name="ck_roof_surfaces_length_positive"),
        sa.CheckConstraint("tilt_deg >= 0 AND tilt_deg <= 90", name="ck_roof_surfaces_tilt_range"),
        sa.CheckConstraint(
            "azimuth_deg >= 0 AND azimuth_deg < 360", name="ck_roof_surfaces_azimuth_range"
        ),
        sa.CheckConstraint("edge_margin_m >= 0", name="ck_roof_surfaces_edge_margin_nonnegative"),
        sa.CheckConstraint("panel_gap_m >= 0", name="ck_roof_surfaces_panel_gap_nonnegative"),
        sa.CheckConstraint(
            "edge_margin_m * 2 < width_m AND edge_margin_m * 2 < length_m",
            name="ck_roof_surfaces_usable_area",
        ),
        sa.ForeignKeyConstraint(["project_id"], ["solar_projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_roof_surfaces_project_id", "roof_surfaces", ["project_id"])

    op.execute(
        sa.text("""
        INSERT INTO project_locations (
            id, project_id, lat, lon, location_label, created_at, updated_at
        )
        SELECT project_id, project_id, lat, lon, location_label, created_at, updated_at
        FROM roof_configurations
    """)
    )
    op.execute(
        sa.text("""
        INSERT INTO roof_surfaces (
            id, project_id, name, width_m, length_m, tilt_deg, azimuth_deg,
            edge_margin_m, panel_gap_m, created_at, updated_at
        )
        SELECT id, project_id, 'Main roof', width_m, length_m, tilt_deg, azimuth_deg,
               edge_margin_m, panel_gap_m, created_at, updated_at
        FROM roof_configurations
    """)
    )

    op.add_column(
        "panel_layouts", sa.Column("roof_surface_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.execute(
        sa.text("""
        UPDATE panel_layouts
        SET roof_surface_id = roof_surfaces.id
        FROM roof_surfaces
        WHERE panel_layouts.project_id = roof_surfaces.project_id
    """)
    )
    op.alter_column("panel_layouts", "roof_surface_id", nullable=False)
    op.drop_constraint("panel_layouts_project_id_key", "panel_layouts", type_="unique")
    op.create_foreign_key(
        "fk_panel_layouts_roof_surface_id",
        "panel_layouts",
        "roof_surfaces",
        ["roof_surface_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_unique_constraint(
        "uq_panel_layouts_roof_surface_id", "panel_layouts", ["roof_surface_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_panel_layouts_roof_surface_id", "panel_layouts", type_="unique")
    op.drop_constraint("fk_panel_layouts_roof_surface_id", "panel_layouts", type_="foreignkey")
    op.drop_column("panel_layouts", "roof_surface_id")
    op.create_unique_constraint("panel_layouts_project_id_key", "panel_layouts", ["project_id"])
    op.drop_index("ix_roof_surfaces_project_id", table_name="roof_surfaces")
    op.drop_table("roof_surfaces")
    op.drop_table("project_locations")
