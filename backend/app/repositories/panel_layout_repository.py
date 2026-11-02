from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.panel_layout import PanelLayout


async def get_by_surface_id(session: AsyncSession, roof_surface_id: UUID) -> PanelLayout | None:
    result = await session.execute(
        select(PanelLayout)
        .options(selectinload(PanelLayout.solar_panel))
        .where(PanelLayout.roof_surface_id == roof_surface_id)
    )
    return result.scalar_one_or_none()


async def list_by_project(session: AsyncSession, project_id: UUID) -> list[PanelLayout]:
    result = await session.execute(
        select(PanelLayout)
        .options(selectinload(PanelLayout.solar_panel))
        .where(PanelLayout.project_id == project_id)
        .order_by(PanelLayout.created_at, PanelLayout.id)
    )
    return list(result.scalars().all())


def add(session: AsyncSession, layout: PanelLayout) -> None:
    session.add(layout)
