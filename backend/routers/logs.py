from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, case
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_session
from models.request_log import RequestLog
from models.settings import AppSettings
from routers.auth import get_current_user


def _to_display(usd: float, currency: str, rate: float) -> float:
    if currency == "IRT" and rate > 0:
        return round(usd * rate, 2)
    return round(usd, 6)

router = APIRouter(prefix="/api/logs", tags=["logs"])


class LogItem(BaseModel):
    id: int
    request_id: str
    provider_id: Optional[int]
    provider_name: str
    provider_color: str
    model_requested: str
    model_used: str
    status_code: int
    prompt_tokens: int
    cache_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    latency_ms: int
    ttfb_ms: int
    error_message: Optional[str]
    timing_dns_ms: int
    timing_tls_ms: int
    route: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LogDetail(LogItem):
    request_body: Optional[dict]
    response_body: Optional[dict]


class PaginatedLogs(BaseModel):
    items: list[LogItem]
    total: int
    page: int
    limit: int


class LogSummary(BaseModel):
    currency: str
    total_requests: int
    ok_requests: int
    error_requests: int
    error_rate: float
    total_cost: float
    avg_cost: float
    avg_latency_ms: float
    avg_ttfb_ms: float
    total_prompt_tokens: int
    total_completion_tokens: int
    total_cache_tokens: int
    total_tokens: int


class BulkSearchRequest(BaseModel):
    request_ids: list[str]


@router.get("/summary", response_model=LogSummary)
async def get_logs_summary(
    provider: Optional[str] = None,
    model: Optional[str] = None,
    status: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    settings = (await session.execute(
        select(AppSettings).where(AppSettings.id == 1)
    )).scalar_one_or_none()
    currency = (settings.default_currency or "USD") if settings else "USD"
    rate = (settings.usd_to_toman_rate or 0.0) if settings else 0.0
    dc = lambda usd: _to_display(usd, currency, rate)

    q = select(
        func.count().label("total_requests"),
        func.sum(
            case((RequestLog.status_code.between(200, 299), 1), else_=0)
        ).label("ok_requests"),
        func.sum(RequestLog.cost_usd).label("total_cost_usd"),
        func.avg(RequestLog.latency_ms).label("avg_latency_ms"),
        func.avg(RequestLog.ttfb_ms).label("avg_ttfb_ms"),
        func.sum(RequestLog.prompt_tokens).label("total_prompt_tokens"),
        func.sum(RequestLog.completion_tokens).label("total_completion_tokens"),
        func.sum(RequestLog.cache_tokens).label("total_cache_tokens"),
        func.sum(RequestLog.total_tokens).label("total_tokens"),
    ).select_from(RequestLog)

    if provider:
        q = q.where(RequestLog.provider_name == provider)
    if model:
        q = q.where(RequestLog.model_used == model)
    if status:
        if status == "2xx":
            q = q.where(RequestLog.status_code >= 200, RequestLog.status_code < 300)
        elif status == "4xx":
            q = q.where(RequestLog.status_code >= 400, RequestLog.status_code < 500)
        elif status == "5xx":
            q = q.where(RequestLog.status_code >= 500)
    if from_time:
        q = q.where(RequestLog.created_at >= from_time)
    if to_time:
        q = q.where(RequestLog.created_at <= to_time)
    if search:
        q = q.where(
            RequestLog.request_id.contains(search) | RequestLog.model_used.contains(search)
        )

    row = (await session.execute(q)).one()

    total = row.total_requests or 0
    ok = row.ok_requests or 0
    err = total - ok
    total_cost_usd = row.total_cost_usd or 0.0

    return LogSummary(
        currency=currency,
        total_requests=total,
        ok_requests=ok,
        error_requests=err,
        error_rate=round(err / total * 100, 2) if total > 0 else 0.0,
        total_cost=dc(total_cost_usd),
        avg_cost=dc(total_cost_usd / total) if total > 0 else 0.0,
        avg_latency_ms=round(row.avg_latency_ms or 0),
        avg_ttfb_ms=round(row.avg_ttfb_ms or 0),
        total_prompt_tokens=row.total_prompt_tokens or 0,
        total_completion_tokens=row.total_completion_tokens or 0,
        total_cache_tokens=row.total_cache_tokens or 0,
        total_tokens=row.total_tokens or 0,
    )


@router.get("", response_model=PaginatedLogs)
async def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    provider: Optional[str] = None,
    model: Optional[str] = None,
    status: Optional[str] = None,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    request_id: Optional[str] = None,
    search: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    q = select(RequestLog)

    if provider:
        q = q.where(RequestLog.provider_name == provider)
    if model:
        q = q.where(RequestLog.model_used == model)
    if status:
        if status == "2xx":
            q = q.where(RequestLog.status_code >= 200, RequestLog.status_code < 300)
        elif status == "4xx":
            q = q.where(RequestLog.status_code >= 400, RequestLog.status_code < 500)
        elif status == "5xx":
            q = q.where(RequestLog.status_code >= 500)
    if from_time:
        q = q.where(RequestLog.created_at >= from_time)
    if to_time:
        q = q.where(RequestLog.created_at <= to_time)
    if request_id:
        q = q.where(RequestLog.request_id == request_id)
    if search:
        q = q.where(
            RequestLog.request_id.contains(search) | RequestLog.model_used.contains(search)
        )

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await session.execute(count_q)
    total = total_result.scalar()

    q = q.order_by(RequestLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await session.execute(q)
    items = result.scalars().all()

    return PaginatedLogs(items=items, total=total, page=page, limit=limit)


@router.post("/search", response_model=PaginatedLogs)
async def bulk_search_logs(
    body: BulkSearchRequest,
    page: int = Query(1, ge=1),
    limit: int = Query(200, ge=1, le=1000),
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    ids = [rid.strip() for rid in body.request_ids if rid.strip()]
    if not ids:
        return PaginatedLogs(items=[], total=0, page=page, limit=limit)

    q = select(RequestLog).where(RequestLog.request_id.in_(ids))
    total = (await session.execute(select(func.count()).select_from(q.subquery()))).scalar()
    q = q.order_by(RequestLog.created_at.desc()).offset((page - 1) * limit).limit(limit)
    items = (await session.execute(q)).scalars().all()

    return PaginatedLogs(items=items, total=total, page=page, limit=limit)


@router.get("/distinct-models")
async def get_distinct_models(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    from sqlalchemy import distinct as sql_distinct
    result = await session.execute(
        select(sql_distinct(RequestLog.model_used)).where(RequestLog.model_used.isnot(None))
    )
    models = sorted([r[0] for r in result.fetchall() if r[0]])
    return {"models": models}


@router.get("/{log_id}", response_model=LogDetail)
async def get_log(
    log_id: int,
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    result = await session.execute(select(RequestLog).where(RequestLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.delete("", status_code=204)
async def clear_logs(
    session: AsyncSession = Depends(get_session),
    _: str = Depends(get_current_user),
):
    await session.execute(delete(RequestLog))
    await session.commit()
