from fastapi import APIRouter, status

from app.dependencies.auth import CurrentUserDependency
from app.schemas.error import ErrorResponse
from app.schemas.user import UserRead

router = APIRouter(
    prefix="/users",
    tags=["users"],
    responses={
        status.HTTP_401_UNAUTHORIZED: {
            "model": ErrorResponse,
            "description": "A valid Bearer token is required.",
        }
    },
)


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUserDependency) -> UserRead:
    return UserRead.model_validate(current_user)

