from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import ConsumptionProfileNotFoundError, ProjectNotFoundError
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.consumption import ConsumptionProfileRead, ConsumptionProfileUpsert
from app.services import consumption_service

router = APIRouter(prefix="/projects/{project_id}/consumption", tags=["consumption"])


@router.get("", response_model=ConsumptionProfileRead)
async def read_consumption_profile(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await consumption_service.get_consumption_profile(
            session, project_id, current_user.id
        )
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "project_not_found", "message": "Project not found."},
        ) from error
    except ConsumptionProfileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "consumption_profile_not_found",
                "message": "No consumption profile exists yet.",
            },
        ) from error


@router.put("", response_model=ConsumptionProfileRead)
async def save_consumption_profile(
    project_id: UUID,
    data: ConsumptionProfileUpsert,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await consumption_service.upsert_consumption_profile(
            session, project_id, current_user.id, data
        )
    except ProjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "project_not_found", "message": "Project not found."},
        ) from error
