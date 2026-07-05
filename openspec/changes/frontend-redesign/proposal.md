## Why

The current dashboard UI works but has generic styling (plain blue CSS, raw tables) and weak information hierarchy — the total cost, its trend, and which services drive it aren't easy to read at a glance. A design was brainstormed and validated with the user (`docs/superpowers/specs/2026-07-05-frontend-redesign-design.md`, mockup-driven) calling for a cleaner visual system, a combined AWS+OCI overview, and per-service drill-down — all of which change what the `cost-dashboard` capability's API and UI must provide.

## What Changes

- Full visual redesign of Login, Dashboard, and Sync Logs: clean minimalist "SaaS" aesthetic, violet accent color, light/dark theme (defaults to `prefers-color-scheme`, manual override persisted in `localStorage`).
- New "Overview" tab in the Dashboard, shown before the AWS/OCI tabs: combined AWS+OCI total with % change vs. previous period, plus a side-by-side summary card per provider. No drill-down here.
- AWS/OCI tab layout reordered: period total (with % change vs. previous period) always shown above the trend chart and the service breakdown, instead of the total being just one line among others.
- Service drill-down: clicking a service row in the breakdown opens a detail panel showing that service's monthly totals for the last 6 closed months + current month (bar chart) with % change vs. previous month — not the existing daily trend line.
- `GET /api/costs/summary` response gains `previous_total` and `change_pct` fields (period-over-period delta), computed from `cost_records`, no new persisted state.
- New endpoint `GET /api/costs/service-trend?provider=&service_name=&months=6` returning monthly totals for one service.
- Sync Logs page restyled with the same visual system; its information structure (per-provider tabs, last-20-runs table) is unchanged.

## Capabilities

### New Capabilities

(none — all changes extend the existing `cost-dashboard` capability)

### Modified Capabilities

- `cost-dashboard`: cost summary API gains period-over-period delta fields; a new service-trend API is added; the dashboard UI requirements change to add the Overview tab, reordered per-provider layout, and service drill-down; theming (light/dark) becomes a UI requirement.

## Impact

- Backend: `app/routers/costs.py` (new `previous_total`/`change_pct` on summary, new `/api/costs/service-trend` endpoint), `app/schemas.py` (schema additions), no `alembic` migration (`cost_records` already has the needed columns).
- Frontend: `styles.css` (CSS variables for theming, new palette), new `ThemeContext`, new `OverviewPanel` and `ServiceDetailPanel` components, changes to `ProviderTabs`, `ProviderPanel`, `BreakdownTable`, `AppHeader`, `LoginPage`, `SyncLogsPage`. `api/client.ts` gains a `serviceTrend` call and the extended `CostSummary` type.
- No new runtime dependencies (no CSS framework/component library added).
