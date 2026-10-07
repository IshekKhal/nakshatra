"""Application configuration and environment settings."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    """Typed application settings loaded from environment or root .env file."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE_PATH if _ENV_FILE_PATH.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    TABPFN_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ELEVENLABS_API_KEY: str = ""
    SENTRY_DSN: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
