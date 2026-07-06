from datetime import date, datetime, timezone

from app.models import CostRecord
from app.services import provider_config, sync


def _enable(db, provider):
    provider_config.save_validated(db, provider, {"dummy": "creds"}, datetime.now(timezone.utc))
    provider_config.set_enabled(db, provider, True)


def test_successful_sync_records_data(db_session, monkeypatch):
    def fake_aws(start, end, credentials):
        return [{"usage_date": date(2026, 7, 1), "service_name": "EC2", "amount": 10.5, "currency": "USD"}]

    def fake_oci(start, end, credentials):
        return [{"usage_date": date(2026, 7, 1), "service_name": "Compute", "amount": 5.0, "currency": "USD"}]

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": fake_aws, "oci": fake_oci})
    _enable(db_session, "aws")
    _enable(db_session, "oci")

    runs = sync.sync_all(db_session, today=date(2026, 7, 4))

    assert {run.provider for run in runs} == {"aws", "oci"}
    assert all(run.status == "success" for run in runs)
    assert db_session.query(CostRecord).count() == 2


def test_aws_failure_does_not_block_oci(db_session, monkeypatch):
    def failing_aws(start, end, credentials):
        raise RuntimeError("boom")

    def fake_oci(start, end, credentials):
        return [{"usage_date": date(2026, 7, 1), "service_name": "Compute", "amount": 5.0, "currency": "USD"}]

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": failing_aws, "oci": fake_oci})
    _enable(db_session, "aws")
    _enable(db_session, "oci")

    runs = {run.provider: run for run in sync.sync_all(db_session, today=date(2026, 7, 4))}

    assert runs["aws"].status == "failed"
    assert "boom" in runs["aws"].error_message
    assert runs["oci"].status == "success"
    assert db_session.query(CostRecord).filter_by(provider="oci").count() == 1
    assert db_session.query(CostRecord).filter_by(provider="aws").count() == 0


def test_resync_same_day_does_not_duplicate(db_session, monkeypatch):
    calls = {"n": 0}

    def fake_aws(start, end, credentials):
        calls["n"] += 1
        return [
            {
                "usage_date": date(2026, 7, 1),
                "service_name": "EC2",
                "amount": 10.0 + calls["n"],
                "currency": "USD",
            }
        ]

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": fake_aws, "oci": lambda s, e, c: []})
    _enable(db_session, "aws")

    sync.sync_provider(db_session, "aws", today=date(2026, 7, 4))
    sync.sync_provider(db_session, "aws", today=date(2026, 7, 4))

    records = db_session.query(CostRecord).filter_by(provider="aws").all()
    assert len(records) == 1
    assert float(records[0].amount) == 12.0


def test_first_sync_backfills_six_months(db_session, monkeypatch):
    captured = {}

    def fake_aws(start, end, credentials):
        captured["start"] = start
        captured["end"] = end
        return []

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": fake_aws, "oci": lambda s, e, c: []})
    _enable(db_session, "aws")

    today = date(2026, 7, 4)
    sync.sync_provider(db_session, "aws", today=today)

    assert captured["start"] == date(2026, 1, 1)
    assert captured["end"] == today


def test_error_message_prefers_message_attribute(db_session, monkeypatch):
    class FakeServiceError(Exception):
        def __init__(self, message):
            super().__init__(f"{{'status': 500, 'message': '{message}', 'opc-request-id': 'xyz'}}")
            self.message = message

    def failing_oci(start, end, credentials):
        raise FakeServiceError("Internal Service Error, please try again")

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": lambda s, e, c: [], "oci": failing_oci})
    _enable(db_session, "oci")

    run = sync.sync_provider(db_session, "oci", today=date(2026, 7, 4))

    assert run.status == "failed"
    assert run.error_message == "Internal Service Error, please try again"


def test_second_sync_only_fetches_today(db_session, monkeypatch):
    calls = []

    def fake_aws(start, end, credentials):
        calls.append((start, end))
        return [{"usage_date": end, "service_name": "EC2", "amount": 1.0, "currency": "USD"}]

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": fake_aws, "oci": lambda s, e, c: []})
    _enable(db_session, "aws")

    today = date(2026, 7, 4)
    sync.sync_provider(db_session, "aws", today=today)
    sync.sync_provider(db_session, "aws", today=today)

    assert calls[0][0] == date(2026, 1, 1)
    assert calls[1][0] == today


def test_disabled_provider_is_skipped_without_sync_run(db_session, monkeypatch):
    called = {"n": 0}

    def fake_aws(start, end, credentials):
        called["n"] += 1
        return []

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": fake_aws, "oci": lambda s, e, c: []})
    # aws is never configured/enabled here.

    result = sync.sync_provider(db_session, "aws", today=date(2026, 7, 4))

    assert result is None
    assert called["n"] == 0
    assert db_session.query(sync.SyncRun).filter_by(provider="aws").count() == 0


def test_disabled_provider_excluded_from_sync_all(db_session, monkeypatch):
    def fake_oci(start, end, credentials):
        return [{"usage_date": date(2026, 7, 1), "service_name": "Compute", "amount": 5.0, "currency": "USD"}]

    monkeypatch.setattr(sync, "PROVIDER_FETCHERS", {"aws": lambda s, e, c: [], "oci": fake_oci})
    _enable(db_session, "oci")
    # aws stays disabled/unconfigured.

    runs = sync.sync_all(db_session, today=date(2026, 7, 4))

    assert {run.provider for run in runs} == {"oci"}
