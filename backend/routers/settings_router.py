from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext

from database import get_session
from models.settings import AppSettings
from routers.auth import get_current_user

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
    require_proxy_auth: bool


class SettingsUpdate(BaseModel):
    proxy_timeout_seconds: Optional[int] = None
    proxy_max_retries: Optional[int] = None
    proxy_retry_backoff: Optional[str] = None
    log_retention_days: Optional[int] = None
    default_currency: Optional[str] = None
    usd_to_toman_rate: Optional[float] = None
    proxy_base_url: Optional[str] = None
    require_proxy_auth: Optional[bool] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


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
        require_proxy_auth=bool(s.require_proxy_auth),
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
        require_proxy_auth=bool(s.require_proxy_auth),
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
