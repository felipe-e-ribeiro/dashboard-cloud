## 1. Backend: period-over-period delta

- [ ] 1.1 Add `previous_period_range(period, today)` to `app/services/periods.py`, returning the immediately preceding date range of equal length to `period_range(period, today)`.
- [ ] 1.2 Add `previous_total: float` and `change_pct: float | None` to `CostSummary` in `app/schemas.py`.
- [ ] 1.3 Update `cost_summary()` in `app/routers/costs.py` to aggregate `cost_records` over the previous period and compute `change_pct` (`null` when `previous_total == 0`).
- [ ] 1.4 Add backend tests covering: normal delta calculation, zero previous-period cost (`change_pct` is `null`), and both `current_month`/`last_6_months` periods.

## 2. Backend: service trend endpoint

- [ ] 2.1 Add `ServiceTrendPoint` (`month: str`, `amount: float`) and `ServiceTrend` (`provider`, `service_name`, `currency`, `points: list[ServiceTrendPoint]`) schemas in `app/schemas.py`.
- [ ] 2.2 Add `GET /api/costs/service-trend?provider=&service_name=&months=6` in `app/routers/costs.py`, grouping `cost_records` by calendar month for the given provider+service, covering the last `months` closed months plus the current month.
- [ ] 2.3 Add backend tests covering: multi-month aggregation, a service with no matching records (empty list), and provider/period-style input validation consistent with existing endpoints.

## 3. Frontend: theming foundation

- [ ] 3.1 Define CSS custom properties (`--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-positive`, `--color-negative`, etc.) in `styles.css` under `:root` (light) and `[data-theme="dark"]` (dark), replacing hardcoded colors used today (`#2563eb`, `#b91c1c`, etc.).
- [ ] 3.2 Create `ThemeContext`/`ThemeProvider` (mirroring `AuthContext`) that reads `prefers-color-scheme` on first load, exposes `theme`/`toggleTheme`, and persists an explicit choice to `localStorage`.
- [ ] 3.3 Wrap `App.tsx` with `ThemeProvider` and apply `data-theme` to the document root.
- [ ] 3.4 Add a theme toggle control to `AppHeader`.

## 4. Frontend: API client updates

- [ ] 4.1 Extend `CostSummary` type in `api/client.ts` with `previous_total`/`change_pct`.
- [ ] 4.2 Add `ServiceTrendPoint`/`ServiceTrend` types and an `api.serviceTrend(provider, serviceName, months)` call in `api/client.ts`.

## 5. Frontend: Overview tab

- [ ] 5.1 Add "Overview" as the first entry in `ProviderTabs` (or a new tab enum value alongside `Provider`), defaulting to it on Dashboard load.
- [ ] 5.2 Extract a `ProviderSummaryCard` component from `ProviderPanel` (total, trend indicator, period-over-period change) for reuse.
- [ ] 5.3 Build `OverviewPanel`: fetches `costSummary` for `aws` and `oci` in parallel, sums `total`/`previous_total` client-side for the combined KPI, renders one `ProviderSummaryCard` per provider, and handles one-provider-fails-independently error states.
- [ ] 5.4 Wire clicking a provider's card in `OverviewPanel` to switch the Dashboard to that provider's tab.
- [ ] 5.5 Update `DashboardPage` to render `OverviewPanel` when the Overview tab is active.

## 6. Frontend: provider tab reorder + drill-down

- [ ] 6.1 Reorder `ProviderPanel` markup so the total (with period-over-period change) renders above the trend chart and breakdown table.
- [ ] 6.2 Add `selectedService: string | null` state to `ProviderPanel` (or a new container) and pass a click handler into `BreakdownTable`.
- [ ] 6.3 Update `BreakdownTable` to render as a compact list (service name + amount only) and mark the selected row.
- [ ] 6.4 Build `ServiceDetailPanel`: shows placeholder state when no service selected; on selection, calls `api.serviceTrend`, renders name/amount/% of provider total, and a monthly bar chart (Recharts) with % change vs. previous month.
- [ ] 6.5 Lay out `ProviderPanel` as breakdown table (left) + `ServiceDetailPanel` (right) per the approved mockup.

## 7. Frontend: Login and Sync Logs restyle

- [ ] 7.1 Restyle `LoginPage` (two-column layout retained) with the new palette and theme support, replacing the blue gradient.
- [ ] 7.2 Restyle `SyncLogsPage` with the new visual system, keeping its existing per-provider tabs + last-20-runs table structure unchanged.

## 8. Tests and verification

- [ ] 8.1 Add/update frontend component tests: `OverviewPanel` (combined totals, independent per-provider error state), `ServiceDetailPanel` (on-demand fetch, empty state before selection), `ThemeContext`/toggle (initial system preference, persisted override).
- [ ] 8.2 Run full backend (`pytest`) and frontend (`npm test`, `npx tsc -b`) suites; fix regressions from the layout/schema changes.
- [ ] 8.3 Manually verify in the browser (`npm run dev` + backend running): theme toggle across all pages, Overview tab combined total, per-provider reordered layout, and the service drill-down interaction end to end.
