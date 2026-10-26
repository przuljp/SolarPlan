from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://solarplan:solarplan@localhost:5432/solarplan"
    cors_origins: list[str] = ["http://localhost:5173"]
    jwt_secret: SecretStr = SecretStr("local-development-secret-change-before-deployment")
    access_token_expire_minutes: int = 30
    jwt_issuer: str = "solarplan-api"
    jwt_audience: str = "solarplan-frontend"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="SOLARPLAN_",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


