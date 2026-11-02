from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.panel_layout import PanelLayout
from app.models.roof_surface import RoofSurface


async def list_by_project(session: AsyncSession, project_id: UUID) -> list[RoofSurface]:
    result = await session.execute(
        select(RoofSurface)
        .options(selectinload(RoofSurface.panel_layout).selectinload(PanelLayout.solar_panel))
        .where(RoofSurface.project_id == project_id)
        .order_by(RoofSurface.created_at, RoofSurface.id)
    )
    return list(result.scalars().all())


async def get_by_id_for_project(
    session: AsyncSession, surface_id: UUID, project_id: UUID
) -> RoofSurface | None:
    result = await session.execute(
        select(RoofSurface)
        .options(selectinload(RoofSurface.panel_layout).selectinload(PanelLayout.solar_panel))
        .where(RoofSurface.id == surface_id, RoofSurface.project_id == project_id)
    )
    return result.scalar_one_or_none()


def add(session: AsyncSession, surface: RoofSurface) -> None:
    session.add(surface)


async def delete(session: AsyncSession, surface: RoofSurface) -> None:
    await session.delete(surface)
