from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.solar_panel import SolarPanel


async def list_all(session: AsyncSession) -> list[SolarPanel]:
    result = await session.execute(
        select(SolarPanel).order_by(SolarPanel.power_wp, SolarPanel.manufacturer)
    )
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, panel_id: UUID) -> SolarPanel | None:
    return await session.get(SolarPanel, panel_id)
