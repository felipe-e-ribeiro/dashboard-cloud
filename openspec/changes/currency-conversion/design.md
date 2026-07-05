## Context

`cost_records` stores amounts in USD only (`currency` column is always `"USD"`). The frontend today formats every monetary value with ad hoc `.toFixed(2)` calls scattered across `ProviderSummaryCard`, `ProviderPanel`, `BreakdownTable`, and `ServiceDetailPanel` — no thousands separator, inconsistent across components. The user wants to view the same costs in BRL, but a naive "multiply everything by today's rate" approach would misrepresent history: a cost from 6 months ago should be converted at that day's actual rate, not today's. This design covers the data model, sync mechanism, and read-path conversion needed to do that correctly, plus the shared formatting fix. Full rationale and rejected alternatives live in `docs/superpowers/specs/2026-07-05-currency-conversion-design.md`.

## Goals / Non-Goals

**Goals:**
- Consistent monetary formatting (2 decimals, thousands separator) across the whole frontend, for both USD and BRL.
- USD→BRL conversion where each day's cost uses that day's actual exchange rate (not a single rate applied retroactively).
- A currency toggle (USD/BRL) in the header, persisted like the existing theme toggle.
- Keep the existing architectural invariant that cost-read endpoints never call external APIs live — exchange rates are backfilled/synced ahead of time, same as cost data.

**Non-Goals:**
- Currencies other than BRL.
- User-configurable/manual exchange rate override.
- Showing USD and BRL simultaneously side by side.
- Changing the currency costs are synced/stored in (`cost_records.currency` stays `USD`).

## Decisions

### 1. Conversion happens in the backend aggregation, not the frontend
Converting already-aggregated totals client-side by multiplying by a single "current" rate was rejected: it would apply today's rate to months-old costs, producing numbers that never existed. Converting during backend aggregation — each row multiplied by its own day's rate before summing — is the only way to get per-day accuracy, and keeps the frontend a pure display layer.

### 2. `currency` is an additive query parameter on the existing three endpoints
`GET /api/costs/summary`, `GET /api/costs/breakdown`, and `GET /api/costs/service-trend` all gain `currency=usd|brl` (default `usd`, identical to current behavior). Rejected adding parallel `*-brl` endpoints or a new combined endpoint — that would duplicate three aggregation code paths for what is fundamentally the same query with a different multiplier per row.

### 3. Exchange rates are backfilled and synced daily, never fetched live from a read request
Mirrors the existing `cost-sync` invariant (`CLAUDE.md`: cost-read endpoints never call AWS/OCI live). A new `app/services/fx.py::sync_fx_rates(db, today)` fetches the missing date range in one batched call to `frankfurter.app` (its time-series endpoint returns a whole range in one request) and upserts into a new `exchange_rates(date, rate)` table. It runs in two places: (a) `scheduler.py`'s existing daily job, right after `sync_all()` — no second `BackgroundScheduler`; and (b) once during the FastAPI `lifespan` startup (`main.py`, alongside `seed_admin_user`/`start_scheduler`), wrapped in a try/except like every other sync entry point, so a fresh deploy backfills rates immediately instead of waiting for the next 03:00 run. On first run it backfills the same historical range as the cost backfill (last 6 closed months + current month).

### 4. Carry-forward for missing days is computed in Python, not SQL
`frankfurter.app` (ECB-sourced) doesn't publish rates on weekends/bank holidays. Rejected a Postgres-specific `LEFT JOIN LATERAL` correlated subquery for the "most recent rate on or before this date" lookup: the backend test suite runs against SQLite (`tests/conftest.py`), and that SQL pattern isn't portable. Instead, when `currency=brl`, the endpoint loads all matching `cost_records` rows and all `exchange_rates` rows in the needed range into memory, builds a sorted date→rate list, and uses `bisect` to find the applicable rate per row before summing — identical behavior on SQLite and Postgres, and consistent with how `service_trend()` already aggregates in Python rather than SQL `GROUP BY`. Data volume (one user, one AWS account, one OCI tenancy) makes this trivially cheap.

### 5. `frankfurter.app` over a provider requiring an API key
Avoids adding a new secret to a project that already manages AWS keys and an OCI signing key. If it proves unreliable in practice, swapping providers is isolated to `app/services/fx.py`.

### 6. Shared `formatMoney()` utility replaces manual `.toFixed(2)`
`Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 })`, with `locale` picked from the currency (`en-US` for USD, `pt-BR` for BRL). One utility function used everywhere a money value is rendered, so formatting can't drift between components again.

## Risks / Trade-offs

- **[Risk] `frankfurter.app` is unavailable or rate-limits during the daily sync** → that day's exchange-rate sync fails in isolation (same pattern as `sync_provider`'s per-provider isolation — a failure here never blocks or crashes the cost sync). Carry-forward covers short gaps; a multi-day outage means a stale rate is used until the source recovers. Acceptable: this is a convenience feature, not the core dashboard.
- **[Trade-off] BRL values aren't stored, only computed at read time** → if a historical rate is later corrected upstream, a previously-viewed BRL total could show a slightly different number on a later visit. Acceptable for an approximate "cost in Real" view; the canonical USD numbers in `cost_records` never change.
- **[Trade-off] Python-side conversion doesn't scale to many users** → fine for this project's explicit single-user, single-account scope (`CLAUDE.md`); would need to move to set-based SQL if the project ever stopped being personal-use.

## Migration Plan

- New Alembic migration adds `exchange_rates(date PRIMARY KEY, rate NUMERIC(10,4))`. No changes to existing tables.
- First deploy: the startup-time sync (see Decision 3) backfills `exchange_rates` for the same range as existing `cost_records` as soon as the backend container comes up — no waiting for the next 03:00 run. If that startup call fails (e.g., no network yet), the day's cron job retries it; until either succeeds, `currency=brl` requests have no rates for unconverted dates and those days contribute `0` to the BRL total (self-correcting once a sync succeeds).
- Rollback: revert the deploy; the migration's `downgrade()` drops `exchange_rates` (no data loss for existing capabilities, since nothing else depends on it).

## Open Questions

None — the historical-accuracy requirement, the FX data source, and the SQLite-safe carry-forward approach were all decided during design review.
