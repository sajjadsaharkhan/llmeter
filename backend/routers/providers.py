from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_session
from models.provider import Provider
from routers.auth import get_current_user
from services.crypto import encrypt, decrypt, mask_key

router = APIRouter(prefix="/api/providers", tags=["providers"])

COLORS = ["violet", "teal", "amber", "sky", "rose", "zinc"]


class ProviderCreate(BaseModel):
    name: str
    base_url: str
    api_key: str
    model_aliases: dict = {}
    cost_input_per_1m: float = 0.0
    cost_cache_per_1m: float = 0.0
    cost_output_per_1m: float = 0.0
    weight: int = 50
    is_active: bool = True
    color: Optional[str] = None


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_aliases: Optional[dict] = None
    cost_input_per_1m: Optional[float] = None
    cost_cache_per_1m: Optional[float] = None
    cost_output_per_1m: Optional[float] = None
    weight: Optional[int] = None
    is_active: Optional[bool] = None
    color: Optional[str] = None


class ProviderResponse(BaseModel):
    id: int
    name: str
    base_url: str
    key_mask: str
    model_aliases: dict
    cost_input_per_1m: float
    cost_cache_per_1m: float
    cost_output_per_1m: float
    weight: int
    is_active: bool
    color: str
    created_at: datetime
    updated_at: datetime
    last_test_at: Optional[datetime] = None
    last_test_ok: Optional[bool] = None
    last_test_message: Optional[str] = None
    last_test_latency_ms: Optional[int] = None

    class Config:
        from_attributes = True


def _to_response(p: Provider) -> ProviderResponse:
    try:
        raw_key = decrypt(p.api_key_encrypted)
        key_mask = mask_key(raw_key)
    except Exception:
        key_mask = "sk-...****"
    return ProviderResponse(
        id=p.id, name=p.name, base_url=p.base_url, key_mask=key_mask,
        model_aliases=p.model_aliases or {},
        cost_input_per_1m=p.cost_input_per_1m, cost_cache_per_1m=p.cost_cache_per_1m,
        cost_output_per_1m=p.cost_output_per_1m, weight=p.weight, is_active=p.is_active,
        color=p.color, created_at=p.created_at, updated_at=p.updated_at,
        last_test_at=p.last_test_at, last_test_ok=p.last_test_ok,
        last_test_message=p.last_test_message, last_test_latency_ms=p.last_test_latency_ms,
    )


@router.get("", response_model=list[ProviderResponse])
async def list_providers(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(Provider).order_by(Provider.created_at))
    return [_to_response(p) for p in result.scalars().all()]


@router.post("", response_model=ProviderResponse, status_code=201)
async def create_provider(
    body: ProviderCreate,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    # Assign color based on count
    result = await session.execute(select(Provider))
    count = len(result.scalars().all())
    color = body.color or COLORS[count % len(COLORS)]

    provider = Provider(
        name=body.name,
        base_url=body.base_url.rstrip("/"),
        api_key_encrypted=encrypt(body.api_key),
        model_aliases=body.model_aliases,
        cost_input_per_1m=body.cost_input_per_1m,
        cost_cache_per_1m=body.cost_cache_per_1m,
        cost_output_per_1m=body.cost_output_per_1m,
        weight=body.weight,
        is_active=body.is_active,
        color=color,
    )
    session.add(provider)
    await session.commit()
    await session.refresh(provider)
    return _to_response(provider)


@router.get("/{provider_id}", response_model=ProviderResponse)
async def get_provider(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(Provider).where(Provider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    return _to_response(p)


@router.patch("/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: int,
    body: ProviderUpdate,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(Provider).where(Provider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "api_key":
            p.api_key_encrypted = encrypt(value)
        else:
            setattr(p, field, value)

    from datetime import datetime, UTC
    p.updated_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(p)
    return _to_response(p)


@router.delete("/{provider_id}", status_code=204)
async def delete_provider(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(Provider).where(Provider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    await session.delete(p)
    await session.commit()


class TestResponse(BaseModel):
    ok: bool
    message: str
    latency_ms: Optional[int] = None


@router.post("/{provider_id}/test", response_model=TestResponse)
async def test_provider(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    import httpx, time
    from datetime import datetime, UTC
    result = await session.execute(select(Provider).where(Provider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        api_key = decrypt(p.api_key_encrypted)
    except Exception:
        return TestResponse(ok=False, message="Could not decrypt API key")

    url = p.base_url.rstrip("/") + "/models"
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code < 400:
            try:
                data = resp.json()
                model_count = len(data.get("data", []))
            except Exception:
                model_count = 0
            msg = f"Connected. {model_count} models available."
            p.last_test_at = datetime.now(UTC)
            p.last_test_ok = True
            p.last_test_message = msg
            p.last_test_latency_ms = latency
            await session.commit()
            return TestResponse(ok=True, message=msg, latency_ms=latency)
        else:
            msg = f"HTTP {resp.status_code}: {resp.text[:120]}"
            p.last_test_at = datetime.now(UTC)
            p.last_test_ok = False
            p.last_test_message = msg
            p.last_test_latency_ms = latency
            await session.commit()
            return TestResponse(ok=False, message=msg, latency_ms=latency)
    except Exception as e:
        msg = str(e)[:120]
        p.last_test_at = datetime.now(UTC)
        p.last_test_ok = False
        p.last_test_message = msg
        p.last_test_latency_ms = None
        await session.commit()
        return TestResponse(ok=False, message=msg)


@router.get("/{provider_id}/models")
async def list_provider_models(
    provider_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    import httpx
    result = await session.execute(select(Provider).where(Provider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        api_key = decrypt(p.api_key_encrypted)
    except Exception:
        return {"models": []}

    url = p.base_url.rstrip("/") + "/models"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {api_key}"})
        if resp.status_code < 400:
            data = resp.json()
            models = sorted([m.get("id", "") for m in data.get("data", []) if m.get("id")])
            return {"models": models}
    except Exception:
        pass
    return {"models": []}
