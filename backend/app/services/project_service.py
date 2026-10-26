from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ProjectNotFoundError
from app.models.project import Project
from app.repositories import project_repository
from app.schemas.project import ProjectCreate, ProjectUpdate


async def create_project(
    session: AsyncSession,
    owner_id: UUID,
    data: ProjectCreate,
) -> Project:
    project = Project(
        user_id=owner_id,
        name=data.name,
        description=data.description,
    )
    project_repository.add(session, project)
    await session.commit()
    await session.refresh(project)
    return project


async def list_projects(session: AsyncSession, owner_id: UUID) -> list[Project]:
    return await project_repository.list_by_owner(session, owner_id)


async def get_project(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> Project:
    project = await project_repository.get_by_id_for_owner(session, project_id, owner_id)
    if project is None:
        raise ProjectNotFoundError
    return project


async def update_project(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
    data: ProjectUpdate,
) -> Project:
    project = await get_project(session, project_id, owner_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    await session.commit()
    await session.refresh(project)
    return project


async def delete_project(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> None:
    project = await get_project(session, project_id, owner_id)
    await project_repository.delete(session, project)
    await session.commit()
