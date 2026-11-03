from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consumption_profile import ElectricityConsumptionProfile


async def get_by_project_id(
    session: AsyncSession, project_id: UUID
) -> ElectricityConsumptionProfile | None:
    result = await session.execute(
        select(ElectricityConsumptionProfile).where(
            ElectricityConsumptionProfile.project_id == project_id
        )
    )
    return result.scalar_one_or_none()


def add(session: AsyncSession, profile: ElectricityConsumptionProfile) -> None:
    session.add(profile)
