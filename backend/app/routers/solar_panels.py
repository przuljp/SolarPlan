from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.exceptions import SolarPanelNotFoundError
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.solar_panel import SolarPanelRead
from app.services import panel_layout_service

router = APIRouter(prefix="/panels", tags=["solar panels"])


@router.get("", response_model=list[SolarPanelRead])
async def list_solar_panels(
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> list[SolarPanelRead]:
    panels = await panel_layout_service.list_panels(session)
    return [SolarPanelRead.model_validate(panel) for panel in panels]


@router.get("/{panel_id}", response_model=SolarPanelRead)
async def read_solar_panel(
    panel_id: UUID,
    current_user: CurrentUserDependency,
    session: SessionDependency,
) -> SolarPanelRead:
    try:
        panel = await panel_layout_service.get_panel(session, panel_id)
    except SolarPanelNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "solar_panel_not_found", "message": "Solar panel not found."},
        ) from error
    return SolarPanelRead.model_validate(panel)
