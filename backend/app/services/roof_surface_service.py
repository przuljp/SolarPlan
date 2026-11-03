from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import RoofSurfaceNotFoundError
from app.models.roof_surface import RoofSurface
from app.repositories import roof_surface_repository
from app.schemas.roof_surface import RoofSurfaceInput
from app.services import project_service

GEOMETRY_FIELDS = {
    "shape_type",
    "bottom_width_m",
    "top_width_m",
    "top_offset_m",
    "length_m",
    "edge_margin_m",
    "panel_gap_m",
}


async def list_surfaces(
    session: AsyncSession, project_id: UUID, owner_id: UUID
) -> list[RoofSurface]:
    await project_service.get_project(session, project_id, owner_id)
    return await roof_surface_repository.list_by_project(session, project_id)


async def get_surface(
    session: AsyncSession, project_id: UUID, surface_id: UUID, owner_id: UUID
) -> RoofSurface:
    await project_service.get_project(session, project_id, owner_id)
    surface = await roof_surface_repository.get_by_id_for_project(session, surface_id, project_id)
    if surface is None:
        raise RoofSurfaceNotFoundError
    return surface


async def create_surface(
    session: AsyncSession, project_id: UUID, owner_id: UUID, data: RoofSurfaceInput
) -> RoofSurface:
    await project_service.get_project(session, project_id, owner_id)
    surface = RoofSurface(project_id=project_id, **data.model_dump())
    roof_surface_repository.add(session, surface)
    await session.commit()
    await session.refresh(surface)
    return surface


async def update_surface(
    session: AsyncSession,
    project_id: UUID,
    surface_id: UUID,
    owner_id: UUID,
    data: RoofSurfaceInput,
) -> RoofSurface:
    surface = await get_surface(session, project_id, surface_id, owner_id)
    values = data.model_dump()
    geometry_changed = any(
        getattr(surface, field) != values[field] for field in GEOMETRY_FIELDS
    )
    for field, value in values.items():
        setattr(surface, field, value)
    if geometry_changed and surface.panel_layout is not None:
        surface.panel_layout = None
    await session.commit()
    await session.refresh(surface)
    return surface


async def delete_surface(
    session: AsyncSession, project_id: UUID, surface_id: UUID, owner_id: UUID
) -> None:
    surface = await get_surface(session, project_id, surface_id, owner_id)
    await roof_surface_repository.delete(session, surface)
    await session.commit()