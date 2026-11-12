from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.solar_panel import SolarPanel


async def list_all(session: AsyncSession, *, include_inactive: bool = False) -> list[SolarPanel]:
    statement = select(SolarPanel).order_by(SolarPanel.power_wp, SolarPanel.manufacturer)
    if not include_inactive:
        statement = statement.where(SolarPanel.is_active.is_(True))
        statement = statement.with_for_update(read=True)
    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, panel_id: UUID) -> SolarPanel | None:
    return (
        await session.execute(
            select(SolarPanel).where(SolarPanel.id == panel_id).with_for_update(read=True)
        )
    ).scalar_one_or_none()
