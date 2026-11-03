"""Add rectangle and trapezoid roof surface geometry.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-03
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("roof_surfaces", "width_m", new_column_name="bottom_width_m")
    op.add_column(
        "roof_surfaces",
        sa.Column("shape_type", sa.String(length=16), server_default="rectangle", nullable=False),
    )
    op.add_column("roof_surfaces", sa.Column("top_width_m", sa.Float(), nullable=True))
    op.add_column(
        "roof_surfaces",
        sa.Column("top_offset_m", sa.Float(), server_default="0", nullable=False),
    )
    op.execute(sa.text("UPDATE roof_surfaces SET top_width_m = bottom_width_m"))
    op.alter_column("roof_surfaces", "top_width_m", nullable=False)
    op.alter_column("roof_surfaces", "shape_type", server_default=None)
    op.alter_column("roof_surfaces", "top_offset_m", server_default=None)

    op.drop_constraint("ck_roof_surfaces_width_positive", "roof_surfaces", type_="check")
    op.drop_constraint("ck_roof_surfaces_usable_area", "roof_surfaces", type_="check")
    op.create_check_constraint(
        "ck_roof_surfaces_shape_type",
        "roof_surfaces",
        "shape_type IN ('rectangle', 'trapezoid')",
    )
    op.create_check_constraint(
        "ck_roof_surfaces_bottom_width_positive", "roof_surfaces", "bottom_width_m > 0"
    )
    op.create_check_constraint(
        "ck_roof_surfaces_top_width_positive", "roof_surfaces", "top_width_m > 0"
    )
    op.create_check_constraint(
        "ck_roof_surfaces_top_offset_nonnegative", "roof_surfaces", "top_offset_m >= 0"
    )
    op.create_check_constraint(
        "ck_roof_surfaces_shape_geometry",
        "roof_surfaces",
        "(shape_type = 'rectangle' AND top_width_m = bottom_width_m AND top_offset_m = 0) "
        "OR (shape_type = 'trapezoid' AND top_width_m <= bottom_width_m "
        "AND top_offset_m + top_width_m <= bottom_width_m)",
    )
    op.create_check_constraint(
        "ck_roof_surfaces_usable_area",
        "roof_surfaces",
        "edge_margin_m * 2 < top_width_m "
        "AND edge_margin_m * 2 < bottom_width_m "
        "AND edge_margin_m * 2 < length_m",
    )


def downgrade() -> None:
    op.drop_constraint("ck_roof_surfaces_usable_area", "roof_surfaces", type_="check")
    op.drop_constraint("ck_roof_surfaces_shape_geometry", "roof_surfaces", type_="check")
    op.drop_constraint(
        "ck_roof_surfaces_top_offset_nonnegative", "roof_surfaces", type_="check"
    )
    op.drop_constraint("ck_roof_surfaces_top_width_positive", "roof_surfaces", type_="check")
    op.drop_constraint(
        "ck_roof_surfaces_bottom_width_positive", "roof_surfaces", type_="check"
    )
    op.drop_constraint("ck_roof_surfaces_shape_type", "roof_surfaces", type_="check")
    op.create_check_constraint(
        "ck_roof_surfaces_width_positive", "roof_surfaces", "bottom_width_m > 0"
    )
    op.create_check_constraint(
        "ck_roof_surfaces_usable_area",
        "roof_surfaces",
        "edge_margin_m * 2 < bottom_width_m AND edge_margin_m * 2 < length_m",
    )
    op.drop_column("roof_surfaces", "top_offset_m")
    op.drop_column("roof_surfaces", "top_width_m")
    op.drop_column("roof_surfaces", "shape_type")
    op.alter_column("roof_surfaces", "bottom_width_m", new_column_name="width_m")
