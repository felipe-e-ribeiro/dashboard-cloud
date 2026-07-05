import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_cloud_cost.db")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin-password")

import threading

import pytest
from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.services.sync import SYNC_TRIGGER_THREAD_NAME


def _join_background_sync_threads() -> None:
    # A previous test may have started a background sync (trigger_sync_background) that
    # outlives the test itself; join it before resetting tables to avoid it writing to a
    # schema that's mid-teardown.
    for thread in threading.enumerate():
        if thread.name == SYNC_TRIGGER_THREAD_NAME and thread.is_alive():
            thread.join(timeout=5)


@pytest.fixture()
def db_session():
    _join_background_sync_threads()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    with TestClient(app) as test_client:
        yield test_client
