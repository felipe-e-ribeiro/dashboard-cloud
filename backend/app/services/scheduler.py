from apscheduler.schedulers.background import BackgroundScheduler

from ..database import SessionLocal
from .sync import sync_all

scheduler = BackgroundScheduler()


def run_daily_sync() -> None:
    db = SessionLocal()
    try:
        sync_all(db)
    finally:
        db.close()


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(run_daily_sync, "cron", hour=3, minute=0, id="daily_cost_sync", replace_existing=True)
    scheduler.start()
