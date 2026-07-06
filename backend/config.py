from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    admin_emails: str = ""
    text_model_provider: str = "gemini"
    gemini_api_key: str
    cors_origins: str = "http://localhost:5177"
    gemini_model: str = "gemini-3-flash-preview"
    gemini_context_window_tokens: int = 1000000
    gemini_proxy: str = ""
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_temperature: float = 0.7
    deepseek_top_p: float = 1.0
    deepseek_max_tokens: int = 0
    deepseek_context_window_tokens: int = 64000
    deepseek_thinking_type: str = "enabled"
    deepseek_reasoning_effort: str = "high"
    jwt_secret: str = "editing-assistant-secret-change-in-production"
    jwt_expire_days: int = 7
    guide_app_id: str = ""
    guide_app_sign_key: str = ""
    guide_app_name: str = ""
    guide_api_base: str = "https://newdrugs.dxy.cn/open-sign-api/article-quality/guide"
    ncd_api_base: str = "https://newdrugs.dxy.cn/open-sign-api/article-quality/ncd"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
