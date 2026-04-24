from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, UTC

from database import get_session
from models.request_log import RequestLog
from models.provider import Provider
from routers.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


class ProviderStat(BaseModel):
    provider_name: str
    provider_color: str
    count: int
    cost: float


class ModelStat(BaseModel):
    model: str
    count: int
    cost: float
    avg_cost: float


class DailyBucket(BaseModel):
    date: str
    cost: float
    requests: int
    prompt_tokens: int
    cache_tokens: int
    completion_tokens: int


class Summary(BaseModel):
    total_requests: int
    total_cost_usd: float
    avg_cost_per_req: float
    avg_latency_ms: float
    p95_latency_ms: float
    avg_ttfb_ms: float
    p95_ttfb_ms: float
    error_rate: float
    error_count: int
    delta_requests: float
    delta_cost: float
    delta_latency: float
    delta_ttfb: float
    delta_error_rate: float
    by_provider: list[ProviderStat]
    by_model: list[ModelStat]
    cost_over_time: list[DailyBucket]


@router.get("/summary", response_model=Summary)
async def get_summary(
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    now = datetime.now(UTC)
    if not to_time:
        to_time = now
    if not from_time:
        from_time = now - timedelta(days=30)

    period_len = to_time - from_time
    prev_from = from_time - period_len
    prev_to = from_time

    async def fetch_period(f, t):
        q = select(RequestLog).where(RequestLog.created_at >= f, RequestLog.created_at <= t)
        r = await session.execute(q)
        return r.scalars().all()

    current = await fetch_period(from_time, to_time)
    previous = await fetch_period(prev_from, prev_to)

    def compute_stats(rows):
        n = len(rows)
        ok = sum(1 for r in rows if 200 <= r.status_code < 300)
        err = n - ok
        cost = sum(r.cost_usd for r in rows)
        lats = [r.latency_ms for r in rows if r.latency_ms > 0]
        ttfbs = [r.ttfb_ms for r in rows if r.ttfb_ms > 0]
        avg_lat = sum(lats) / len(lats) if lats else 0
        avg_ttfb = sum(ttfbs) / len(ttfbs) if ttfbs else 0
        p95_lat = sorted(lats)[int(len(lats) * 0.95)] if lats else 0
        p95_ttfb = sorted(ttfbs)[int(len(ttfbs) * 0.95)] if ttfbs else 0
        return {"n": n, "ok": ok, "err": err, "cost": cost,
                "avg_lat": avg_lat, "p95_lat": p95_lat,
                "avg_ttfb": avg_ttfb, "p95_ttfb": p95_ttfb,
                "err_rate": (err / n * 100) if n else 0}

    cur = compute_stats(current)
    prev = compute_stats(previous)

    def delta(a, b):
        if b == 0:
            return 0.0
        return round((a - b) / b * 100, 2)

    # By provider
    by_provider: dict[str, dict] = {}
    for r in current:
        k = r.provider_name
        if k not in by_provider:
            by_provider[k] = {"count": 0, "cost": 0.0, "color": r.provider_color}
        by_provider[k]["count"] += 1
        by_provider[k]["cost"] += r.cost_usd
    provider_stats = [
        ProviderStat(provider_name=k, provider_color=v["color"], count=v["count"], cost=round(v["cost"], 6))
        for k, v in sorted(by_provider.items(), key=lambda x: -x[1]["cost"])
    ]

    # By model
    by_model: dict[str, dict] = {}
    for r in current:
        k = r.model_used
        if k not in by_model:
            by_model[k] = {"count": 0, "cost": 0.0}
        by_model[k]["count"] += 1
        by_model[k]["cost"] += r.cost_usd
    model_stats = [
        ModelStat(model=k, count=v["count"], cost=round(v["cost"], 6),
                  avg_cost=round(v["cost"] / v["count"], 8) if v["count"] else 0)
        for k, v in sorted(by_model.items(), key=lambda x: -x[1]["count"])
    ]

    # Daily buckets
    daily: dict[str, dict] = {}
    for r in current:
        day = r.created_at.strftime("%Y-%m-%d") if r.created_at else "unknown"
        if day not in daily:
            daily[day] = {"cost": 0.0, "requests": 0, "prompt": 0, "cache": 0, "completion": 0}
        daily[day]["cost"] += r.cost_usd
        daily[day]["requests"] += 1
        daily[day]["prompt"] += r.prompt_tokens
        daily[day]["cache"] += r.cache_tokens
        daily[day]["completion"] += r.completion_tokens

    cost_over_time = [
        DailyBucket(date=day, cost=round(v["cost"], 4), requests=v["requests"],
                    prompt_tokens=v["prompt"], cache_tokens=v["cache"], completion_tokens=v["completion"])
        for day, v in sorted(daily.items())
    ]

    return Summary(
        total_requests=cur["n"],
        total_cost_usd=round(cur["cost"], 4),
        avg_cost_per_req=round(cur["cost"] / cur["n"], 8) if cur["n"] else 0,
        avg_latency_ms=round(cur["avg_lat"], 1),
        p95_latency_ms=round(cur["p95_lat"], 1),
        avg_ttfb_ms=round(cur["avg_ttfb"], 1),
        p95_ttfb_ms=round(cur["p95_ttfb"], 1),
        error_rate=round(cur["err_rate"], 2),
        error_count=cur["err"],
        delta_requests=delta(cur["n"], prev["n"]),
        delta_cost=delta(cur["cost"], prev["cost"]),
        delta_latency=delta(cur["avg_lat"], prev["avg_lat"]),
        delta_ttfb=delta(cur["avg_ttfb"], prev["avg_ttfb"]),
        delta_error_rate=delta(cur["err_rate"], prev["err_rate"]),
        by_provider=provider_stats,
        by_model=model_stats,
        cost_over_time=cost_over_time,
    )
