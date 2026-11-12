from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.solar_panel import SolarPanel
from app.models.user import User
from app.repositories import admin_repository, solar_panel_repository, user_repository
from app.schemas.admin import AdminStats, AdminUserRead, AdminUsersPage, PanelInput
from app.schemas.user import UserRead


async def dashboard(session: AsyncSession) -> AdminStats:
    return AdminStats(**await admin_repository.statistics(session))


async def list_users(session: AsyncSession, email: str, offset: int, limit: int) -> AdminUsersPage:
    page = await admin_repository.users_page(session, email, offset, limit)
    page["items"] = [
        AdminUserRead(**UserRead.model_validate(user).model_dump(), project_count=count)
        for user, count in page["items"]
    ]
    return AdminUsersPage(**page)


async def set_user_activity(
    session: AsyncSession, actor: User, user_id: UUID, active: bool
) -> User:
    await admin_repository.lock_user_management(session)
    current_actor = await user_repository.get_by_id(session, actor.id)
    if current_actor is None or not current_actor.is_active or current_actor.role != "ADMIN":
        raise HTTPException(403, "Administrator access is required.")
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise HTTPException(404, "User not found.")
    if not active:
        if actor.id == user.id:
            raise HTTPException(409, "You cannot deactivate your own account.")
        if user.role == "ADMIN" and user.is_active:
            if await admin_repository.active_admin_count(session) <= 1:
                raise HTTPException(409, "The last active administrator cannot be deactivated.")
    user.is_active = active
    await session.commit()
    await session.refresh(user)
    return user


async def promote_admin(session: AsyncSession, email: str) -> User:
    await admin_repository.lock_user_management(session)
    user = await user_repository.get_by_email(session, email.strip())
    if user is None or not user.is_active:
        raise ValueError("An existing active account is required. Register it first.")
    user.role = "ADMIN"
    await session.commit()
    return user


async def list_panels(session: AsyncSession) -> list[SolarPanel]:
    return await solar_panel_repository.list_all(session, include_inactive=True)


async def require_panel(session: AsyncSession, panel_id: UUID) -> SolarPanel:
    panel = await admin_repository.locked_panel(session, panel_id)
    if panel is None:
        raise HTTPException(404, "Solar panel not found.")
    return panel


async def save_panel(
    session: AsyncSession, data: PanelInput, panel_id: UUID | None = None
) -> SolarPanel:
    panel = await require_panel(session, panel_id) if panel_id else SolarPanel(is_active=True)
    for field, value in data.model_dump(mode="python").items():
        setattr(panel, field, str(value) if field.endswith("_url") else value)
    if panel_id is None:
        admin_repository.add_panel(session, panel)
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(409, "A panel with this model SKU already exists.") from error
    await session.refresh(panel)
    return panel


async def set_panel_activity(session: AsyncSession, panel_id: UUID, active: bool) -> SolarPanel:
    panel = await require_panel(session, panel_id)
    panel.is_active = active
    await session.commit()
    await session.refresh(panel)
    return panel


async def delete_panel(session: AsyncSession, panel_id: UUID) -> None:
    panel = await require_panel(session, panel_id)
    if await admin_repository.panel_is_referenced(session, panel_id):
        raise HTTPException(
            409, "This panel is used by saved layouts or analyses. Deactivate it instead."
        )
    try:
        await admin_repository.delete_panel(session, panel)
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise HTTPException(409, "This panel is in use. Deactivate it instead.") from error
