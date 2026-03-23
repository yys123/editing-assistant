from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    gemini_api_key: str
    cors_origins: str = "http://localhost:5173"
    gemini_model: str = "gemini-3-flash-preview"
    jwt_secret: str = "editing-assistant-secret-change-in-production"
    jwt_expire_days: int = 7

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
