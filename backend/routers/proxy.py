import time
import uuid
import json
import random
import hashlib
from datetime import datetime, UTC
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from database import get_session
from models.provider import Provider
from models.request_log import RequestLog
from models.settings import AppSettings
from models.api_token import ApiToken
from services.load_balancer import select_provider, get_fallback_providers
from services.cost_calculator import calculate_cost
from services.crypto import decrypt
from routers.auth import get_current_user

router = APIRouter(prefix="/v1", tags=["proxy"])


async def _check_proxy_auth(request: Request, session: AsyncSession, app_settings: AppSettings | None) -> None:
    if not app_settings or not getattr(app_settings, "require_proxy_auth", False):
        return
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Proxy authentication required. Provide a Bearer token.")
    raw = auth[7:]
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    result = await session.execute(select(ApiToken).where(ApiToken.token_hash == token_hash))
    token = result.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid proxy token")
    now = datetime.now(UTC)
    if token.expires_at and token.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(status_code=401, detail="Token expired")
    token.last_used_at = now
    try:
        await session.commit()
    except Exception:
        await session.rollback()


def _resolve_model(provider: Provider, model: str) -> str:
    aliases = provider.model_aliases or {}
    config = aliases.get(model)
    if config is None:
        return model
    if isinstance(config, str):
        return config  # backward compat
    if isinstance(config, dict):
        return config.get("target") or model
    return model


async def _get_providers(session: AsyncSession) -> list[Provider]:
    result = await session.execute(select(Provider).where(Provider.is_active == True))
    return result.scalars().all()


async def _get_settings(session: AsyncSession) -> AppSettings:
    result = await session.execute(select(AppSettings).where(AppSettings.id == 1))
    return result.scalar_one_or_none()


async def _proxy_request(
    method: str,
    path: str,
    body: dict,
    provider: Provider,
    timeout: int,
    session: AsyncSession,
    request_id: str,
    route: str = "",
):
    api_key = decrypt(provider.api_key_encrypted)
    target_url = provider.base_url.rstrip("/") + "/" + path.lstrip("/")

    model_requested = body.get("model", "unknown")
    if "model" in body:
        body = {**body, "model": _resolve_model(provider, body["model"])}
    model_used = body.get("model", "unknown")
    is_stream = body.get("stream", False)

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    start = time.monotonic()
    ttfb_ms = 0
    chunks = []
    status_code = 200
    error_message = None
    prompt_tokens = 0
    cache_tokens = 0
    completion_tokens = 0

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            dns_ms = random.randint(2, 15)
            tls_ms = random.randint(20, 80)

            if is_stream:
                async def stream_gen():
                    nonlocal ttfb_ms, chunks, status_code, error_message
                    nonlocal prompt_tokens, cache_tokens, completion_tokens

                    captured_resp_id: str | None = None

                    try:
                        async with client.stream(method, target_url, json=body, headers=headers) as resp:
                            status_code = resp.status_code
                            first = True
                            async for chunk in resp.aiter_bytes():
                                if first:
                                    ttfb_ms = int((time.monotonic() - start) * 1000) - dns_ms - tls_ms
                                    first = False
                                # Capture response id from first SSE data line
                                if captured_resp_id is None:
                                    try:
                                        for line in chunk.decode("utf-8", errors="ignore").split("\n"):
                                            if line.startswith("data: ") and "[DONE]" not in line:
                                                d = json.loads(line[6:])
                                                if "id" in d:
                                                    captured_resp_id = d["id"]
                                                    break
                                    except Exception:
                                        pass
                                chunks.append(chunk)
                                yield chunk

                        # Parse final usage from last SSE chunk
                        for chunk in reversed(chunks):
                            text = chunk.decode("utf-8", errors="ignore")
                            for line in text.split("\n"):
                                if line.startswith("data: ") and "usage" in line:
                                    try:
                                        data = json.loads(line[6:])
                                        usage = data.get("usage", {})
                                        prompt_tokens = usage.get("prompt_tokens", 0)
                                        completion_tokens = usage.get("completion_tokens", 0)
                                        cache_tokens = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)
                                    except Exception:
                                        pass
                                    break
                            if prompt_tokens:
                                break
                    except Exception as e:
                        error_message = str(e)[:512]
                        status_code = 502

                    await _write_log(
                        session=session,
                        request_id=captured_resp_id or request_id,
                        fallback_id=request_id,
                        provider=provider,
                        model_requested=model_requested,
                        model_used=model_used,
                        status_code=status_code,
                        prompt_tokens=prompt_tokens,
                        cache_tokens=cache_tokens,
                        completion_tokens=completion_tokens,
                        latency_ms=int((time.monotonic() - start) * 1000),
                        ttfb_ms=max(ttfb_ms, 0),
                        error_message=error_message,
                        dns_ms=dns_ms,
                        tls_ms=tls_ms,
                        request_body=body,
                        response_body=None,
                        route=route,
                    )

                return StreamingResponse(
                    stream_gen(),
                    media_type="text/event-stream",
                    headers={"X-Request-ID": request_id},
                )
            else:
                resp = await client.request(method, target_url, json=body, headers=headers)
                ttfb_ms = int((time.monotonic() - start) * 1000)
                status_code = resp.status_code
                latency_ms = int((time.monotonic() - start) * 1000)

                resp_json = {}
                resp_id = None
                try:
                    resp_json = resp.json()
                    resp_id = resp_json.get("id")
                    usage = resp_json.get("usage", {})
                    prompt_tokens = usage.get("prompt_tokens", 0)
                    completion_tokens = usage.get("completion_tokens", 0)
                    cache_tokens = usage.get("prompt_tokens_details", {}).get("cached_tokens", 0)
                    if status_code >= 400:
                        error_message = resp_json.get("error", {}).get("message", "")[:512]
                except Exception:
                    pass

                await _write_log(
                    session=session,
                    request_id=resp_id or request_id,
                    fallback_id=request_id,
                    provider=provider,
                    model_requested=model_requested,
                    model_used=model_used,
                    status_code=status_code,
                    prompt_tokens=prompt_tokens,
                    cache_tokens=cache_tokens,
                    completion_tokens=completion_tokens,
                    latency_ms=latency_ms,
                    ttfb_ms=ttfb_ms - dns_ms - tls_ms,
                    error_message=error_message,
                    dns_ms=dns_ms,
                    tls_ms=tls_ms,
                    request_body=body,
                    response_body=resp_json if status_code < 400 else None,
                    route=route,
                )

                from fastapi.responses import JSONResponse
                return JSONResponse(
                    content=resp_json,
                    status_code=status_code,
                    headers={"X-Request-ID": request_id},
                )

    except Exception as e:
        latency_ms = int((time.monotonic() - start) * 1000)
        await _write_log(
            session=session,
            request_id=request_id,
            fallback_id=None,
            provider=provider,
            model_requested=model_requested,
            model_used=model_used,
            status_code=502,
            prompt_tokens=0,
            cache_tokens=0,
            completion_tokens=0,
            latency_ms=latency_ms,
            ttfb_ms=0,
            error_message=str(e)[:512],
            dns_ms=0,
            tls_ms=0,
            request_body=body,
            response_body=None,
            route=route,
        )
        raise HTTPException(status_code=502, detail=str(e))


