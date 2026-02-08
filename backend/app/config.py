from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://paperless:paperless@localhost:5432/paperless_lexoffice"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Paperless-ngx
    PAPERLESS_URL: str = "http://localhost:8000"
    PAPERLESS_TOKEN: str = ""

    # Lexoffice / Lexware Office
    LEXOFFICE_URL: str = "https://api.lexware.io"
    LEXOFFICE_API_KEY: str = ""

    # Encryption key for storing API keys in database (Fernet-compatible)
    ENCRYPTION_KEY: str = ""

    # Webhook secret for verifying incoming webhooks
    WEBHOOK_SECRET: str = ""

    # Application
    APP_TITLE: str = "Paperless-Lexoffice Middleware"
    APP_VERSION: str = "1.0.0"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    LOG_LEVEL: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
