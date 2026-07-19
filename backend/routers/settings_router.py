import time
from urllib.parse import urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
import os

from config import settings as app_config
from database import get_session
from models.settings import AppSettings
from routers.auth import get_current_user


def _db_size_bytes() -> int:
    # Strip driver prefix: "sqlite+aiosqlite:///./data/llmeter.db" → "./data/llmeter.db"
    path = app_config.database_url.split("///", 1)[-1]
    try:
        return os.path.getsize(path)
    except OSError:
        return 0

router = APIRouter(prefix="/api/settings", tags=["settings"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SettingsResponse(BaseModel):
    admin_username: str
    proxy_timeout_seconds: int
    proxy_max_retries: int
    proxy_retry_backoff: str
    log_retention_days: int
    default_currency: str
    usd_to_toman_rate: float
    proxy_base_url: str
    db_size_bytes: int
    http_proxy_enabled: bool
    http_proxy_url: str
    http_proxy_username: str
    http_proxy_password: str


class SettingsUpdate(BaseModel):
    proxy_timeout_seconds: Optional[int] = None
    proxy_max_retries: Optional[int] = None
    proxy_retry_backoff: Optional[str] = None
    log_retention_days: Optional[int] = None
    default_currency: Optional[str] = None
    usd_to_toman_rate: Optional[float] = None
    proxy_base_url: Optional[str] = None
    http_proxy_enabled: Optional[bool] = None
    http_proxy_url: Optional[str] = None
    http_proxy_username: Optional[str] = None
    http_proxy_password: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProxyTestRequest(BaseModel):
    http_proxy_url: str
    http_proxy_username: Optional[str] = ""
    http_proxy_password: Optional[str] = ""


class ProxyTestResponse(BaseModel):
    ok: bool
    message: str
    latency_ms: Optional[int] = None


@router.get("", response_model=SettingsResponse)
async def get_settings(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=500, detail="Settings not initialised")
    return SettingsResponse(
        admin_username=s.admin_username,
        proxy_timeout_seconds=s.proxy_timeout_seconds,
        proxy_max_retries=s.proxy_max_retries,
        proxy_retry_backoff=s.proxy_retry_backoff,
        log_retention_days=s.log_retention_days,
        default_currency=s.default_currency or "USD",
        usd_to_toman_rate=s.usd_to_toman_rate or 0.0,
        proxy_base_url=s.proxy_base_url or "",
        db_size_bytes=_db_size_bytes(),
        http_proxy_enabled=bool(s.http_proxy_enabled),
        http_proxy_url=s.http_proxy_url or "",
        http_proxy_username=s.http_proxy_username or "",
        http_proxy_password=s.http_proxy_password or "",
    )


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=500, detail="Settings not initialised")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(s, field, value)

    await session.commit()
    await session.refresh(s)
    return SettingsResponse(
        admin_username=s.admin_username,
        proxy_timeout_seconds=s.proxy_timeout_seconds,
        proxy_max_retries=s.proxy_max_retries,
        proxy_retry_backoff=s.proxy_retry_backoff,
        log_retention_days=s.log_retention_days,
        default_currency=s.default_currency or "USD",
        usd_to_toman_rate=s.usd_to_toman_rate or 0.0,
        proxy_base_url=s.proxy_base_url or "",
        db_size_bytes=_db_size_bytes(),
        http_proxy_enabled=bool(s.http_proxy_enabled),
        http_proxy_url=s.http_proxy_url or "",
        http_proxy_username=s.http_proxy_username or "",
        http_proxy_password=s.http_proxy_password or "",
    )


@router.post("/password", status_code=204)
async def change_password(
    body: PasswordChange,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=500, detail="Settings not initialised")

    if not pwd_context.verify(body.current_password, s.admin_password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    s.admin_password_hash = pwd_context.hash(body.new_password)
    await session.commit()


@router.post("/test-proxy", response_model=ProxyTestResponse)
async def test_proxy(
    body: ProxyTestRequest,
    _: str = Depends(get_current_user),
):
    import httpx

    url = (body.http_proxy_url or "").strip()
    if not url:
        return ProxyTestResponse(ok=False, message="Proxy URL is empty")

    username = (body.http_proxy_username or "").strip()
    password = (body.http_proxy_password or "").strip()
    if username:
        parsed = urlparse(url)
        netloc = f"{username}:{password}@{parsed.hostname}"
        if parsed.port:
            netloc += f":{parsed.port}"
        url = urlunparse((parsed.scheme, netloc, parsed.path, "", "", ""))

    start = time.monotonic()
    try:
        async with httpx.AsyncClient(proxy=url, timeout=10) as client:
            resp = await client.get("https://www.google.com")
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code < 400:
            return ProxyTestResponse(ok=True, message=f"Connected via proxy — HTTP {resp.status_code}", latency_ms=latency)
        return ProxyTestResponse(ok=False, message=f"Proxy returned HTTP {resp.status_code}", latency_ms=latency)
    except Exception as e:
        latency = int((time.monotonic() - start) * 1000)
        return ProxyTestResponse(ok=False, message=str(e)[:200], latency_ms=latency)