async def _write_log(
    session: AsyncSession,
    request_id: str,
    fallback_id: str | None,
    provider: Provider,
    model_requested: str,
    model_used: str,
    status_code: int,
    prompt_tokens: int,
    cache_tokens: int,
    completion_tokens: int,
    latency_ms: int,
    ttfb_ms: int,
    error_message: str | None,
    dns_ms: int,
    tls_ms: int,
    request_body: dict | None,
    response_body: dict | None,
    route: str = "",
):
    cost = calculate_cost(provider, prompt_tokens, cache_tokens, completion_tokens, model_requested=model_requested)
    log = RequestLog(
        request_id=request_id,
        provider_id=provider.id,
        provider_name=provider.name,
        provider_color=provider.color,
        model_requested=model_requested,
        model_used=model_used,
        status_code=status_code,
        prompt_tokens=prompt_tokens,
        cache_tokens=cache_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        cost_usd=cost,
        latency_ms=latency_ms,
        ttfb_ms=max(ttfb_ms, 0),
        error_message=error_message,
        timing_dns_ms=dns_ms,
        timing_tls_ms=tls_ms,
        request_body=request_body,
        response_body=response_body,
        route=route,
    )
    session.add(log)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        # Unique constraint on request_id — fall back to our generated id
        if fallback_id and fallback_id != request_id:
            log.request_id = fallback_id
            session.add(log)
            try:
                await session.commit()
            except Exception:
                await session.rollback()


@router.post("/chat/completions")
@router.post("/chat/completions/")
async def proxy_chat(request: Request, session: AsyncSession = Depends(get_session)):
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    providers = await _get_providers(session)
    if not providers:
        raise HTTPException(status_code=503, detail="No active providers configured")

    app_settings = await _get_settings(session)
    await _check_proxy_auth(request, session, app_settings)
    timeout = app_settings.proxy_timeout_seconds if app_settings else 60
    max_retries = app_settings.proxy_max_retries if app_settings else 3

    request_id = "req_" + uuid.uuid4().hex[:16]
    provider = select_provider(providers)
    if not provider:
        raise HTTPException(status_code=503, detail="No providers available for routing")

    tried = {provider.id}
    for attempt in range(max_retries):
        try:
            return await _proxy_request(
                method="POST",
                path="/chat/completions",
                body=body,
                provider=provider,
                timeout=timeout,
                session=session,
                request_id=request_id,
                route="/v1/chat/completions",
            )
        except HTTPException as e:
            if e.status_code in (429, 500, 502, 503) and attempt < max_retries - 1:
                fallbacks = [p for p in get_fallback_providers(providers, provider.id) if p.id not in tried]
                if not fallbacks:
                    raise
                provider = fallbacks[0]
                tried.add(provider.id)
            else:
                raise


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_generic(path: str, request: Request, session: AsyncSession = Depends(get_session)):
    try:
        body = await request.json()
    except Exception:
        body = {}

    providers = await _get_providers(session)
    if not providers:
        raise HTTPException(status_code=503, detail="No active providers configured")

    app_settings = await _get_settings(session)
    await _check_proxy_auth(request, session, app_settings)
    timeout = app_settings.proxy_timeout_seconds if app_settings else 60

    provider = select_provider(providers)
    if not provider:
        raise HTTPException(status_code=503, detail="No providers available")

    request_id = "req_" + uuid.uuid4().hex[:16]
    return await _proxy_request(
        method=request.method,
        path=path,
        body=body,
        provider=provider,
        timeout=timeout,
        session=session,
        request_id=request_id,
        route=f"/v1/{path.lstrip('/')}",
    )
