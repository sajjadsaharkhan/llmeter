from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, UTC

from database import get_session
from models.request_log import RequestLog
from models.settings import AppSettings
from routers.auth import get_current_user

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _to_display(usd: float, currency: str, rate: float) -> float:
    if currency == "IRT" and rate > 0:
        return round(usd * rate, 2)
    return round(usd, 6)


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
    currency: str
    total_requests: int
    total_cost: float
    avg_cost: float
    avg_latency_ms: float
    p95_latency_ms: float
    avg_ttfb_ms: float
    p95_ttfb_ms: float
    error_rate: float
    error_count: int
    total_tokens: int
    total_prompt_tokens: int
    total_completion_tokens: int
    total_cache_tokens: int
    delta_requests: float
    delta_cost: float
    delta_latency: float
    delta_ttfb: float
    delta_error_rate: float
    by_provider: list[ProviderStat]
    by_model: list[ModelStat]
    cost_over_time: list[DailyBucket]


async def _fetch_period_stats(session: AsyncSession, f: datetime, t: datetime) -> dict:
    agg_row = (await session.execute(
        select(
            func.count().label("total"),
            func.sum(case((RequestLog.status_code.between(200, 299), 1), else_=0)).label("ok"),
            func.sum(RequestLog.cost_usd).label("total_cost"),
            func.avg(RequestLog.latency_ms).label("avg_lat"),
            func.avg(RequestLog.ttfb_ms).label("avg_ttfb"),
            func.sum(RequestLog.prompt_tokens).label("total_prompt"),
            func.sum(RequestLog.completion_tokens).label("total_completion"),
            func.sum(RequestLog.cache_tokens).label("total_cache"),
            func.sum(RequestLog.total_tokens).label("total_tokens"),
        ).select_from(RequestLog).where(RequestLog.created_at >= f, RequestLog.created_at <= t)
    )).one()

    n = agg_row.total or 0
    ok = agg_row.ok or 0

    lat_rows = (await session.execute(
        select(RequestLog.latency_ms, RequestLog.ttfb_ms)
        .where(RequestLog.created_at >= f, RequestLog.created_at <= t, RequestLog.latency_ms > 0)
        .order_by(RequestLog.latency_ms)
    )).all()

    lats = [r.latency_ms for r in lat_rows]
    ttfbs = sorted(r.ttfb_ms for r in lat_rows if r.ttfb_ms > 0)
    p95_lat = lats[int(len(lats) * 0.95)] if lats else 0
    p95_ttfb = ttfbs[int(len(ttfbs) * 0.95)] if ttfbs else 0

    return {
        "n": n, "ok": ok, "err": n - ok,
        "cost": agg_row.total_cost or 0.0,
        "avg_lat": agg_row.avg_lat or 0.0,
        "p95_lat": p95_lat,
        "avg_ttfb": agg_row.avg_ttfb or 0.0,
        "p95_ttfb": p95_ttfb,
        "err_rate": ((n - ok) / n * 100) if n else 0.0,
        "total_tokens": agg_row.total_tokens or 0,
        "total_prompt": agg_row.total_prompt or 0,
        "total_completion": agg_row.total_completion or 0,
        "total_cache": agg_row.total_cache or 0,
    }


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

    # Fetch currency settings for display conversion
    settings = (await session.execute(
        select(AppSettings).where(AppSettings.id == 1)
    )).scalar_one_or_none()
    currency = (settings.default_currency or "USD") if settings else "USD"
    rate = (settings.usd_to_toman_rate or 0.0) if settings else 0.0
    dc = lambda usd: _to_display(usd, currency, rate)

    period_len = to_time - from_time
    prev_from = from_time - period_len
    prev_to = from_time

    cur = await _fetch_period_stats(session, from_time, to_time)
    prev = await _fetch_period_stats(session, prev_from, prev_to)

    def delta(a, b):
        if b == 0:
            return 0.0
        return round((a - b) / b * 100, 2)

    # By provider — GROUP BY
    provider_rows = (await session.execute(
        select(
            RequestLog.provider_name,
            RequestLog.provider_color,
            func.count().label("count"),
            func.sum(RequestLog.cost_usd).label("cost"),
        )
        .where(RequestLog.created_at >= from_time, RequestLog.created_at <= to_time)
        .group_by(RequestLog.provider_name, RequestLog.provider_color)
        .order_by(func.sum(RequestLog.cost_usd).desc())
    )).all()

    by_provider = [
        ProviderStat(
            provider_name=r.provider_name,
            provider_color=r.provider_color,
            count=r.count,
            cost=dc(r.cost or 0),
        )
        for r in provider_rows
    ]

    # By model — GROUP BY
    model_rows = (await session.execute(
        select(
            RequestLog.model_used,
            func.count().label("count"),
            func.sum(RequestLog.cost_usd).label("cost"),
        )
        .where(RequestLog.created_at >= from_time, RequestLog.created_at <= to_time)
        .group_by(RequestLog.model_used)
        .order_by(func.count().desc())
    )).all()

    by_model = [
        ModelStat(
            model=r.model_used,
            count=r.count,
            cost=dc(r.cost or 0),
            avg_cost=dc((r.cost or 0) / r.count) if r.count else 0,
        )
        for r in model_rows
    ]

    # Daily buckets — GROUP BY date
    bucket_rows = (await session.execute(
        select(
            func.strftime("%Y-%m-%d", RequestLog.created_at).label("day"),
            func.sum(RequestLog.cost_usd).label("cost"),
            func.count().label("requests"),
            func.sum(RequestLog.prompt_tokens).label("prompt"),
            func.sum(RequestLog.cache_tokens).label("cache"),
            func.sum(RequestLog.completion_tokens).label("completion"),
        )
        .where(RequestLog.created_at >= from_time, RequestLog.created_at <= to_time)
        .group_by(func.strftime("%Y-%m-%d", RequestLog.created_at))
        .order_by(func.strftime("%Y-%m-%d", RequestLog.created_at))
    )).all()

    cost_over_time = [
        DailyBucket(
            date=r.day,
            cost=dc(r.cost or 0),
            requests=r.requests,
            prompt_tokens=r.prompt or 0,
            cache_tokens=r.cache or 0,
            completion_tokens=r.completion or 0,
        )
        for r in bucket_rows
    ]

    return Summary(
        currency=currency,
        total_requests=cur["n"],
        total_cost=dc(cur["cost"]),
        avg_cost=dc(cur["cost"] / cur["n"]) if cur["n"] else 0,
        avg_latency_ms=round(cur["avg_lat"], 1),
        p95_latency_ms=round(cur["p95_lat"], 1),
        avg_ttfb_ms=round(cur["avg_ttfb"], 1),
        p95_ttfb_ms=round(cur["p95_ttfb"], 1),
        error_rate=round(cur["err_rate"], 2),
        error_count=cur["err"],
        total_tokens=cur["total_tokens"],
        total_prompt_tokens=cur["total_prompt"],
        total_completion_tokens=cur["total_completion"],
        total_cache_tokens=cur["total_cache"],
        delta_requests=delta(cur["n"], prev["n"]),
        delta_cost=delta(cur["cost"], prev["cost"]),
        delta_latency=delta(cur["avg_lat"], prev["avg_lat"]),
        delta_ttfb=delta(cur["avg_ttfb"], prev["avg_ttfb"]),
        delta_error_rate=delta(cur["err_rate"], prev["err_rate"]),
        by_provider=by_provider,
        by_model=by_model,
        cost_over_time=cost_over_time,
    )
