from sqlalchemy import String, Boolean, Integer, Float, JSON, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, UTC
from database import Base


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    api_key_encrypted: Mapped[str] = mapped_column(String(1024), nullable=False)
    model_aliases: Mapped[dict] = mapped_column(JSON, default=dict)
    cost_input_per_1m: Mapped[float] = mapped_column(Float, default=0.0)
    cost_cache_per_1m: Mapped[float] = mapped_column(Float, default=0.0)
    cost_output_per_1m: Mapped[float] = mapped_column(Float, default=0.0)
    weight: Mapped[int] = mapped_column(Integer, default=50)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(32), default="violet")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    last_test_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_test_ok: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_test_message: Mapped[str | None] = mapped_column(String(256), nullable=True)
    last_test_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    models_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
