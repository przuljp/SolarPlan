from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.configuration_optimization import ConfigurationOptimization


def add(session: AsyncSession, optimization: ConfigurationOptimization) -> None:
    session.add(optimization)


async def get_by_id_for_project(
    session: AsyncSession, optimization_id: UUID, project_id: UUID
) -> ConfigurationOptimization | None:
    result = await session.execute(
        select(ConfigurationOptimization).where(
            ConfigurationOptimization.id == optimization_id,
            ConfigurationOptimization.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def get_latest(
    session: AsyncSession, project_id: UUID
) -> ConfigurationOptimization | None:
    result = await session.execute(
        select(ConfigurationOptimization)
        .where(ConfigurationOptimization.project_id == project_id)
        .order_by(
            ConfigurationOptimization.created_at.desc(),
            ConfigurationOptimization.id.desc(),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()
