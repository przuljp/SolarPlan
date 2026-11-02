from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ProjectLocationNotFoundError
from app.models.project_location import ProjectLocation
from app.repositories import project_location_repository
from app.schemas.project_location import ProjectLocationUpsert
from app.services import project_service


async def get_location(session: AsyncSession, project_id: UUID, owner_id: UUID) -> ProjectLocation:
    await project_service.get_project(session, project_id, owner_id)
    location = await project_location_repository.get_by_project_id(session, project_id)
    if location is None:
        raise ProjectLocationNotFoundError
    return location


async def upsert_location(
    session: AsyncSession, project_id: UUID, owner_id: UUID, data: ProjectLocationUpsert
) -> ProjectLocation:
    await project_service.get_project(session, project_id, owner_id)
    location = await project_location_repository.get_by_project_id(session, project_id)
    if location is None:
        location = ProjectLocation(project_id=project_id, **data.model_dump())
        project_location_repository.add(session, location)
    else:
        for field, value in data.model_dump().items():
            setattr(location, field, value)
    await session.commit()
    await session.refresh(location)
    return location
