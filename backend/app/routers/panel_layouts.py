from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import (
    InvalidPanelCountError,
    PanelLayoutNotFoundError,
    ProjectNotFoundError,
    ProjectPanelMismatchError,
    RoofSurfaceNotFoundError,
    SolarPanelNotFoundError,
)
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.panel_layout import LayoutPreview, LayoutRequest, PanelLayoutRead
from app.services import panel_layout_service

router = APIRouter(
    prefix="/projects/{project_id}/roof-surfaces/{surface_id}/layout", tags=["panel layout"]
)


def layout_error(error: Exception) -> HTTPException:
    if isinstance(error, ProjectPanelMismatchError):
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "project_panel_mismatch",
                "message": "All roof surfaces in a project must use the same panel model.",
            },
        )
    if isinstance(error, InvalidPanelCountError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "invalid_panel_count", "message": "Panel count exceeds roof capacity."},
        )
    if isinstance(error, SolarPanelNotFoundError):
        message = "Solar panel not found."
    elif isinstance(error, PanelLayoutNotFoundError):
        message = "Saved panel layout not found."
    else:
        message = "Roof surface not found."
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail={"code": "not_found", "message": message}
    )


@router.post("/preview", response_model=LayoutPreview)
async def preview_panel_layout(
    project_id: UUID,
    surface_id: UUID,
    data: LayoutRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await panel_layout_service.preview_layout(
            session, project_id, surface_id, current_user.id, data
        )
    except (
        ProjectNotFoundError,
        RoofSurfaceNotFoundError,
        SolarPanelNotFoundError,
        InvalidPanelCountError,
        ProjectPanelMismatchError,
    ) as error:
        raise layout_error(error) from error


@router.get("", response_model=PanelLayoutRead)
async def read_panel_layout(
    project_id: UUID,
    surface_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await panel_layout_service.get_saved_layout(
            session, project_id, surface_id, current_user.id
        )
    except (ProjectNotFoundError, RoofSurfaceNotFoundError, PanelLayoutNotFoundError) as error:
        raise layout_error(error) from error


@router.put("", response_model=PanelLayoutRead)
async def save_panel_layout(
    project_id: UUID,
    surface_id: UUID,
    data: LayoutRequest,
    current_user: CurrentUserDependency,
    session: SessionDependency,
):
    try:
        return await panel_layout_service.save_layout(
            session, project_id, surface_id, current_user.id, data
        )
    except (
        ProjectNotFoundError,
        RoofSurfaceNotFoundError,
        SolarPanelNotFoundError,
        InvalidPanelCountError,
        ProjectPanelMismatchError,
    ) as error:
        raise layout_error(error) from error
