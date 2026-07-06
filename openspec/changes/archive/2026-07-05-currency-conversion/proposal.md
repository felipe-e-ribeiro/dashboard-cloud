## Why

Cost values are hard to read (no thousands separator, inconsistent decimal formatting across components), and the user thinks in Brazilian Real, not US Dollars. Converting naively with today's exchange rate would distort historical values (a cost from 6 months ago would show a rate that never applied to it), so the conversion needs to be historically accurate — each day's cost converted at that day's own rate.

## What Changes

- Frontend: a single `formatMoney(amount, currency)` utility (`Intl.NumberFormat`, always 2 decimals, thousands separator) replaces the manual `.toFixed(2)` calls scattered across `ProviderSummaryCard`, `ProviderPanel`, `BreakdownTable`, and `ServiceDetailPanel`.
- New `exchange_rates` table (date, USD→BRL rate), synced daily (backfilled over the same historical range as `cost_records`) from the free, keyless `frankfurter.app` API — never called live from the cost-read endpoints.
- `GET /api/costs/summary`, `GET /api/costs/breakdown`, and `GET /api/costs/service-trend` gain an optional `currency=usd|brl` query parameter (default `usd`, fully backward compatible). When `brl`, each cost record is converted using its own day's exchange rate (with carry-forward for days with no published rate, e.g. weekends) before aggregation.
- Frontend: a currency toggle (USD/BRL) in the header next to the theme toggle, preference persisted in `localStorage`, triggering a refetch with the new `currency` parameter.

## Capabilities

### New Capabilities

(none — this extends the existing `cost-sync` and `cost-dashboard` capabilities)

### Modified Capabilities

- `cost-sync`: adds a daily exchange-rate sync job (backfill + per-day upsert into `exchange_rates`), isolated from and independent of the AWS/OCI cost sync steps.
- `cost-dashboard`: the three cost-read endpoints gain an optional `currency` parameter with BRL conversion; the frontend gains a currency toggle and consistent monetary formatting.

## Impact

- Backend: new `ExchangeRate` model + Alembic migration, new `app/services/fx.py` (fetch + backfill + carry-forward lookup), `scheduler.py` calls the new sync job alongside the existing daily cost sync, `app/routers/costs.py` and `app/schemas.py` gain the `currency` parameter and conversion logic.
- Frontend: new `CurrencyContext`, new `formatMoney` utility, `AppHeader` gains a currency toggle, `api/client.ts` passes `currency` through to the three cost-read calls.
- New external dependency: `frankfurter.app` (public, keyless, no new secret needed).
