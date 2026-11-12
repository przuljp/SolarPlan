"""Add roles, account/catalog activity and preserve saved layout specifications.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(5), server_default="USER", nullable=False))
    op.add_column(
        "users", sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False)
    )
    op.create_check_constraint("ck_users_role", "users", "role IN ('USER', 'ADMIN')")
    op.add_column(
        "solar_panels",
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column("panel_layouts", sa.Column("panel_snapshot", sa.JSON(), nullable=True))
    # Capture the current catalogue before any administrator can edit specifications.
    op.execute("""
        UPDATE panel_layouts AS layout
        SET panel_snapshot = row_to_json(panel)
        FROM solar_panels AS panel
        WHERE panel.id = layout.solar_panel_id
    """)
    op.alter_column("panel_layouts", "panel_snapshot", nullable=False)


def downgrade() -> None:
    op.drop_column("panel_layouts", "panel_snapshot")
    op.drop_column("solar_panels", "is_active")
    op.drop_constraint("ck_users_role", "users", type_="check")
    op.drop_column("users", "is_active")
    op.drop_column("users", "role")
