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
    pvgis_base_url: str = "https://re.jrc.ec.europa.eu/api/v5_3"
    pvgis_version: str = "5.3"
    pvgis_timeout_seconds: float = 20.0
    pvgis_max_retries: int = 2
    pvgis_retry_backoff_seconds: float = 0.5
    pvgis_default_system_loss_percent: float = 14.0
    pvgis_max_system_loss_percent: float = 30.0
    openai_api_key: SecretStr = SecretStr("")
    openai_model: str = "gpt-5-mini"
    openai_timeout_seconds: float = 60.0
    openai_max_output_tokens: int = 4000

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
