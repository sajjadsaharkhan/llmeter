from pydantic_settings import BaseSettings
from pydantic import Field
import secrets
import base64


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./llmeter.db"
    jwt_secret: str = Field(default_factory=lambda: secrets.token_hex(32))
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    admin_username: str = "admin"
    admin_password: str = "changeme"
    encryption_key: str = Field(
        default_factory=lambda: base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
    )
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    class Config:
        env_file = [".env", "../.env"]
        env_file_encoding = "utf-8"


settings = Settings()
