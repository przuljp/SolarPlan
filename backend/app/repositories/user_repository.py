from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_by_email(session: AsyncSession, email: str) -> User | None:
    statement = select(User).where(func.lower(User.email) == email.lower())
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: UUID) -> User | None:
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    return result.scalar_one_or_none()


def add(session: AsyncSession, user: User) -> None:
    session.add(user)

