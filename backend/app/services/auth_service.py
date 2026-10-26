from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError
from app.core.security import DUMMY_PASSWORD_HASH, hash_password, verify_password
from app.models.user import User
from app.repositories import user_repository
from app.schemas.auth import LoginRequest, RegisterRequest


async def register_user(session: AsyncSession, data: RegisterRequest) -> User:
    existing_user = await user_repository.get_by_email(session, data.email)
    if existing_user is not None:
        raise EmailAlreadyRegisteredError

    user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    user_repository.add(session, user)

    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise EmailAlreadyRegisteredError from error

    await session.refresh(user)
    return user


async def authenticate_user(session: AsyncSession, data: LoginRequest) -> User:
    user = await user_repository.get_by_email(session, data.email)
    encoded_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_is_valid = verify_password(data.password, encoded_hash)

    if user is None or not password_is_valid:
        raise InvalidCredentialsError

    return user

