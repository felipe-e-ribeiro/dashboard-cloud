from datetime import date, datetime, timedelta, timezone

from app.models import CostRecord, ExchangeRate, SyncRun


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


def test_summary_includes_previous_period_delta(client, db_session):
    from app.services.periods import previous_period_range

    today = date.today()
    _, previous_end = previous_period_range("current_month")
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=100.0, currency="USD"))
    db_session.add(
        CostRecord(provider="aws", service_name="EC2", usage_date=previous_end, amount=50.0, currency="USD")
    )
    db_session.commit()

    _login(client)
    response = client.get("/api/costs/summary", params={"provider": "aws", "period": "current_month"})

    body = response.json()
    assert body["total"] == 100.0
    assert body["previous_total"] == 50.0
    assert body["change_pct"] == 100.0


def test_summary_change_pct_null_without_previous_data(client, db_session):
    today = date.today()
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=10.0, currency="USD"))
    db_session.commit()

    _login(client)
    response = client.get("/api/costs/summary", params={"provider": "aws", "period": "current_month"})

    body = response.json()
    assert body["previous_total"] == 0.0
    assert body["change_pct"] is None


def test_summary_previous_period_delta_for_last_6_months(client, db_session):
    from app.services.periods import previous_period_range

    today = date.today()
    _, previous_end = previous_period_range("last_6_months")
    db_session.add(CostRecord(provider="oci", service_name="Compute", usage_date=today, amount=30.0, currency="USD"))
    db_session.add(
        CostRecord(provider="oci", service_name="Compute", usage_date=previous_end, amount=10.0, currency="USD")
    )
    db_session.commit()

    _login(client)
    response = client.get("/api/costs/summary", params={"provider": "oci", "period": "last_6_months"})

    body = response.json()
    assert body["previous_total"] == 10.0
    assert body["change_pct"] == 200.0


def test_service_trend_groups_by_month(client, db_session):
    today = date.today()
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=40.0, currency="USD"))
    db_session.add(
        CostRecord(provider="aws", service_name="EC2", usage_date=last_month, amount=25.0, currency="USD")
    )
    db_session.add(CostRecord(provider="aws", service_name="S3", usage_date=today, amount=5.0, currency="USD"))
    db_session.commit()

    _login(client)
    response = client.get(
        "/api/costs/service-trend", params={"provider": "aws", "service_name": "EC2", "months": 6}
    )

    assert response.status_code == 200
    points = {p["month"]: p["amount"] for p in response.json()["points"]}
    assert points[f"{today.year:04d}-{today.month:02d}"] == 40.0
    assert points[f"{last_month.year:04d}-{last_month.month:02d}"] == 25.0
    assert "S3" not in str(points)


def test_service_trend_empty_for_service_with_no_records(client, db_session):
    _login(client)
    response = client.get(
        "/api/costs/service-trend", params={"provider": "aws", "service_name": "Nonexistent", "months": 6}
    )

    assert response.status_code == 200
    assert response.json()["points"] == []


def test_service_trend_invalid_provider_rejected(client):
    _login(client)
    response = client.get(
        "/api/costs/service-trend", params={"provider": "gcp", "service_name": "EC2", "months": 6}
    )
    assert response.status_code == 400


def test_invalid_currency_rejected(client):
    _login(client)
    response = client.get(
        "/api/costs/summary", params={"provider": "aws", "period": "current_month", "currency": "eur"}
    )
    assert response.status_code == 400


def test_summary_converts_to_brl_using_each_day_own_rate(client, db_session):
    today = date.today()
    yesterday = today - timedelta(days=1)
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=yesterday, amount=10.0, currency="USD"))
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=20.0, currency="USD"))
    db_session.add(ExchangeRate(date=yesterday, rate=5.0))
    db_session.add(ExchangeRate(date=today, rate=5.5))
    db_session.commit()

    _login(client)
    response = client.get(
        "/api/costs/summary", params={"provider": "aws", "period": "current_month", "currency": "brl"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "BRL"
    assert body["total"] == 10.0 * 5.0 + 20.0 * 5.5
    trend_by_date = {p["usage_date"]: p["amount"] for p in body["trend"]}
    assert trend_by_date[yesterday.isoformat()] == 50.0
    assert trend_by_date[today.isoformat()] == 110.0


def test_breakdown_converts_to_brl_per_day(client, db_session):
    today = date.today()
    db_session.add(CostRecord(provider="oci", service_name="Compute", usage_date=today, amount=8.0, currency="USD"))
    db_session.add(
        CostRecord(provider="oci", service_name="Object Storage", usage_date=today, amount=2.0, currency="USD")
    )
    db_session.add(ExchangeRate(date=today, rate=5.0))
    db_session.commit()

    _login(client)
    response = client.get(
        "/api/costs/breakdown", params={"provider": "oci", "period": "current_month", "currency": "brl"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "BRL"
    items = {item["service_name"]: item["amount"] for item in body["items"]}
    assert items == {"Compute": 40.0, "Object Storage": 10.0}


def test_service_trend_converts_to_brl_with_carry_forward(client, db_session):
    today = date.today()
    last_month = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=today, amount=10.0, currency="USD"))
    db_session.add(
        CostRecord(provider="aws", service_name="EC2", usage_date=last_month, amount=4.0, currency="USD")
    )
    # No rate stored for `today` or `last_month` themselves; only an earlier one to carry forward.
    db_session.add(ExchangeRate(date=last_month - timedelta(days=1), rate=5.0))
    db_session.commit()

    _login(client)
    response = client.get(
        "/api/costs/service-trend",
        params={"provider": "aws", "service_name": "EC2", "months": 6, "currency": "brl"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["currency"] == "BRL"
    points = {p["month"]: p["amount"] for p in body["points"]}
    assert points[f"{today.year:04d}-{today.month:02d}"] == 50.0
    assert points[f"{last_month.year:04d}-{last_month.month:02d}"] == 20.0
