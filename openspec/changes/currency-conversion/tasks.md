## 1. Backend: exchange rate data model and sync

- [x] 1.1 Add `ExchangeRate` model (`date` primary key, `rate: Numeric(10,4)`) in `app/models.py`, plus an Alembic migration (`0002_exchange_rates.py`) creating the `exchange_rates` table.
- [x] 1.2 Add `httpx` to `backend/requirements.txt` (currently only in `requirements-dev.txt` for `TestClient`).
- [x] 1.3 Create `app/services/fx.py` with `sync_fx_rates(db, today=None)`: determines the missing date range (backfill to the last-6-months start if `exchange_rates` is empty, otherwise from the day after the latest stored rate to `today`), fetches it in one call to `frankfurter.app`'s time-series endpoint (`GET /{start}..{end}?from=USD&to=BRL`), and upserts each returned date/rate into `exchange_rates`. Catches and swallows request/parse errors per the existing per-provider isolation pattern (never raises into the caller).
- [x] 1.4 Call `sync_fx_rates(db)` from `scheduler.py`'s daily job, after `sync_all(db)`.
- [x] 1.5 Call `sync_fx_rates(db)` once during FastAPI `lifespan` startup in `main.py` (alongside `seed_admin_user`/`start_scheduler`), wrapped so a failure doesn't prevent the app from starting.
- [x] 1.6 Add backend tests for `sync_fx_rates`: backfills the correct range on an empty table, only fetches the missing gap on subsequent calls, and doesn't raise when the HTTP call fails (mock the HTTP client).

## 2. Backend: currency-aware aggregation

- [x] 2.1 Add a `convert_to_brl(rows: list[tuple[date, float]]) -> float` (or similar) helper in `app/services/fx.py`: loads all `exchange_rates` in the needed range (plus a lookback buffer for carry-forward) into a sorted list, and for each `(usage_date, amount)` row finds the applicable rate via `bisect` (most recent rate on or before that date) and returns the converted total/series. Returns `0` contribution for dates with no applicable rate at all (nothing stored yet on/before that date).
- [x] 2.2 Update `cost_summary()` in `app/routers/costs.py` to accept `currency: str = "usd"`, and when `brl`, convert the current-period trend, the total, and the previous-period total using the helper before computing `change_pct`.
- [x] 2.3 Update `cost_breakdown()` to accept `currency`, converting each service's per-day amounts before summing when `brl` (requires querying `usage_date` alongside `service_name`/`amount` instead of aggregating by service in SQL directly).
- [x] 2.4 Update `service_trend()` to accept `currency`, converting each day's amount before grouping into monthly totals when `brl`.
- [x] 2.5 Add backend tests: `currency=brl` on each of the three endpoints converts using the correct per-day rate (including a day requiring carry-forward), and `currency=usd` (or omitted) is unchanged from current behavior.

## 3. Frontend: shared formatting

- [x] 3.1 Add `formatMoney(amount, currency)` to `utils/format.ts` using `Intl.NumberFormat` (`en-US`/`USD` or `pt-BR`/`BRL`, always 2 decimals).
- [x] 3.2 Replace the manual `.toFixed(2)` calls in `ProviderSummaryCard`, `ProviderPanel`, `BreakdownTable`, and `ServiceDetailPanel` with `formatMoney`.

## 4. Frontend: currency toggle and data flow

- [x] 4.1 Extend `Provider`/`CostSummary`/`CostBreakdown`/`ServiceTrend` API types and `api.costSummary`/`api.costBreakdown`/`api.serviceTrend` in `api/client.ts` to accept and pass through a `currency: "usd" | "brl"` parameter.
- [x] 4.2 Create `CurrencyContext`/`CurrencyProvider` (mirroring `ThemeContext`): default `"usd"`, persisted to `localStorage`, exposes `currency`/`toggleCurrency`.
- [x] 4.3 Wrap `App.tsx` with `CurrencyProvider`; add a currency toggle button to `AppHeader` next to the theme toggle.
- [x] 4.4 Wire `currency` from `useCurrency()` into the data-loading calls in `OverviewPanel`, `ProviderPanel`, and `ServiceDetailPanel`, re-fetching when it changes (same pattern as existing `period`/`provider` dependencies).

## 5. Tests and verification

- [x] 5.1 Add/update frontend component tests: `formatMoney` output for both currencies, and a currency-toggle test verifying a re-fetch with `currency=brl` updates displayed values.
- [x] 5.2 Run full backend (`pytest`) and frontend (`npm test`, `npx tsc -b`) suites; fix regressions.
- [x] 5.3 Manually verify in the browser: toggling currency updates the Overview, AWS/OCI tabs, and service drill-down panel; confirm exchange rates appear in `exchange_rates` after a backend restart (startup sync) and that monetary values everywhere show 2 decimals with thousands separators.
