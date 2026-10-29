from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RoofConfigurationNotFoundError
from app.models.roof_configuration import RoofConfiguration
from app.repositories import roof_configuration_repository
from app.schemas.roof_configuration import RoofConfigurationUpsert
from app.services import project_service


async def get_roof_configuration(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
) -> RoofConfiguration:
    await project_service.get_project(session, project_id, owner_id)
    roof_configuration = await roof_configuration_repository.get_by_project_id(
        session,
        project_id,
    )
    if roof_configuration is None:
        raise RoofConfigurationNotFoundError
    return roof_configuration


async def upsert_roof_configuration(
    session: AsyncSession,
    project_id: UUID,
    owner_id: UUID,
    data: RoofConfigurationUpsert,
) -> RoofConfiguration:
    await project_service.get_project(session, project_id, owner_id)
    roof_configuration = await roof_configuration_repository.get_by_project_id(
        session,
        project_id,
    )
    values = data.model_dump()

    if roof_configuration is None:
        roof_configuration = RoofConfiguration(project_id=project_id, **values)
        roof_configuration_repository.add(session, roof_configuration)
    else:
        for field, value in values.items():
            setattr(roof_configuration, field, value)

    await session.commit()
    await session.refresh(roof_configuration)
    return roof_configuration
