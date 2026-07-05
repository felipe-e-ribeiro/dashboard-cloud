from datetime import date, datetime, timezone

from app.models import CostRecord, SyncRun


def _login(client):
    client.post("/auth/login", json={"username": "admin", "password": "admin-password"})


def test_summary_requires_auth(client):
    response = client.get("/api/costs/summary", params={"provider": "aws", "period": "current_month"})
    assert response.status_code == 401


def test_summary_returns_total_and_trend(client, db_session):
    today = date.today()
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=12.5, currency="USD"))
    db_session.add(CostRecord(provider="aws", service_name="S3", usage_date=today, amount=2.5, currency="USD"))
    db_session.commit()

    _login(client)
    response = client.get("/api/costs/summary", params={"provider": "aws", "period": "current_month"})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 15.0
    assert len(body["trend"]) == 1


def test_breakdown_groups_by_service(client, db_session):
    today = date.today()
    db_session.add(CostRecord(provider="oci", service_name="Compute", usage_date=today, amount=8.0, currency="USD"))
    db_session.add(
        CostRecord(provider="oci", service_name="Object Storage", usage_date=today, amount=1.0, currency="USD")
    )
    db_session.commit()

    _login(client)
    response = client.get("/api/costs/breakdown", params={"provider": "oci", "period": "current_month"})

    assert response.status_code == 200
    items = {item["service_name"]: item["amount"] for item in response.json()["items"]}
    assert items == {"Compute": 8.0, "Object Storage": 1.0}


def test_summary_served_even_if_last_sync_failed(client, db_session):
    today = date.today()
    now = datetime.now(timezone.utc)
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=3.0, currency="USD"))
    db_session.add(SyncRun(provider="aws", started_at=now, finished_at=now, status="failed", error_message="boom"))
    db_session.commit()

    _login(client)
    response = client.get("/api/costs/summary", params={"provider": "aws", "period": "current_month"})

    assert response.status_code == 200
    assert response.json()["total"] == 3.0


def test_sync_status_reflects_last_run(client, db_session):
    now = datetime.now(timezone.utc)
    db_session.add(
        SyncRun(provider="aws", started_at=now, finished_at=now, status="success", records_synced=5)
    )
    db_session.commit()

    _login(client)
    response = client.get("/api/sync/status", params={"provider": "aws"})

    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_sync_status_with_no_runs_yet(client):
    _login(client)
    response = client.get("/api/sync/status", params={"provider": "oci"})

    assert response.status_code == 200
    assert response.json()["status"] is None


def test_invalid_provider_rejected(client):
    _login(client)
    response = client.get("/api/costs/summary", params={"provider": "gcp", "period": "current_month"})
    assert response.status_code == 400
