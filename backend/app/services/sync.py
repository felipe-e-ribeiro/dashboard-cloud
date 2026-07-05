import threading
from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import CostRecord, SyncRun
from . import aws_cost, oci_cost
from .periods import period_range

PROVIDER_FETCHERS = {
    "aws": aws_cost.fetch_daily_costs_by_service,
    "oci": oci_cost.fetch_daily_costs_by_service,
}


def _has_existing_records(db: Session, provider: str) -> bool:
    return db.query(CostRecord.id).filter(CostRecord.provider == provider).first() is not None


def _backfill_start(today: date) -> date:
    start, _ = period_range("last_6_months", today)
    return start


def upsert_cost_records(db: Session, provider: str, rows: list[dict]) -> int:
    now = datetime.now(timezone.utc)
    count = 0
    for row in rows:
        existing = (
            db.query(CostRecord)
            .filter(
                CostRecord.provider == provider,
                CostRecord.service_name == row["service_name"],
                CostRecord.usage_date == row["usage_date"],
            )
            .first()
        )
        if existing:
            existing.amount = row["amount"]
            existing.currency = row["currency"]
            existing.synced_at = now
        else:
            db.add(
                CostRecord(
                    provider=provider,
                    service_name=row["service_name"],
                    usage_date=row["usage_date"],
                    amount=row["amount"],
                    currency=row["currency"],
                    synced_at=now,
                )
            )
        count += 1
    db.commit()
    return count


def sync_provider(db: Session, provider: str, today: date | None = None) -> SyncRun:
    today = today or date.today()
    run = SyncRun(
        provider=provider,
        started_at=datetime.now(timezone.utc),
        status="running",
        records_synced=0,
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        start = _backfill_start(today) if not _has_existing_records(db, provider) else today
        fetcher = PROVIDER_FETCHERS[provider]
        rows = fetcher(start, today)
        run.records_synced = upsert_cost_records(db, provider, rows)
        run.status = "success"
        run.error_message = None
    except Exception as exc:  # noqa: BLE001 - a provider failure must never crash the other sync or the job
        run.status = "failed"
        # OCI's ServiceError.__str__ dumps its whole attribute dict; prefer the plain .message when present.
        run.error_message = getattr(exc, "message", None) or str(exc)

    run.finished_at = datetime.now(timezone.utc)
    db.commit()
    return run


def sync_all(db: Session, today: date | None = None) -> list[SyncRun]:
    return [sync_provider(db, provider, today) for provider in PROVIDER_FETCHERS]


def is_sync_running(db: Session, provider: str) -> bool:
    return (
        db.query(SyncRun.id)
        .filter(SyncRun.provider == provider, SyncRun.status == "running", SyncRun.finished_at.is_(None))
        .first()
        is not None
    )


SYNC_TRIGGER_THREAD_NAME = "cost-sync-trigger"


def trigger_sync_background(provider: str) -> None:
    """Runs sync_provider() for a provider on its own thread/session, outside the request lifecycle."""

    def _run() -> None:
        db = SessionLocal()
        try:
            sync_provider(db, provider)
        finally:
            db.close()

    threading.Thread(target=_run, daemon=True, name=SYNC_TRIGGER_THREAD_NAME).start()
