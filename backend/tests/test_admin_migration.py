import asyncio
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app.core.config import settings


def test_admin_migration_preserves_existing_users_and_layouts(monkeypatch):
    server_url = os.environ.get("SOLARPLAN_TEST_DATABASE_URL")
    if not server_url:
        pytest.skip("Set SOLARPLAN_TEST_DATABASE_URL for the PostgreSQL migration test.")
    database_name = f"solarplan_admin_migration_{uuid4().hex}"
    test_url = (
        make_url(server_url).set(database=database_name).render_as_string(hide_password=False)
    )

    async def manage_database(create):
        engine = create_async_engine(server_url, isolation_level="AUTOCOMMIT")
        try:
            async with engine.connect() as connection:
                if create:
                    await connection.execute(text(f'CREATE DATABASE "{database_name}"'))
                else:
                    await connection.execute(text(f'DROP DATABASE "{database_name}" WITH (FORCE)'))
        finally:
            await engine.dispose()

    async def seed():
        engine = create_async_engine(test_url)
        try:
            async with engine.begin() as connection:
                user_id, project_id, surface_id, layout_id = [uuid4() for _ in range(4)]
                await connection.execute(
                    text(
                        "INSERT INTO users (id,full_name,email,password_hash) "
                        "VALUES (:id,'Legacy owner','legacy@example.com','test-only-hash')"
                    ),
                    {"id": user_id},
                )
                await connection.execute(
                    text(
                        "INSERT INTO solar_projects (id,user_id,name) "
                        "VALUES (:id,:owner,'Legacy roof')"
                    ),
                    {"id": project_id, "owner": user_id},
                )
                await connection.execute(
                    text(
                        "INSERT INTO roof_surfaces (id,project_id,name,shape_type,bottom_width_m,"
                        "top_width_m,top_offset_m,length_m,tilt_deg,azimuth_deg,"
                        "edge_margin_m,panel_gap_m) "
                        "VALUES (:id,:project,'South','rectangle',6,6,0,10,30,180,0.3,0.02)"
                    ),
                    {"id": surface_id, "project": project_id},
                )
                panel = (
                    await connection.execute(text("SELECT id,power_wp FROM solar_panels LIMIT 1"))
                ).one()
                await connection.execute(
                    text(
                        "INSERT INTO panel_layouts (id,project_id,roof_surface_id,solar_panel_id,"
                        "orientation,rows,columns,panel_count,installed_kwp,occupied_area_m2,"
                        "utilization_percent,layout_json) "
                        "VALUES (:id,:project,:surface,:panel,'portrait',1,1,1,:power,2,10,'[]')"
                    ),
                    {
                        "id": layout_id,
                        "project": project_id,
                        "surface": surface_id,
                        "panel": panel.id,
                        "power": panel.power_wp / 1000,
                    },
                )
        finally:
            await engine.dispose()

    async def verify():
        engine = create_async_engine(test_url)
        try:
            async with engine.connect() as connection:
                user = (await connection.execute(text("SELECT role,is_active FROM users"))).one()
                assert user.role == "USER" and user.is_active is True
                assert await connection.scalar(text("SELECT count(*) FROM solar_projects")) == 1
                row = (
                    await connection.execute(
                        text(
                            "SELECT l.panel_snapshot, p.power_wp FROM panel_layouts l "
                            "JOIN solar_panels p ON p.id=l.solar_panel_id"
                        )
                    )
                ).one()
                assert row.panel_snapshot["power_wp"] == row.power_wp
                assert row.panel_snapshot["is_active"] is True
                assert (
                    await connection.scalar(
                        text("SELECT count(*) FROM solar_panels WHERE is_active")
                    )
                    == 9
                )
        finally:
            await engine.dispose()

    backend = Path(__file__).resolve().parents[1]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    asyncio.run(manage_database(True))
    monkeypatch.setattr(settings, "database_url", test_url)
    try:
        command.upgrade(config, "0008")
        asyncio.run(seed())
        command.upgrade(config, "head")
        asyncio.run(verify())
        command.downgrade(config, "0008")
        command.upgrade(config, "head")
        asyncio.run(verify())
    finally:
        asyncio.run(manage_database(False))
