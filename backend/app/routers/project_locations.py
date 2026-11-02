from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import ProjectLocationNotFoundError, ProjectNotFoundError
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.project_location import ProjectLocationRead, ProjectLocationUpsert
from app.services import project_location_service

router = APIRouter(prefix="/projects/{project_id}/location", tags=["project location"])


@router.get("", response_model=ProjectLocationRead)
async def read_location(
    project_id: UUID, current_user: CurrentUserDependency, session: SessionDependency
):
    try:
        return await project_location_service.get_location(session, project_id, current_user.id)
    except (ProjectNotFoundError, ProjectLocationNotFoundError) as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "location_not_found", "message": "Project location not found."},
        ) from error


@router.put("", response_model=ProjectLocationRead)
async def save_location(
    project_id: UUID,
    data: ProjectLocationUpsert,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await project_location_service.upsert_location(
            session, project_id, current_user.id, data
        )
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "project_not_found", "message": "Project not found."},
        ) from error
