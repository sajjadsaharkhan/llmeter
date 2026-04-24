import secrets
import hashlib
from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from database import get_session
from models.api_token import ApiToken
from routers.auth import get_current_user

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


class TokenCreate(BaseModel):
    name: str
    expires_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    id: int
    name: str
    token_prefix: str
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


class TokenCreateResponse(TokenResponse):
    token: str


@router.get("", response_model=list[TokenResponse])
async def list_tokens(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(ApiToken).order_by(ApiToken.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=TokenCreateResponse, status_code=201)
async def create_token(
    body: TokenCreate,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    raw = "sk-lm-" + secrets.token_hex(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    token_prefix = raw[:14]  # "sk-lm-" + 8 chars

    token = ApiToken(
        name=body.name,
        token_hash=token_hash,
        token_prefix=token_prefix,
        expires_at=body.expires_at,
    )
    session.add(token)
    await session.commit()
    await session.refresh(token)

    return TokenCreateResponse(
        id=token.id,
        name=token.name,
        token_prefix=token.token_prefix,
        created_at=token.created_at,
        expires_at=token.expires_at,
        last_used_at=token.last_used_at,
        token=raw,
    )


@router.delete("/{token_id}", status_code=204)
async def revoke_token(
    token_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(ApiToken).where(ApiToken.id == token_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Token not found")
    await session.delete(t)
    await session.commit()
