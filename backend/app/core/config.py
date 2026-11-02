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
    geocoding_base_url: str = "https://nominatim.openstreetmap.org"
    geocoding_user_agent: str = "SolarPlan/0.1 (https://github.com/przuljp/SolarPlan)"
    geocoding_referer: str = "https://github.com/przuljp/SolarPlan"
    geocoding_timeout_seconds: float = 10.0
    geocoding_min_interval_seconds: float = 1.0
    geocoding_cache_ttl_seconds: int = 3600

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
