import asyncio
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.exceptions import OptimizationInputsIncompleteError
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db_session
from app.models import ConfigurationOptimization, EnergySimulation, Project, User
from app.repositories import admin_repository, user_repository
from app.routers import admin, auth, panel_layouts, projects, roof_surfaces, solar_panels, users
from app.schemas.admin import PanelInput
from app.schemas.optimization import OptimizationRequest
from app.services import admin_service, configuration_optimization_service

PANEL = {
    "manufacturer": "Test maker",
    "model_sku": "QA-430",
    "category": "standard",
    "power_wp": 430,
    "width_mm": 1134,
    "length_mm": 1722,
    "thickness_mm": 30,
    "efficiency_percent": 22.0,
    "cell_technology": "Mono",
    "temperature_coefficient_pmax": -0.29,
    "datasheet_url": "https://example.com/datasheet",
    "bih_source_name": "Test source",
    "bih_source_url": "https://example.com/panel",
    "verified_at": "2026-01-01",
}


def application():
    app = FastAPI()
    for router in (
        admin.router,
        auth.router,
        users.router,
        projects.router,
        solar_panels.router,
        panel_layouts.router,
        roof_surfaces.router,
    ):
        app.include_router(router, prefix="/api/v1")
    return app


ENDPOINTS = [
    ("GET", "/admin/dashboard", None),
    ("GET", "/admin/users", None),
    ("GET", "/admin/panels", None),
    ("POST", "/admin/panels", PANEL),
    ("PUT", f"/admin/panels/{uuid4()}", PANEL),
    ("PATCH", f"/admin/panels/{uuid4()}/activity", {"is_active": False}),
    ("DELETE", f"/admin/panels/{uuid4()}", None),
    ("PATCH", f"/admin/users/{uuid4()}/activity", {"is_active": False}),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("method,path,body", ENDPOINTS)
@pytest.mark.parametrize("active,expected", [(True, 403), (False, 401)])
async def test_all_admin_endpoints_reject_standard_and_inactive_users(
    monkeypatch, method, path, body, active, expected
):
    user = SimpleNamespace(id=uuid4(), role="USER", is_active=active)
    monkeypatch.setattr(user_repository, "get_by_id", AsyncMock(return_value=user))
    app = application()
    app.dependency_overrides[get_db_session] = lambda: object()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.request(
            method,
            f"/api/v1{path}",
            json=body,
            headers={"Authorization": f"Bearer {create_access_token(user.id)}"},
        )
    assert response.status_code == expected


@pytest.mark.parametrize(
    "field,value",
    [
        ("manufacturer", "  "),
        ("power_wp", 0),
        ("width_mm", -1),
        ("efficiency_percent", 101),
        ("efficiency_percent", float("nan")),
        ("temperature_coefficient_pmax", 1),
        ("datasheet_url", "javascript:alert(1)"),
        ("category", "other"),
        ("verified_at", "2999-01-01"),
    ],
)
def test_panel_input_rejects_invalid_values(field, value):
    with pytest.raises(ValidationError):
        PanelInput.model_validate({**PANEL, field: value})


@pytest.mark.asyncio
async def test_last_active_admin_is_protected(monkeypatch):
    actor = SimpleNamespace(id=uuid4(), role="ADMIN", is_active=True)
    target = SimpleNamespace(id=uuid4(), role="ADMIN", is_active=True)
    monkeypatch.setattr(admin_repository, "lock_user_management", AsyncMock())
    monkeypatch.setattr(user_repository, "get_by_id", AsyncMock(side_effect=[actor, target]))
    monkeypatch.setattr(admin_repository, "active_admin_count", AsyncMock(return_value=1))
    with pytest.raises(HTTPException) as caught:
        await admin_service.set_user_activity(AsyncMock(), actor, target.id, False)
    assert caught.value.status_code == 409
    assert target.is_active


@pytest.mark.asyncio
async def test_cli_requires_existing_active_account(monkeypatch):
    monkeypatch.setattr(admin_repository, "lock_user_management", AsyncMock())
    monkeypatch.setattr(user_repository, "get_by_email", AsyncMock(return_value=None))
    with pytest.raises(ValueError, match="existing active account"):
        await admin_service.promote_admin(AsyncMock(), "missing@example.com")


@pytest.mark.asyncio
async def test_manual_optimizer_rejects_inactive_saved_model_before_pvgis(monkeypatch):
    layout = SimpleNamespace(solar_panel_id=uuid4(), panel_count=4)
    context = (
        object(),
        object(),
        [SimpleNamespace(panel_layout=layout)],
        [SimpleNamespace(id=uuid4())],
    )
    monkeypatch.setattr(
        configuration_optimization_service, "_load_context", AsyncMock(return_value=context)
    )
    yields = AsyncMock()
    monkeypatch.setattr(configuration_optimization_service, "_surface_yields", yields)
    with pytest.raises(OptimizationInputsIncompleteError, match="inactive"):
        await configuration_optimization_service.run_optimization(
            AsyncMock(), uuid4(), uuid4(), OptimizationRequest(criterion="manual")
        )
    yields.assert_not_called()


@pytest_asyncio.fixture
async def database():
    url = os.environ.get("SOLARPLAN_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set SOLARPLAN_TEST_DATABASE_URL to an isolated PostgreSQL database.")
    # Unique schema: no reads or writes to application tables, even in a shared test server.
    schema = f"admin_qa_{uuid4().hex}"
    engine = create_async_engine(url)
    async with engine.begin() as connection:
        await connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    scoped = create_async_engine(url, connect_args={"server_settings": {"search_path": schema}})
    async with scoped.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with AsyncSession(scoped, expire_on_commit=False) as session:
        yield session
    await scoped.dispose()
    async with engine.begin() as connection:
        await connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    await engine.dispose()


@pytest.mark.asyncio
async def test_admin_and_user_workflow_in_postgresql(database):
    session = database
    app = application()

    async def db():
        yield session

    app.dependency_overrides[get_db_session] = db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        credentials = {"email": "admin@example.com", "password": "ExamplePass123"}
        registered = await client.post(
            "/api/v1/auth/register",
            json={
                **credentials,
                "full_name": "Admin QA",
                "role": "ADMIN",
                "is_active": False,
            },
        )
        assert registered.status_code == 201
        assert registered.json()["role"] == "USER"
        assert registered.json()["is_active"] is True
        assert "password_hash" not in registered.text
        admin_id = registered.json()["id"]
        await admin_service.promote_admin(session, credentials["email"])
        login = await client.post("/api/v1/auth/login", json=credentials)
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        other_credentials = {"email": "owner@example.com", "password": "ExamplePass123"}
        owner = await client.post(
            "/api/v1/auth/register",
            json={
                **other_credentials,
                "full_name": "Owner QA",
            },
        )
        owner_id = owner.json()["id"]
        owner_login = await client.post("/api/v1/auth/login", json=other_credentials)
        owner_headers = {"Authorization": f"Bearer {owner_login.json()['access_token']}"}
        project_response = await client.post(
            "/api/v1/projects", json={"name": "Private QA"}, headers=owner_headers
        )
        assert project_response.status_code == 201
        project_id = project_response.json()["id"]
        assert (
            await client.get(f"/api/v1/projects/{project_id}", headers=headers)
        ).status_code == 404
        panel_response = await client.post("/api/v1/admin/panels", json=PANEL, headers=headers)
        assert panel_response.status_code == 201, panel_response.text
        panel_id = panel_response.json()["id"]
        surface = await client.post(
            f"/api/v1/projects/{project_id}/roof-surfaces",
            headers=owner_headers,
            json={
                "name": "South",
                "bottom_width_m": 6,
                "length_m": 10,
                "tilt_deg": 30,
                "azimuth_deg": 180,
                "edge_margin_m": 0.3,
                "panel_gap_m": 0.02,
            },
        )
        assert surface.status_code == 201, surface.text
        surface_id = surface.json()["id"]
        layout_path = f"/api/v1/projects/{project_id}/roof-surfaces/{surface_id}/layout"
        saved = await client.put(
            layout_path, headers=owner_headers, json={"solar_panel_id": panel_id, "panel_count": 4}
        )
        assert saved.status_code == 200, saved.text
        updated = await client.put(
            f"/api/v1/admin/panels/{panel_id}",
            headers=headers,
            json={**PANEL, "power_wp": 500, "width_mm": 1500},
        )
        assert updated.status_code == 200
        original = await client.get(layout_path, headers=owner_headers)
        assert original.json()["solar_panel"]["power_wp"] == 430
        assert original.json()["installed_kwp"] == 1.72
        preview = await client.post(
            f"{layout_path}/preview", headers=owner_headers, json={"solar_panel_id": panel_id}
        )
        assert preview.json()["solar_panel"]["power_wp"] == 430
        assert (
            await client.delete(f"/api/v1/admin/panels/{panel_id}", headers=headers)
        ).status_code == 409
        deactivated = await client.patch(
            f"/api/v1/admin/panels/{panel_id}/activity", headers=headers, json={"is_active": False}
        )
        assert deactivated.status_code == 200
        assert (await client.get("/api/v1/panels", headers=owner_headers)).json() == []
        assert (await client.get(layout_path, headers=owner_headers)).status_code == 200
        assert (
            await client.put(layout_path, headers=owner_headers, json={"solar_panel_id": panel_id})
        ).status_code == 404
        assert len((await client.get("/api/v1/admin/panels", headers=headers)).json()) == 1
        listing = (
            await client.get("/api/v1/admin/users?email=OWNER&limit=1", headers=headers)
        ).json()
        assert listing["total"] == 1 and listing["items"][0]["project_count"] == 1
        assert "password_hash" not in str(listing)
        assert (await client.get("/api/v1/admin/dashboard", headers=headers)).json() == {
            "total_users": 2,
            "active_users": 2,
            "total_projects": 1,
            "panel_models": 1,
        }
        assert (
            await client.patch(
                f"/api/v1/admin/users/{admin_id}/activity",
                headers=headers,
                json={"is_active": False},
            )
        ).status_code == 409
        assert (
            await client.patch(
                f"/api/v1/admin/users/{owner_id}/activity",
                headers=headers,
                json={"is_active": False},
            )
        ).status_code == 200
        assert (await client.get("/api/v1/users/me", headers=owner_headers)).status_code == 401
        assert (await client.get("/api/v1/projects", headers=owner_headers)).status_code == 401
        assert (await client.post("/api/v1/auth/login", json=other_credentials)).status_code == 401
        assert (
            await client.patch(
                f"/api/v1/admin/users/{owner_id}/activity",
                headers=headers,
                json={"is_active": True},
            )
        ).status_code == 200
        assert (
            await client.get(f"/api/v1/projects/{project_id}", headers=owner_headers)
        ).status_code == 200
        unused = await client.post(
            "/api/v1/admin/panels", json={**PANEL, "model_sku": "Unused"}, headers=headers
        )
        assert (
            await client.delete(f"/api/v1/admin/panels/{unused.json()['id']}", headers=headers)
        ).status_code == 204


@pytest.mark.asyncio
async def test_concurrent_admin_deactivation_preserves_one_active_admin(database):
    first = User(
        full_name="First admin",
        email="first@example.com",
        password_hash="test",
        role="ADMIN",
        is_active=True,
    )
    second = User(
        full_name="Second admin",
        email="second@example.com",
        password_hash="test",
        role="ADMIN",
        is_active=True,
    )
    database.add_all([first, second])
    await database.commit()
    factory = async_sessionmaker(database.bind, expire_on_commit=False)

    async def deactivate(actor_id, target_id):
        async with factory() as session:
            actor = await user_repository.get_by_id(session, actor_id)
            try:
                await admin_service.set_user_activity(session, actor, target_id, False)
                return 200
            except HTTPException as error:
                await session.rollback()
                return error.status_code

    results = await asyncio.gather(deactivate(first.id, second.id), deactivate(second.id, first.id))
    assert sorted(results) == [200, 403]
    assert await admin_repository.active_admin_count(database) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize("reference", ["simulation", "candidate", "rejected_candidate"])
async def test_panel_deletion_protects_historical_json_references(database, reference):
    owner = User(full_name="History owner", email="history@example.com", password_hash="test")
    database.add(owner)
    await database.flush()
    project = Project(user_id=owner.id, name="History")
    database.add(project)
    await database.commit()
    panel = await admin_service.save_panel(database, PanelInput.model_validate(PANEL))
    panel_id = panel.id
    marker = {"panel": {"id": str(panel_id)}}
    if reference == "simulation":
        record = EnergySimulation(
            project_id=project.id,
            provider_version="5.3",
            method_version="test",
            system_loss_percent=14,
            installed_kwp=1,
            annual_kwh=1000,
            specific_yield_kwh_per_kwp=1000,
            input_snapshot=marker,
            monthly_results=[],
            surface_results=[],
        )
    else:
        record = ConfigurationOptimization(
            project_id=project.id,
            criterion="maximum_production",
            system_loss_percent=14,
            input_hash="test",
            methodology="test",
            candidates=[marker] if reference == "candidate" else [],
            rejected_candidates=[marker] if reference == "rejected_candidate" else [],
        )
    database.add(record)
    await database.commit()
    with pytest.raises(HTTPException) as caught:
        await admin_service.delete_panel(database, panel_id)
    assert caught.value.status_code == 409
