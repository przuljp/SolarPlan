"""Create the verified panel catalog and saved layouts.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-02
"""

from collections.abc import Sequence
from datetime import date
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    panels = op.create_table(
        "solar_panels",
        sa.Column("manufacturer", sa.String(length=100), nullable=False),
        sa.Column("model_sku", sa.String(length=160), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("power_wp", sa.Integer(), nullable=False),
        sa.Column("width_mm", sa.Integer(), nullable=False),
        sa.Column("length_mm", sa.Integer(), nullable=False),
        sa.Column("thickness_mm", sa.Integer(), nullable=False),
        sa.Column("efficiency_percent", sa.Float(), nullable=False),
        sa.Column("cell_technology", sa.String(length=180), nullable=False),
        sa.Column("temperature_coefficient_pmax", sa.Float(), nullable=False),
        sa.Column("datasheet_url", sa.Text(), nullable=False),
        sa.Column("bih_source_name", sa.String(length=160), nullable=False),
        sa.Column("bih_source_url", sa.Text(), nullable=False),
        sa.Column("verified_at", sa.Date(), nullable=False),
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
        sa.CheckConstraint("power_wp > 0", name="ck_solar_panels_power_positive"),
        sa.CheckConstraint(
            "width_mm > 0 AND length_mm > 0 AND thickness_mm > 0",
            name="ck_solar_panels_dimensions_positive",
        ),
        sa.CheckConstraint(
            "efficiency_percent > 0 AND efficiency_percent <= 100",
            name="ck_solar_panels_efficiency_range",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("model_sku"),
    )

    verified = date(2026, 11, 2)
    source = "Energo Shop, Posusje"
    op.bulk_insert(
        panels,
        [
            {
                "id": UUID("10000000-0000-4000-8000-000000000001"),
                "manufacturer": "Hanersun",
                "model_sku": "CP18-54H430W",
                "category": "compact",
                "power_wp": 430,
                "width_mm": 1134,
                "length_mm": 1722,
                "thickness_mm": 30,
                "efficiency_percent": 22.02,
                "cell_technology": "Monocrystalline half-cell",
                "temperature_coefficient_pmax": -0.31,
                "datasheet_url": "https://energoshop.ba/wp-content/uploads/2023/11/CP18-54H.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/hanersun-430w-half-cell-mono/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000002"),
                "manufacturer": "LONGi",
                "model_sku": "LR5-54HTH-435M",
                "category": "compact",
                "power_wp": 435,
                "width_mm": 1134,
                "length_mm": 1722,
                "thickness_mm": 30,
                "efficiency_percent": 22.3,
                "cell_technology": "Monocrystalline HPBC",
                "temperature_coefficient_pmax": -0.29,
                "datasheet_url": "https://static.longi.com/20_L_Gi_LE_PM_T_PMD_059_F130_LR_5_54_HTH_415_435_M_30_30_and_15_Frame_Explorer_DG_V17_2ccb21ba87.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/solarni-modul-longi-lr5-54hth-435m/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000003"),
                "manufacturer": "DAH Solar",
                "model_sku": "DHN-48Z20/DG(BW)-455W",
                "category": "compact",
                "power_wp": 455,
                "width_mm": 1134,
                "length_mm": 1762,
                "thickness_mm": 30,
                "efficiency_percent": 22.77,
                "cell_technology": "N-type TOPCon bifacial dual-glass",
                "temperature_coefficient_pmax": -0.29,
                "datasheet_url": "https://en.dahsolar.com/prodetails/DHN-48Z20-DG-FS-BW--425-455W.html",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/dah-solar-dhn-48z20-dgbw-455w/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000004"),
                "manufacturer": "Trina Solar",
                "model_sku": "TSM-460NEG9R.28",
                "category": "compact",
                "power_wp": 460,
                "width_mm": 1134,
                "length_mm": 1762,
                "thickness_mm": 30,
                "efficiency_percent": 23.0,
                "cell_technology": "N-type i-TOPCon dual-glass",
                "temperature_coefficient_pmax": -0.29,
                "datasheet_url": "https://www.trinasolar.com/en-mea/NEG9R.28/",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/solarni-panel-trina-vertex-s-460w/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000005"),
                "manufacturer": "Fuji Solar",
                "model_sku": "FJ550M-144M10-182",
                "category": "standard",
                "power_wp": 550,
                "width_mm": 1134,
                "length_mm": 2279,
                "thickness_mm": 35,
                "efficiency_percent": 21.3,
                "cell_technology": "Monocrystalline PERC half-cell",
                "temperature_coefficient_pmax": -0.36,
                "datasheet_url": "https://solarshop-gmbh.de/wp-content/uploads/2024/04/Datenblatt-FUJI-Solar-FJ550M-144M10-550W-Monofacial-Moddul.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/fuji-solar-550w/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000006"),
                "manufacturer": "Tongwei",
                "model_sku": "TWMND-72HD580",
                "category": "standard",
                "power_wp": 580,
                "width_mm": 1134,
                "length_mm": 2278,
                "thickness_mm": 30,
                "efficiency_percent": 22.5,
                "cell_technology": "N-type TNC bifacial dual-glass",
                "temperature_coefficient_pmax": -0.28,
                "datasheet_url": "https://en.tongwei.cn/uploads/20241202/1936734e375da8e29ae7f00e77098e91.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/tongwei-580w-twmnd-72hd580/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000007"),
                "manufacturer": "Hanersun",
                "model_sku": "HN18N-72HT590W",
                "category": "standard",
                "power_wp": 590,
                "width_mm": 1134,
                "length_mm": 2278,
                "thickness_mm": 30,
                "efficiency_percent": 22.8,
                "cell_technology": "N-type TOPCon bifacial dual-glass",
                "temperature_coefficient_pmax": -0.28,
                "datasheet_url": "https://www.hanersun.com/wp-content/uploads/download/datasheet/HItouch5N/HN18N-72HT.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/hanersuna-590w/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000008"),
                "manufacturer": "Hanersun",
                "model_sku": "HN21N-66HT700W",
                "category": "high-power",
                "power_wp": 700,
                "width_mm": 1303,
                "length_mm": 2384,
                "thickness_mm": 33,
                "efficiency_percent": 22.5,
                "cell_technology": "N-type TOPCon bifacial dual-glass",
                "temperature_coefficient_pmax": -0.28,
                "datasheet_url": "https://www.hanersun.com/wp-content/uploads/download/datasheet/HItouch6N/HN21N-66HT.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/hanersun-700w-bifacial/",
                "verified_at": verified,
            },
            {
                "id": UUID("10000000-0000-4000-8000-000000000009"),
                "manufacturer": "Suntech",
                "model_sku": "STP670S-D66/Pmh+",
                "category": "high-power",
                "power_wp": 670,
                "width_mm": 1303,
                "length_mm": 2384,
                "thickness_mm": 35,
                "efficiency_percent": 21.6,
                "cell_technology": "Monocrystalline half-cell bifacial",
                "temperature_coefficient_pmax": -0.34,
                "datasheet_url": "https://www.suntech-power.com/wp-content/uploads/download/product-specification/EN_Ultra_X_Plus_STP670S_D66_Pmh%2B.pdf",
                "bih_source_name": source,
                "bih_source_url": "https://energoshop.ba/product/suntech-670w-bifacial/",
                "verified_at": verified,
            },
        ],
    )

    op.create_table(
        "panel_layouts",
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("solar_panel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("orientation", sa.String(length=16), nullable=False),
        sa.Column("rows", sa.Integer(), nullable=False),
        sa.Column("columns", sa.Integer(), nullable=False),
        sa.Column("panel_count", sa.Integer(), nullable=False),
        sa.Column("installed_kwp", sa.Float(), nullable=False),
        sa.Column("occupied_area_m2", sa.Float(), nullable=False),
        sa.Column("utilization_percent", sa.Float(), nullable=False),
        sa.Column("layout_json", sa.JSON(), nullable=False),
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
            "orientation IN ('portrait', 'landscape')",
            name="ck_panel_layouts_orientation",
        ),
        sa.CheckConstraint(
            "rows >= 0 AND columns >= 0",
            name="ck_panel_layouts_grid_nonnegative",
        ),
        sa.CheckConstraint(
            "panel_count >= 0",
            name="ck_panel_layouts_count_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"], ["solar_projects.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["solar_panel_id"], ["solar_panels.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id"),
    )


def downgrade() -> None:
    op.drop_table("panel_layouts")
    op.drop_table("solar_panels")
