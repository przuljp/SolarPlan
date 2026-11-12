from uuid import UUID

from fastapi import APIRouter, Query, Response

from app.dependencies.auth import AdminUserDependency, SessionDependency
from app.schemas.admin import ActivityUpdate, AdminStats, AdminUsersPage, PanelInput
from app.schemas.solar_panel import SolarPanelRead
from app.schemas.user import UserRead
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/dashboard", response_model=AdminStats)
async def dashboard(admin: AdminUserDependency, session: SessionDependency):
    return await admin_service.dashboard(session)


@router.get("/users", response_model=AdminUsersPage)
async def users(
    admin: AdminUserDependency,
    session: SessionDependency,
    email: str = Query(default="", max_length=320),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
):
    return await admin_service.list_users(session, email, offset, limit)


@router.patch("/users/{user_id}/activity", response_model=UserRead)
async def user_activity(
    user_id: UUID,
    data: ActivityUpdate,
    admin: AdminUserDependency,
    session: SessionDependency,
):
    return await admin_service.set_user_activity(session, admin, user_id, data.is_active)


@router.get("/panels", response_model=list[SolarPanelRead])
async def panels(admin: AdminUserDependency, session: SessionDependency):
    return await admin_service.list_panels(session)


@router.post("/panels", response_model=SolarPanelRead, status_code=201)
async def create_panel(data: PanelInput, admin: AdminUserDependency, session: SessionDependency):
    return await admin_service.save_panel(session, data)


@router.put("/panels/{panel_id}", response_model=SolarPanelRead)
async def update_panel(
    panel_id: UUID,
    data: PanelInput,
    admin: AdminUserDependency,
    session: SessionDependency,
):
    return await admin_service.save_panel(session, data, panel_id)


@router.patch("/panels/{panel_id}/activity", response_model=SolarPanelRead)
async def panel_activity(
    panel_id: UUID,
    data: ActivityUpdate,
    admin: AdminUserDependency,
    session: SessionDependency,
):
    return await admin_service.set_panel_activity(session, panel_id, data.is_active)


@router.delete("/panels/{panel_id}", status_code=204)
async def delete_panel(panel_id: UUID, admin: AdminUserDependency, session: SessionDependency):
    await admin_service.delete_panel(session, panel_id)
    return Response(status_code=204)
