from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import CostRecord, SyncRun
from ..schemas import (
    BreakdownItem,
    CostBreakdown,
    CostSummary,
    SyncRunOut,
    SyncStatus,
    SyncTriggerResponse,
    TrendPoint,
)
from ..services import sync as sync_service
from ..services.periods import VALID_PERIODS, period_range

SYNC_LOGS_LIMIT = 20

router = APIRouter(prefix="/api", tags=["costs"])

VALID_PROVIDERS = {"aws", "oci"}


def _validate(provider: str, period: str) -> None:
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    if period not in VALID_PERIODS:
        raise HTTPException(status_code=400, detail=f"Invalid period: {period}")


@router.get("/costs/summary", response_model=CostSummary)
def cost_summary(
    provider: str = Query(...),
    period: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    _validate(provider, period)
    start, end = period_range(period)

    rows = (
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
    trend = [TrendPoint(usage_date=usage_date, amount=float(amount)) for usage_date, amount in rows]
    total = sum(point.amount for point in trend)

    return CostSummary(provider=provider, period=period, currency="USD", total=total, trend=trend)


@router.get("/costs/breakdown", response_model=CostBreakdown)
def cost_breakdown(
    provider: str = Query(...),
    period: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    _validate(provider, period)
    start, end = period_range(period)

    rows = (
        db.query(CostRecord.service_name, func.sum(CostRecord.amount).label("total"))
        .filter(
            CostRecord.provider == provider,
            CostRecord.usage_date >= start,
            CostRecord.usage_date <= end,
        )
        .group_by(CostRecord.service_name)
        .order_by(func.sum(CostRecord.amount).desc())
        .all()
    )
    items = [BreakdownItem(service_name=service_name, amount=float(total)) for service_name, total in rows]

    return CostBreakdown(provider=provider, period=period, currency="USD", items=items)


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
