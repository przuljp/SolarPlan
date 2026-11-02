from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project_location import ProjectLocation


async def get_by_project_id(session: AsyncSession, project_id: UUID) -> ProjectLocation | None:
    result = await session.execute(
        select(ProjectLocation).where(ProjectLocation.project_id == project_id)
    )
    return result.scalar_one_or_none()


def add(session: AsyncSession, location: ProjectLocation) -> None:
    session.add(location)
