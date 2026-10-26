from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import InvalidAccessTokenError
from app.core.security import decode_access_token
from app.db.session import get_db_session
from app.models.user import User
from app.repositories import user_repository

bearer_scheme = HTTPBearer(auto_error=False)
SessionDependency = Annotated[AsyncSession, Depends(get_db_session)]
CredentialsDependency = Annotated[
    HTTPAuthorizationCredentials | None,
    Depends(bearer_scheme),
]


async def get_current_user(
    session: SessionDependency,
    credentials: CredentialsDependency,
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "invalid_token", "message": "Authentication is required."},
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        user_id = decode_access_token(credentials.credentials)
    except InvalidAccessTokenError as error:
        raise unauthorized from error

    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise unauthorized
    return user


CurrentUserDependency = Annotated[User, Depends(get_current_user)]

