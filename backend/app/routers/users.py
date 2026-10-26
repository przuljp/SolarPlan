from fastapi import APIRouter

from app.dependencies.auth import CurrentUserDependency
from app.schemas.user import UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: CurrentUserDependency) -> UserRead:
    return UserRead.model_validate(current_user)

