from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.core.exceptions import ProjectNotFoundError
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.error import ErrorResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import project_service

router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "A valid Bearer token is required.",
        }
    },
)

not_found_response = {
    "model": ErrorResponse,
    "description": "The project does not exist or is not owned by the current user.",
}


def project_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "project_not_found", "message": "Project not found."},
    )


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ProjectRead:
    project = await project_service.create_project(session, current_user.id, data)
    return ProjectRead.model_validate(project)


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> list[ProjectRead]:
    projects = await project_service.list_projects(session, current_user.id)
    return [ProjectRead.model_validate(project) for project in projects]


@router.get(
    "/{project_id}",
    response_model=ProjectRead,
    responses={status.HTTP_404_NOT_FOUND: not_found_response},
)
async def read_project(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ProjectRead:
    try:
        project = await project_service.get_project(session, project_id, current_user.id)
    except ProjectNotFoundError as error:
        raise project_not_found() from error
    return ProjectRead.model_validate(project)


@router.patch(
    "/{project_id}",
    response_model=ProjectRead,
    responses={status.HTTP_404_NOT_FOUND: not_found_response},
)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> ProjectRead:
    try:
        project = await project_service.update_project(
            session,
            project_id,
            current_user.id,
            data,
        )
    except ProjectNotFoundError as error:
        raise project_not_found() from error
    return ProjectRead.model_validate(project)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={status.HTTP_404_NOT_FOUND: not_found_response},
)
async def delete_project(
    project_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> Response:
    try:
        await project_service.delete_project(session, project_id, current_user.id)
    except ProjectNotFoundError as error:
        raise project_not_found() from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
