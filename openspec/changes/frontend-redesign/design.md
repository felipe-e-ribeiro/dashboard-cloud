## Context

The current frontend (`frontend/src/`) uses plain CSS (`styles.css`) with no theming, a flat AWS/OCI tab structure (`ProviderTabs`, `ProviderPanel`), and a breakdown table (`BreakdownTable`) with no interaction beyond display. `api/client.ts` is the sole `fetch` boundary; `CostSummary`/`CostBreakdown` are read from `GET /api/costs/summary` and `GET /api/costs/breakdown`, which read exclusively from persisted `cost_records` (no live AWS/OCI calls). This design was validated with the user through mockup-driven brainstorming; the full rationale and visual reference lives in `docs/superpowers/specs/2026-07-05-frontend-redesign-design.md`. This document translates that into the technical decisions needed to implement it as a `cost-dashboard` change.

## Goals / Non-Goals

**Goals:**
- Redesign Login, Dashboard, and Sync Logs with a consistent visual system (clean minimalist palette, violet accent, light/dark theme).
- Add a combined "Overview" tab (AWS+OCI) as the dashboard's default landing view.
- Add period-over-period delta (% change vs. previous period) to the cost summary, surfaced at every total (combined, per-provider, per-service).
- Add per-service drill-down: clicking a service in the breakdown shows its monthly totals for the last 6 closed months + current month.

**Non-Goals:**
- No CSS framework or component library adoption (Tailwind, MUI, shadcn) — stays with plain CSS + CSS variables.
- No change to the authentication flow, sync trigger/polling behavior, or the underlying sync mechanism (`app/services/sync.py`).
- No budgets/alerts, no OAuth (unchanged project-level non-goals).
- No drill-down or service-level detail inside the Overview tab (it stays a high-level summary).
- No pagination/filtering of the breakdown table beyond what exists today.

## Decisions

### 1. Overview tab combines totals client-side, no new combined-summary endpoint
`OverviewPanel` calls the existing `GET /api/costs/summary` for both `aws` and `oci` (in parallel, same `Promise.all` pattern `ProviderPanel` already uses) and sums `total`/`previous_total` in the browser. **Alternative considered:** a `GET /api/costs/summary/combined` endpoint — rejected because it would duplicate trivial addition logic server-side for no real performance or correctness benefit at this data volume (two providers, one user).

### 2. Period-over-period delta added to the existing summary endpoint, not a new one
`previous_total` and `change_pct` are added as fields on the existing `CostSummary` schema and computed in `cost_summary()` by re-running the same aggregation query over the immediately preceding period of equal length (derived from `periods.period_range`). **Alternative considered:** a separate `/api/costs/delta` endpoint — rejected because every caller of `summary` in this redesign (Overview, per-provider header, future callers) wants the delta alongside the total; splitting it would just force two round-trips everywhere.

### 3. Service-level monthly comparison is a new, on-demand endpoint
`GET /api/costs/service-trend?provider=&service_name=&months=6` is called only when the user clicks a service row (not prefetched for every service in the breakdown). It groups `cost_records` by calendar month (`date_trunc`-equivalent) for one `provider`+`service_name`, covering the last `months` closed months plus the current month. **Alternative considered:** embedding a monthly series per item directly in `GET /api/costs/breakdown` — rejected because it would force computing a 6-month monthly aggregation for every service on every breakdown load, even though the user only ever inspects one service at a time.

### 4. Theming via CSS custom properties + `data-theme` attribute, no CSS-in-JS
A new `ThemeContext` (mirroring the existing `AuthContext` pattern) determines the initial theme from `window.matchMedia("(prefers-color-scheme: dark)")`, exposes a toggle, and persists an explicit user choice to `localStorage` under `theme`. `styles.css` defines `--color-*` custom properties under `:root` and `[data-theme="dark"]` blocks; components keep using class names, not inline styles, for anything theme-dependent. **Alternative considered:** a CSS-in-JS library (styled-components/emotion) — rejected as a new dependency with no benefit over CSS variables for a palette-only theming need.

### 5. Backend aggregation via a second query per request, not a materialized view
Both the period-over-period delta and the service-trend endpoint run their aggregation directly against `cost_records` at request time (same pattern as the existing `cost_summary`/`cost_breakdown`), rather than pre-computing rollups. Data volume is a single AWS account + single OCI tenancy for one user — a full table scan grouped by month/date is inexpensive at this scale, so a materialized rollup table would add write-path complexity (keeping it in sync with `sync_provider()`) for no measurable read-side benefit.

## Risks / Trade-offs

- **[Trade-off] Two HTTP calls for the Overview tab instead of one** → Slightly more request overhead than a combined endpoint, but avoids duplicating summation logic server-side. Mitigation: both calls run in parallel via `Promise.all`, so wall-clock latency stays close to a single request.
- **[Trade-off] Service detail panel fetches on click, not prefetched** → A brief loading state appears in `ServiceDetailPanel` after the user clicks a service. Mitigation: this is an explicit, infrequent user action (not part of initial page load), so the latency is acceptable and avoids fetching 6-month series for services the user never inspects.
- **[Risk] Theme choice doesn't sync across open tabs in the same browser session** → If the user changes theme in one tab, other already-open tabs keep their previous theme until reloaded (no `storage` event listener in this iteration). Mitigation: accepted for v1 given single-user, typically single-tab usage; can be added later as a small follow-up if it becomes annoying in practice.
- **[Risk] `change_pct` is undefined when the previous period has zero cost** → Division by zero if a provider had no recorded cost in the prior period (e.g., right after onboarding a new provider). Mitigation: `change_pct` is returned as `null` in that case, and the frontend renders no delta badge instead of `Infinity%` or a crash.

## Migration Plan

- No database migration required — `cost_records` already has `provider`, `service_name`, `usage_date`, `amount`.
- Backend and frontend can ship together in one deploy (no need for a compatibility window): the new `CostSummary` fields are additive (existing consumers ignoring unknown fields keep working), and the new `service-trend` endpoint is net-new.
- Rollback: revert the deploy; no data migration to undo since nothing new is persisted.

## Open Questions

None outstanding — all major decisions (visual direction, navigation structure, drill-down interaction, accent color, theming default) were validated with the user via mockups before this design was written.
