import threading
import time
from datetime import datetime, timedelta, timezone

from app.database import SessionLocal
from app.models import SyncRun
from app.services import sync as sync_service


def _login(client):
    client.post("/auth/login", json={"username": "admin", "password": "admin-password"})


def _wait_for_sync_to_finish(provider: str, timeout: float = 2.0) -> SyncRun:
    deadline = time.time() + timeout
    while time.time() < deadline:
        db = SessionLocal()
        try:
            run = (
                db.query(SyncRun)
                .filter(SyncRun.provider == provider)
                .order_by(SyncRun.started_at.desc())
                .first()
            )
            if run and run.status != "running":
                return run
        finally:
            db.close()
        time.sleep(0.05)
    raise AssertionError(f"sync for {provider} did not finish within {timeout}s")


def test_trigger_starts_background_sync(client, monkeypatch):
    monkeypatch.setattr(sync_service, "PROVIDER_FETCHERS", {"aws": lambda s, e: [], "oci": lambda s, e: []})
    _login(client)

    response = client.post("/api/sync/trigger", params={"provider": "aws"})

    assert response.status_code == 202
    assert response.json()["status"] == "started"
    run = _wait_for_sync_to_finish("aws")
    assert run.status == "success"


def test_trigger_rejected_while_running(client, monkeypatch):
    started = threading.Event()
    release = threading.Event()

    def slow_aws(start, end):
        started.set()
        release.wait(timeout=2)
        return []

    monkeypatch.setattr(sync_service, "PROVIDER_FETCHERS", {"aws": slow_aws, "oci": lambda s, e: []})
    _login(client)

    first = client.post("/api/sync/trigger", params={"provider": "aws"})
    assert first.status_code == 202
    assert started.wait(timeout=2)

    second = client.post("/api/sync/trigger", params={"provider": "aws"})
    assert second.status_code == 409

    release.set()
    _wait_for_sync_to_finish("aws")


def test_trigger_allowed_after_previous_finishes(client, monkeypatch):
    monkeypatch.setattr(sync_service, "PROVIDER_FETCHERS", {"aws": lambda s, e: [], "oci": lambda s, e: []})
    _login(client)

    first = client.post("/api/sync/trigger", params={"provider": "aws"})
    assert first.status_code == 202
    _wait_for_sync_to_finish("aws")

    second = client.post("/api/sync/trigger", params={"provider": "aws"})
    assert second.status_code == 202
    _wait_for_sync_to_finish("aws")


def test_trigger_invalid_provider_rejected(client):
    _login(client)
    response = client.post("/api/sync/trigger", params={"provider": "gcp"})
    assert response.status_code == 400


def test_logs_empty_history(client):
    _login(client)
    response = client.get("/api/sync/logs", params={"provider": "oci"})
    assert response.status_code == 200
    assert response.json() == []


def test_logs_ordering_and_limit(client, db_session):
    base = datetime.now(timezone.utc)
    for i in range(25):
        db_session.add(
            SyncRun(
                provider="aws",
                started_at=base - timedelta(minutes=i),
                finished_at=base - timedelta(minutes=i) + timedelta(seconds=1),
                status="success",
                records_synced=i,
            )
        )
    db_session.commit()

    _login(client)
    response = client.get("/api/sync/logs", params={"provider": "aws"})

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 20
    assert body[0]["records_synced"] == 0
    assert body[-1]["records_synced"] == 19
