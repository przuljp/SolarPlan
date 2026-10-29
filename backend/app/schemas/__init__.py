from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.schemas.error import ErrorDetail, ErrorResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.roof_configuration import RoofConfigurationRead, RoofConfigurationUpsert
from app.schemas.user import UserRead

__all__ = [
    "ErrorDetail",
    "ErrorResponse",
    "LoginRequest",
    "ProjectCreate",
    "ProjectRead",
    "ProjectUpdate",
    "RegisterRequest",
    "RoofConfigurationRead",
    "RoofConfigurationUpsert",
    "TokenResponse",
    "UserRead",
]
