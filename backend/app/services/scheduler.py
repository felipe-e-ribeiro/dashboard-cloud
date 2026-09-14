from apscheduler.schedulers.background import BackgroundScheduler

from ..database import SessionLocal
from .fx import sync_fx_rates
from .sync import sync_all

scheduler = BackgroundScheduler()


def run_weekly_cost_sync() -> None:
    """AWS Cost Explorer bills per API call -- kept weekly (not daily) to
    control that cost. OCI's Usage API has no equivalent per-call charge, but
    runs on the same schedule since sync_all() already treats both providers
    as one unit. Use POST /api/sync/trigger for an on-demand sync between
    scheduled runs."""
    db = SessionLocal()
    try:
        sync_all(db)
    finally:
        db.close()


def run_daily_fx_sync() -> None:
    """USD->BRL rate lookup is a free API, unrelated to the AWS Cost Explorer
    billing concern above -- kept daily so displayed conversions stay
    accurate even between weekly cost syncs."""
    db = SessionLocal()
    try:
        sync_fx_rates(db)
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(
        run_weekly_cost_sync, "cron", day_of_week="sun", hour=3, minute=0, id="weekly_cost_sync", replace_existing=True
    )
    scheduler.add_job(run_daily_fx_sync, "cron", hour=3, minute=0, id="daily_fx_sync", replace_existing=True)
    scheduler.start()
