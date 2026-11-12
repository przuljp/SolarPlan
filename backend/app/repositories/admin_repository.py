from uuid import UUID

from sqlalchemy import Text, cast, exists, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.configuration_optimization import ConfigurationOptimization
from app.models.energy_simulation import EnergySimulation
from app.models.panel_layout import PanelLayout
from app.models.project import Project
from app.models.solar_panel import SolarPanel
from app.models.user import User


async def lock_user_management(session: AsyncSession) -> None:
    # Serialize deactivations and CLI promotion, including concurrent administrators.
    await session.execute(text("SELECT pg_advisory_xact_lock(736521901)"))


async def active_admin_count(session: AsyncSession) -> int:
    return (
        await session.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "ADMIN", User.is_active.is_(True))
        )
        or 0
    )


async def users_page(session: AsyncSession, email: str, offset: int, limit: int) -> dict:
    predicate = func.lower(User.email).contains(email.lower(), autoescape=True)
    total = await session.scalar(select(func.count()).select_from(User).where(predicate))
    project_count = (
        select(func.count(Project.id))
        .where(Project.user_id == User.id)
        .correlate(User)
        .scalar_subquery()
    )
    rows = (
        await session.execute(
            select(User, project_count.label("project_count"))
            .where(predicate)
            .order_by(User.created_at.desc(), User.id)
            .offset(offset)
            .limit(limit)
        )
    ).all()
    return {"items": rows, "total": total, "offset": offset, "limit": limit}


async def statistics(session: AsyncSession) -> dict:
    # A single statement gives all cards the same database snapshot.
    result = await session.execute(
        select(
            select(func.count()).select_from(User).scalar_subquery().label("total_users"),
            select(func.count())
            .select_from(User)
            .where(User.is_active.is_(True))
            .scalar_subquery()
            .label("active_users"),
            select(func.count()).select_from(Project).scalar_subquery().label("total_projects"),
            select(func.count()).select_from(SolarPanel).scalar_subquery().label("panel_models"),
        )
    )
    return dict(result.mappings().one())


async def locked_panel(session: AsyncSession, panel_id: UUID) -> SolarPanel | None:
    return (
        await session.execute(select(SolarPanel).where(SolarPanel.id == panel_id).with_for_update())
    ).scalar_one_or_none()


async def panel_is_referenced(session: AsyncSession, panel_id: UUID) -> bool:
    # Historical JSON snapshots deliberately have no FK; protect these too.
    marker = str(panel_id)
    return bool(
        await session.scalar(
            select(
                or_(
                    exists().where(PanelLayout.solar_panel_id == panel_id),
                    exists().where(cast(EnergySimulation.input_snapshot, Text).contains(marker)),
                    exists().where(
                        cast(ConfigurationOptimization.candidates, Text).contains(marker)
                    ),
                    exists().where(
                        cast(ConfigurationOptimization.rejected_candidates, Text).contains(marker)
                    ),
                )
            )
        )
    )


def add_panel(session: AsyncSession, panel: SolarPanel) -> None:
    session.add(panel)


async def delete_panel(session: AsyncSession, panel: SolarPanel) -> None:
    await session.delete(panel)
