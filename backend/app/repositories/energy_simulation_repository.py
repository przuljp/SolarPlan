from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.energy_simulation import EnergySimulation, PvgisCacheEntry


async def get_cache_entry(
    session: AsyncSession,
    cache_key: str,
) -> PvgisCacheEntry | None:
    return await session.get(PvgisCacheEntry, cache_key)


def add_cache_entry(session: AsyncSession, entry: PvgisCacheEntry) -> None:
    session.add(entry)


def add_simulation(session: AsyncSession, simulation: EnergySimulation) -> None:
    session.add(simulation)


async def get_latest(
    session: AsyncSession,
    project_id: UUID,
) -> EnergySimulation | None:
    result = await session.execute(
        select(EnergySimulation)
        .where(EnergySimulation.project_id == project_id)
        .order_by(EnergySimulation.created_at.desc(), EnergySimulation.id.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def list_by_project(
    session: AsyncSession,
    project_id: UUID,
) -> list[EnergySimulation]:
    result = await session.execute(
        select(EnergySimulation)
        .where(EnergySimulation.project_id == project_id)
        .order_by(EnergySimulation.created_at.desc(), EnergySimulation.id.desc())
    )
    return list(result.scalars().all())


async def get_by_id(
    session: AsyncSession,
    project_id: UUID,
    simulation_id: UUID,
) -> EnergySimulation | None:
    result = await session.execute(
        select(EnergySimulation).where(
            EnergySimulation.id == simulation_id,
            EnergySimulation.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()
