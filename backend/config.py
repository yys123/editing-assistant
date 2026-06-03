from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    text_model_provider: str = "gemini"
    gemini_api_key: str
    cors_origins: str = "http://localhost:5177"
    gemini_model: str = "gemini-3-flash-preview"
    gemini_proxy: str = ""
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"
    jwt_secret: str = "editing-assistant-secret-change-in-production"
    jwt_expire_days: int = 7

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
