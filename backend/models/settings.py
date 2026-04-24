from sqlalchemy import String, Integer, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    admin_username: Mapped[str] = mapped_column(String(255), nullable=False)
    admin_password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    proxy_timeout_seconds: Mapped[int] = mapped_column(Integer, default=60)
    proxy_max_retries: Mapped[int] = mapped_column(Integer, default=3)
    proxy_retry_backoff: Mapped[str] = mapped_column(String(32), default="exponential")
    log_retention_days: Mapped[int] = mapped_column(Integer, default=30)
    default_currency: Mapped[str] = mapped_column(String(8), default="USD")
    usd_to_toman_rate: Mapped[float] = mapped_column(Float, default=0.0)
    proxy_base_url: Mapped[str] = mapped_column(String(512), default="")
    require_proxy_auth: Mapped[bool] = mapped_column(Boolean, default=False)
