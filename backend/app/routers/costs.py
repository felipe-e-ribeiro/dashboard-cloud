from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import CostRecord, SyncRun
from ..schemas import (
    BreakdownItem,
    CostBreakdown,
    CostSummary,
    ServiceTrend,
    ServiceTrendPoint,
    SyncRunOut,
    SyncStatus,
    SyncTriggerResponse,
    TrendPoint,
)
from ..services import fx
from ..services import provider_config
from ..services import sync as sync_service
from ..services.periods import VALID_PERIODS, months_ago_start, period_range, previous_period_range

SYNC_LOGS_LIMIT = 20
DEFAULT_SERVICE_TREND_MONTHS = 6

router = APIRouter(prefix="/api", tags=["costs"])

VALID_PROVIDERS = {"aws", "oci"}
VALID_CURRENCIES = {"usd", "brl"}


def _validate(provider: str, period: str, currency: str = "usd") -> None:
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=400, detail=f"Invalid period: {period}")
    if currency not in VALID_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Invalid currency: {currency}")


def _daily_totals(db: Session, provider: str, start, end) -> list[tuple]:
    return (
        db.query(CostRecord.usage_date, func.sum(CostRecord.amount))
        .filter(
            CostRecord.provider == provider,
            CostRecord.usage_date >= start,
            CostRecord.usage_date <= end,
        )
        .group_by(CostRecord.usage_date)
        .order_by(CostRecord.usage_date)
        .all()
    )


@router.get("/costs/summary", response_model=CostSummary)
def cost_summary(
    provider: str = Query(...),
    period: str = Query(...),
    currency: str = Query("usd"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    _validate(provider, period, currency)
    start, end = period_range(period)

    daily_rows = [(d, float(amount)) for d, amount in _daily_totals(db, provider, start, end)]
    previous_start, previous_end = previous_period_range(period)
    previous_daily_rows = [(d, float(amount)) for d, amount in _daily_totals(db, provider, previous_start, previous_end)]

    if currency == "brl":
        daily_rows = fx.convert_to_brl(db, daily_rows)
        previous_daily_rows = fx.convert_to_brl(db, previous_daily_rows)

    trend = [TrendPoint(usage_date=d, amount=amount) for d, amount in daily_rows]
    total = sum(point.amount for point in trend)
    previous_total = sum(amount for _, amount in previous_daily_rows)
    change_pct = ((total - previous_total) / previous_total * 100) if previous_total else None

    return CostSummary(
        provider=provider,
        period=period,
        currency=currency.upper(),
        total=total,
        previous_total=previous_total,
        change_pct=change_pct,
        trend=trend,
    )


@router.get("/costs/breakdown", response_model=CostBreakdown)
def cost_breakdown(
    provider: str = Query(...),
    period: str = Query(...),
    currency: str = Query("usd"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    _validate(provider, period, currency)
    start, end = period_range(period)

    rows = (
        db.query(CostRecord.usage_date, CostRecord.service_name, CostRecord.amount)
        .filter(
            CostRecord.provider == provider,
            CostRecord.usage_date >= start,
            CostRecord.usage_date <= end,
        )
        .all()
    )

    if currency == "brl":
        converted = fx.convert_to_brl(db, [(usage_date, float(amount)) for usage_date, _, amount in rows])
        rows = [
            (usage_date, service_name, converted_amount)
            for (usage_date, service_name, _), (_, converted_amount) in zip(rows, converted)
        ]

    totals_by_service: dict[str, float] = defaultdict(float)
    for _, service_name, amount in rows:
        totals_by_service[service_name] += float(amount)

    items = [
        BreakdownItem(service_name=service_name, amount=amount)
        for service_name, amount in sorted(totals_by_service.items(), key=lambda item: item[1], reverse=True)
    ]

    return CostBreakdown(provider=provider, period=period, currency=currency.upper(), items=items)


@router.get("/costs/service-trend", response_model=ServiceTrend)
def service_trend(
    provider: str = Query(...),
    service_name: str = Query(...),
    months: int = Query(DEFAULT_SERVICE_TREND_MONTHS),
    currency: str = Query("usd"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    if currency not in VALID_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Invalid currency: {currency}")

    start = months_ago_start(months)

    rows = (
        db.query(CostRecord.usage_date, CostRecord.amount)
        .filter(
            CostRecord.provider == provider,
            CostRecord.service_name == service_name,
            CostRecord.usage_date >= start,
        )
        .all()
    )
    daily_rows = [(usage_date, float(amount)) for usage_date, amount in rows]

    if currency == "brl":
        daily_rows = fx.convert_to_brl(db, daily_rows)

    totals_by_month: dict[str, float] = defaultdict(float)
    for usage_date, amount in daily_rows:
        month_key = f"{usage_date.year:04d}-{usage_date.month:02d}"
        totals_by_month[month_key] += amount

    points = [ServiceTrendPoint(month=month, amount=amount) for month, amount in sorted(totals_by_month.items())]

    return ServiceTrend(provider=provider, service_name=service_name, currency=currency.upper(), points=points)


@router.get("/sync/status", response_model=SyncStatus)
def sync_status(
    provider: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    run = (
        db.query(SyncRun)
        .filter(SyncRun.provider == provider)
        .order_by(SyncRun.started_at.desc())
        .first()
    )
    if run is None:
        return SyncStatus(provider=provider, status=None, started_at=None, finished_at=None, error_message=None)

    return SyncStatus(
        provider=provider,
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        error_message=run.error_message,
    )


@router.post("/sync/trigger", response_model=SyncTriggerResponse, status_code=202)
def sync_trigger(
    provider: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    if not provider_config.is_enabled(db, provider):
        raise HTTPException(status_code=400, detail=f"{provider} is not enabled")

    if sync_service.is_sync_running(db, provider):
        raise HTTPException(status_code=409, detail=f"A sync is already running for {provider}")

    sync_service.trigger_sync_background(provider)
    return SyncTriggerResponse(status="started")


@router.get("/sync/logs", response_model=list[SyncRunOut])
def sync_logs(
    provider: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    runs = (
        db.query(SyncRun)
        .filter(SyncRun.provider == provider)
        .order_by(SyncRun.started_at.desc())
        .limit(SYNC_LOGS_LIMIT)
        .all()
    )
    return runs
