from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: EmailStr
    role: Literal["USER", "ADMIN"] = "USER"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

