from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.roof_configuration import RoofConfiguration


async def get_by_project_id(
    session: AsyncSession,
    project_id: UUID,
) -> RoofConfiguration | None:
    result = await session.execute(by_project_statement(project_id))
    return result.scalar_one_or_none()


def by_project_statement(project_id: UUID) -> Select[tuple[RoofConfiguration]]:
    return select(RoofConfiguration).where(RoofConfiguration.project_id == project_id)


def add(session: AsyncSession, roof_configuration: RoofConfiguration) -> None:
    session.add(roof_configuration)
