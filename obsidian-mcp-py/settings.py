from enum import Enum
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    obsidian_vault_path: Optional[str] = None
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False  # 환경 변수 대소문자 구분 안 함


def load_settings() -> Settings:
    return Settings()
