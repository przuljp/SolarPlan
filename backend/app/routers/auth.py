from fastapi import APIRouter, HTTPException, Response, status

from app.core.config import settings
from app.core.exceptions import EmailAlreadyRegisteredError, InvalidCredentialsError
from app.core.security import create_access_token
from app.dependencies.auth import CurrentUserDependency, SessionDependency
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.error import ErrorResponse
from app.schemas.user import UserRead
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        status.HTTP_409_CONFLICT: {
            "model": ErrorResponse,
            "description": "The e-mail address is already registered.",
        }
    },
)
async def register(data: RegisterRequest, session: SessionDependency) -> UserRead:
    try:
        user = await auth_service.register_user(session, data)
    except EmailAlreadyRegisteredError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "email_already_registered",
                "message": "An account with this e-mail already exists.",
            },
        ) from error
    return UserRead.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "The e-mail/password combination is invalid.",
        }
    },
)
async def login(data: LoginRequest, session: SessionDependency) -> TokenResponse:
    try:
        user = await auth_service.authenticate_user(session, data)
    except InvalidCredentialsError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_credentials", "message": "Invalid e-mail or password."},
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    return TokenResponse(
        access_token=create_access_token(user.id),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "A valid Bearer token is required.",
        }
    },
)
async def logout(_: CurrentUserDependency) -> Response:
    """Confirm logout after the client discards its stateless access token."""
    return Response(status_code=status.HTTP_204_NO_CONTENT)

