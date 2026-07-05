from datetime import date

from app.models import ExchangeRate
from app.services import fx


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


def test_backfills_six_months_on_empty_table(db_session, monkeypatch):
    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        captured["params"] = kwargs.get("params")
        return FakeResponse({"rates": {"2026-07-01": {"BRL": 5.0}, "2026-07-04": {"BRL": 5.1}}})

    monkeypatch.setattr(fx.httpx, "get", fake_get)

    today = date(2026, 7, 4)
    fx.sync_fx_rates(db_session, today=today)

    assert captured["url"] == f"{fx.FX_API_URL}/2026-01-01..2026-07-04"
    assert captured["params"] == {"from": "USD", "to": "BRL"}

    rows = {r.date: float(r.rate) for r in db_session.query(ExchangeRate).all()}
    assert rows == {date(2026, 7, 1): 5.0, date(2026, 7, 4): 5.1}


def test_second_sync_only_fetches_the_missing_gap(db_session, monkeypatch):
    db_session.add(ExchangeRate(date=date(2026, 7, 1), rate=5.0))
    db_session.commit()

    captured = {}

    def fake_get(url, **kwargs):
        captured["url"] = url
        return FakeResponse({"rates": {"2026-07-04": {"BRL": 5.2}}})

    monkeypatch.setattr(fx.httpx, "get", fake_get)

    fx.sync_fx_rates(db_session, today=date(2026, 7, 4))

    assert captured["url"] == f"{fx.FX_API_URL}/2026-07-02..2026-07-04"
    assert db_session.query(ExchangeRate).count() == 2


def test_nothing_to_sync_when_already_up_to_date(db_session, monkeypatch):
    db_session.add(ExchangeRate(date=date(2026, 7, 4), rate=5.0))
    db_session.commit()

    called = {"n": 0}

    def fake_get(url, **kwargs):
        called["n"] += 1
        return FakeResponse({"rates": {}})

    monkeypatch.setattr(fx.httpx, "get", fake_get)

    fx.sync_fx_rates(db_session, today=date(2026, 7, 4))

    assert called["n"] == 0


def test_sync_swallows_http_errors(db_session, monkeypatch):
    def failing_get(url, **kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr(fx.httpx, "get", failing_get)

    fx.sync_fx_rates(db_session, today=date(2026, 7, 4))

    assert db_session.query(ExchangeRate).count() == 0


def test_convert_to_brl_uses_each_day_own_rate_with_carry_forward(db_session):
    db_session.add_all(
        [
            ExchangeRate(date=date(2026, 6, 30), rate=5.0),
            ExchangeRate(date=date(2026, 7, 2), rate=5.5),
        ]
    )
    db_session.commit()

    rows = [
        (date(2026, 7, 1), 10.0),  # no rate on 7/1 -> carries forward from 6/30 (5.0)
        (date(2026, 7, 2), 10.0),  # exact match (5.5)
    ]

    converted = fx.convert_to_brl(db_session, rows)

    assert converted == [(date(2026, 7, 1), 50.0), (date(2026, 7, 2), 55.0)]


def test_convert_to_brl_with_no_earlier_rate_yields_zero(db_session):
    db_session.add(ExchangeRate(date=date(2026, 7, 5), rate=5.0))
    db_session.commit()

    converted = fx.convert_to_brl(db_session, [(date(2026, 7, 1), 10.0)])

    assert converted == [(date(2026, 7, 1), 0.0)]
