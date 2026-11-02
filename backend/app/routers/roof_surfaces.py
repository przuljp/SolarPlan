from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from app.core.exceptions import ProjectNotFoundError, RoofSurfaceNotFoundError
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.roof_surface import RoofSurfaceInput, RoofSurfaceRead, RoofSurfaceWithLayout
from app.services import panel_layout_service, roof_surface_service

router = APIRouter(prefix="/projects/{project_id}/roof-surfaces", tags=["roof surfaces"])


def not_found(error: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail={"code": "roof_surface_not_found", "message": "Roof surface not found."},
    )


def serialize(surface):
    layout = surface.panel_layout
    return {
        **RoofSurfaceRead.model_validate(surface).model_dump(),
        "panel_layout": panel_layout_service.saved_layout_response(layout, surface)
        if layout
        else None,
    }


@router.get("", response_model=list[RoofSurfaceWithLayout])
async def list_surfaces(
    project_id: UUID, current_user: CurrentUserDependency, session: SessionDependency
):
    try:
        surfaces = await roof_surface_service.list_surfaces(session, project_id, current_user.id)
        return [serialize(surface) for surface in surfaces]
    except ProjectNotFoundError as error:
        raise not_found(error) from error


@router.post("", response_model=RoofSurfaceRead, status_code=status.HTTP_201_CREATED)
async def create_surface(
    project_id: UUID,
    data: RoofSurfaceInput,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await roof_surface_service.create_surface(session, project_id, current_user.id, data)
    except ProjectNotFoundError as error:
        raise not_found(error) from error


@router.get("/{surface_id}", response_model=RoofSurfaceWithLayout)
async def read_surface(
    project_id: UUID,
    surface_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return serialize(
            await roof_surface_service.get_surface(session, project_id, surface_id, current_user.id)
        )
    except (ProjectNotFoundError, RoofSurfaceNotFoundError) as error:
        raise not_found(error) from error


@router.put("/{surface_id}", response_model=RoofSurfaceRead)
async def update_surface(
    project_id: UUID,
    surface_id: UUID,
    data: RoofSurfaceInput,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await roof_surface_service.update_surface(
            session, project_id, surface_id, current_user.id, data
        )
    except (ProjectNotFoundError, RoofSurfaceNotFoundError) as error:
        raise not_found(error) from error


@router.delete("/{surface_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_surface(
    project_id: UUID,
    surface_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        await roof_surface_service.delete_surface(session, project_id, surface_id, current_user.id)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except (ProjectNotFoundError, RoofSurfaceNotFoundError) as error:
        raise not_found(error) from error
