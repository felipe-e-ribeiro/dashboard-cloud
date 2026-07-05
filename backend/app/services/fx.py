import bisect
from datetime import date, timedelta

import httpx
from sqlalchemy.orm import Session

from ..models import ExchangeRate
from .periods import months_ago_start

FX_API_URL = "https://api.frankfurter.dev/v1"
FX_BASE_CURRENCY = "USD"
FX_QUOTE_CURRENCY = "BRL"
FX_LOOKBACK_DAYS = 10


def _missing_range(db: Session, today: date) -> tuple[date, date] | None:
    latest = db.query(ExchangeRate.date).order_by(ExchangeRate.date.desc()).first()
    start = months_ago_start(6, today) if latest is None else latest[0] + timedelta(days=1)
    if start > today:
        return None
    return start, today


def sync_fx_rates(db: Session, today: date | None = None) -> None:
    """Backfills/updates exchange_rates up to `today`, fetching only the missing range
    in a single request. Never raises: a failure here must not block cost sync, the
    daily scheduler, or app startup (same isolation as sync_provider)."""
    today = today or date.today()
    try:
        missing = _missing_range(db, today)
        if missing is None:
            return
        start, end = missing

        response = httpx.get(
            f"{FX_API_URL}/{start.isoformat()}..{end.isoformat()}",
            params={"from": FX_BASE_CURRENCY, "to": FX_QUOTE_CURRENCY},
            timeout=10.0,
            follow_redirects=True,
        )
        response.raise_for_status()
        rates_by_date = response.json().get("rates", {})

        for date_str, values in rates_by_date.items():
            rate = values.get(FX_QUOTE_CURRENCY)
            if rate is None:
                continue
            usage_date = date.fromisoformat(date_str)
            existing = db.query(ExchangeRate).filter(ExchangeRate.date == usage_date).first()
            if existing:
                existing.rate = rate
            else:
                db.add(ExchangeRate(date=usage_date, rate=rate))
        db.commit()
    except Exception:  # noqa: BLE001 - fx sync failures must never propagate to the caller
        db.rollback()


def convert_to_brl(db: Session, rows: list[tuple[date, float]]) -> list[tuple[date, float]]:
    """Converts a list of (usage_date, amount_usd) rows to (usage_date, amount_brl), using
    each day's own exchange rate, or the most recent earlier one (carry-forward) when a
    day has no published rate. Days with no applicable rate at all convert to 0."""
    if not rows:
        return []

    start = min(usage_date for usage_date, _ in rows)
    end = max(usage_date for usage_date, _ in rows)
    lookback_start = start - timedelta(days=FX_LOOKBACK_DAYS)

    rate_rows = (
        db.query(ExchangeRate.date, ExchangeRate.rate)
        .filter(ExchangeRate.date >= lookback_start, ExchangeRate.date <= end)
        .order_by(ExchangeRate.date)
        .all()
    )
    known_dates = [rate_date for rate_date, _ in rate_rows]
    known_rates = [float(rate) for _, rate in rate_rows]

    converted: list[tuple[date, float]] = []
    for usage_date, amount in rows:
        idx = bisect.bisect_right(known_dates, usage_date) - 1
        rate = known_rates[idx] if idx >= 0 else None
        converted.append((usage_date, amount * rate if rate is not None else 0.0))
    return converted
