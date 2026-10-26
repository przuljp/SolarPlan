from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project


async def list_by_owner(session: AsyncSession, owner_id: UUID) -> list[Project]:
    statement = (
        select(Project)
        .where(Project.user_id == owner_id)
        .order_by(Project.updated_at.desc(), Project.id.desc())
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_by_id_for_owner(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> Project | None:
    result = await session.execute(owned_project_statement(project_id, owner_id))
    return result.scalar_one_or_none()


def owned_project_statement(project_id: UUID, owner_id: UUID) -> Select[tuple[Project]]:
    return select(Project).where(
        Project.id == project_id,
        Project.user_id == owner_id,
    )


def add(session: AsyncSession, project: Project) -> None:
    session.add(project)


async def delete(session: AsyncSession, project: Project) -> None:
    await session.delete(project)
