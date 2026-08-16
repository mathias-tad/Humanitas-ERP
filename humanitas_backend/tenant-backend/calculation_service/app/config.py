from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Admin Database (to fetch tenant connections and Redis settings)
    admin_database_url: str = "postgresql+asyncpg://user:pass@localhost:5432/admin_db"
    
    # Redis (Upstash) - will be fetched from admin DB settings
    redis_url: str | None = None
    
    # Service
    service_name: str = "calculation_service"
    debug: bool = False

    class Config:
        env_file = ".env"
        extra = "allow"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
