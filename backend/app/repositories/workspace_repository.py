from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.models.energy_simulation import EnergySimulation
from app.models.panel_layout import PanelLayout
from app.models.project import Project
from app.models.roof_surface import RoofSurface


def workspace_statement(owner_id: UUID, project_id: UUID | None = None):
    statement = (
        select(Project)
        .where(Project.user_id == owner_id)
        .options(
            selectinload(Project.location),
            selectinload(Project.roof_surfaces)
            .selectinload(RoofSurface.panel_layout)
            .selectinload(PanelLayout.solar_panel),
        )
        .order_by(Project.updated_at.desc(), Project.id.desc())
    )
    return statement.where(Project.id == project_id) if project_id else statement


async def load_workspace(session, owner_id, project_id=None):
    projects = list(
        (await session.execute(workspace_statement(owner_id, project_id))).scalars().all()
    )
    if not projects:
        return [], {}
    ranked = (
        select(
            EnergySimulation.id,
            func.row_number()
            .over(
                partition_by=EnergySimulation.project_id,
                order_by=(EnergySimulation.created_at.desc(), EnergySimulation.id.desc()),
            )
            .label("rank"),
        )
        .where(EnergySimulation.project_id.in_([p.id for p in projects]))
        .subquery()
    )
    simulations = (
        (
            await session.execute(
                select(EnergySimulation)
                .join(ranked, ranked.c.id == EnergySimulation.id)
                .where(ranked.c.rank == 1)
            )
        )
        .scalars()
        .all()
    )
    return projects, {s.project_id: s for s in simulations}
