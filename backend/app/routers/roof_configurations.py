from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import ProjectNotFoundError, RoofConfigurationNotFoundError
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.error import ErrorResponse
from app.schemas.roof_configuration import RoofConfigurationRead, RoofConfigurationUpsert
from app.services import roof_configuration_service

router = APIRouter(
    prefix="/projects/{project_id}/roof",
    tags=["roof configuration"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "A valid Bearer token is required.",
        }
    },
)

not_found_response = {
    "model": ErrorResponse,
    "description": "The project or its roof configuration was not found.",
}


def project_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "project_not_found", "message": "Project not found."},
    )


def roof_configuration_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={
            "code": "roof_configuration_not_found",
            "message": "Roof configuration not found.",
        },
    )


@router.get(
    "",
    response_model=RoofConfigurationRead,
    responses={status.HTTP_404_NOT_FOUND: not_found_response},
)
async def read_roof_configuration(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> RoofConfigurationRead:
    try:
        roof_configuration = await roof_configuration_service.get_roof_configuration(
            session,
            project_id,
            current_user.id,
        )
    except ProjectNotFoundError as error:
        raise project_not_found() from error
    except RoofConfigurationNotFoundError as error:
        raise roof_configuration_not_found() from error
    return RoofConfigurationRead.model_validate(roof_configuration)


@router.put(
    "",
    response_model=RoofConfigurationRead,
    responses={status.HTTP_404_NOT_FOUND: not_found_response},
)
async def upsert_roof_configuration(
    project_id: UUID,
    data: RoofConfigurationUpsert,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> RoofConfigurationRead:
    try:
        roof_configuration = await roof_configuration_service.upsert_roof_configuration(
            session,
            project_id,
            current_user.id,
            data,
        )
    except ProjectNotFoundError as error:
        raise project_not_found() from error
    return RoofConfigurationRead.model_validate(roof_configuration)
