from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import settings

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


async def init_db():
    from models.provider import Provider  # noqa
    from models.request_log import RequestLog  # noqa
    from models.settings import AppSettings  # noqa
    from models.api_token import ApiToken  # noqa
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _migrate_db()


async def _migrate_db():
    """Add new columns to existing tables without dropping data."""
    from sqlalchemy import text
    new_columns = [
        ("app_settings", "default_currency", "VARCHAR(8) DEFAULT 'USD'"),
        ("app_settings", "usd_to_toman_rate", "FLOAT DEFAULT 0.0"),
        ("app_settings", "proxy_base_url", "VARCHAR(512) DEFAULT ''"),
        ("app_settings", "require_proxy_auth", "BOOLEAN DEFAULT 0"),
        ("providers", "last_test_at", "DATETIME"),
        ("providers", "last_test_ok", "BOOLEAN"),
        ("providers", "last_test_message", "VARCHAR(256)"),
        ("providers", "last_test_latency_ms", "INTEGER"),
        ("request_logs", "route", "VARCHAR(256)"),
    ]
    async with engine.connect() as conn:
        for table, col, definition in new_columns:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {definition}"))
                await conn.commit()
            except Exception:
                pass  # column already exists
