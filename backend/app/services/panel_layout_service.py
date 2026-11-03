from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    InvalidPanelCountError,
    PanelLayoutNotFoundError,
    ProjectPanelMismatchError,
    SolarPanelNotFoundError,
)
from app.models.panel_layout import PanelLayout
from app.models.solar_panel import SolarPanel
from app.repositories import panel_layout_repository, solar_panel_repository
from app.schemas.panel_layout import LayoutRequest
from app.services import layout_engine, roof_surface_service


async def list_panels(session: AsyncSession) -> list[SolarPanel]:
    return await solar_panel_repository.list_all(session)


async def get_panel(session: AsyncSession, panel_id: UUID) -> SolarPanel:
    panel = await solar_panel_repository.get_by_id(session, panel_id)
    if panel is None:
        raise SolarPanelNotFoundError
    return panel


async def require_common_panel(session: AsyncSession, project_id: UUID, panel_id: UUID) -> None:
    layouts = await panel_layout_repository.list_by_project(session, project_id)
    if any(layout.solar_panel_id != panel_id for layout in layouts):
        raise ProjectPanelMismatchError


async def preview_layout(
    session: AsyncSession, project_id: UUID, surface_id: UUID, owner_id: UUID, data: LayoutRequest
) -> dict:
    surface = await roof_surface_service.get_surface(session, project_id, surface_id, owner_id)
    await require_common_panel(session, project_id, data.solar_panel_id)
    panel = await get_panel(session, data.solar_panel_id)
    try:
        calculation = layout_engine.calculate_layout(
            surface, panel, data.orientation, data.panel_count
        )
    except ValueError as error:
        raise InvalidPanelCountError from error
    return {"solar_panel": panel, **calculation}


async def get_saved_layout(
    session: AsyncSession, project_id: UUID, surface_id: UUID, owner_id: UUID
) -> dict:
    surface = await roof_surface_service.get_surface(session, project_id, surface_id, owner_id)
    layout = await panel_layout_repository.get_by_surface_id(session, surface_id)
    if layout is None:
        raise PanelLayoutNotFoundError
    return saved_layout_response(layout, surface)


async def save_layout(
    session: AsyncSession, project_id: UUID, surface_id: UUID, owner_id: UUID, data: LayoutRequest
) -> dict:
    preview = await preview_layout(session, project_id, surface_id, owner_id, data)
    layout = await panel_layout_repository.get_by_surface_id(session, surface_id)
    values = {
        "solar_panel_id": data.solar_panel_id,
        "orientation": preview["orientation"],
        "rows": preview["rows"],
        "columns": preview["columns"],
        "panel_count": preview["panel_count"],
        "installed_kwp": preview["installed_kwp"],
        "occupied_area_m2": preview["occupied_area_m2"],
        "utilization_percent": preview["utilization_percent"],
        "layout_json": preview["positions"],
    }
    if layout is None:
        layout = PanelLayout(project_id=project_id, roof_surface_id=surface_id, **values)
        panel_layout_repository.add(session, layout)
    else:
        for field, value in values.items():
            setattr(layout, field, value)
    await session.commit()
    await session.refresh(layout, attribute_names=["solar_panel"])
    surface = await roof_surface_service.get_surface(session, project_id, surface_id, owner_id)
    return saved_layout_response(layout, surface)


def saved_layout_response(layout: PanelLayout, surface) -> dict:
    calculation = layout_engine.calculate_layout(
        surface,
        layout.solar_panel,
        layout.orientation,
        layout.panel_count,
    )
    return {
        "id": layout.id,
        "project_id": layout.project_id,
        "roof_surface_id": layout.roof_surface_id,
        "solar_panel_id": layout.solar_panel_id,
        "solar_panel": layout.solar_panel,
        **calculation,
        "created_at": layout.created_at,
        "updated_at": layout.updated_at,
    }