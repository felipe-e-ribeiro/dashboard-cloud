## Purpose

API de leitura (totais/tendência/breakdown por serviço, por cloud e período) e UI React em abas para visualizar os custos já sincronizados.

## Requirements

### Requirement: Cost summary API
The system SHALL provide an endpoint returning the total cost, a trend series, and the period-over-period change for a given provider (`aws` or `oci`), period (`current_month` or `last_6_months`), and currency (`usd` or `brl`, defaulting to `usd`), reading exclusively from persisted `cost_records` (and, for `brl`, persisted `exchange_rates`) — no live call to AWS/OCI or exchange-rate APIs at request time.

#### Scenario: Summary for current month
- **WHEN** an authenticated request asks for the AWS summary with period `current_month`
- **THEN** the system returns the total cost and a daily trend series for the current month, computed from `cost_records`

#### Scenario: Summary is served even if the last sync failed
- **WHEN** the most recent `sync_runs` entry for a provider has status `failed`
- **THEN** the summary endpoint still returns the last persisted cost data for that provider instead of an error

#### Scenario: Summary includes period-over-period change
- **WHEN** an authenticated request asks for a provider's summary for a given period
- **THEN** the system also returns `previous_total` (the total for the immediately preceding period of equal length) and `change_pct` (the percentage change from `previous_total` to `total`)

#### Scenario: No data in the previous period
- **WHEN** the immediately preceding period has no `cost_records` for that provider
- **THEN** the system returns `previous_total: 0` and `change_pct: null` instead of raising an error or dividing by zero

#### Scenario: Summary converted to BRL uses each day's own rate
- **WHEN** an authenticated request asks for a provider's summary with `currency=brl`
- **THEN** the system converts each day's cost using the USD→BRL rate stored for that specific day (or the most recent earlier rate, if that day has none) before computing the total and trend, instead of applying a single current rate to every day

### Requirement: Cost breakdown API
The system SHALL provide an endpoint returning cost grouped by service name for a given provider, period, and currency (`usd` or `brl`, defaulting to `usd`).

#### Scenario: Breakdown by service
- **WHEN** an authenticated request asks for the OCI breakdown with period `last_6_months`
- **THEN** the system returns the total cost per service name for OCI over the last 6 closed months

#### Scenario: Breakdown converted to BRL uses each day's own rate
- **WHEN** an authenticated request asks for a provider's breakdown with `currency=brl`
- **THEN** the system converts each underlying day's cost using that day's own USD→BRL rate (with carry-forward for days with no published rate) before summing per service

### Requirement: Sync status API
The system SHALL provide an endpoint returning the most recent sync timestamp and status for a given provider.

#### Scenario: Status reflects last sync outcome
- **WHEN** an authenticated request asks for AWS sync status
- **THEN** the system returns the timestamp and status (`success` or `failed`) of the most recent AWS `sync_runs` entry

### Requirement: Dashboard tabs per cloud
The frontend SHALL present a tab for each enabled cloud provider (AWS and/or Oracle Cloud) within the authenticated dashboard, each showing the period total (with its period-over-period change) above a trend chart and a service breakdown table, a period selector (current month / last 6 months), and a last-sync indicator. A disabled provider's tab SHALL NOT appear.

#### Scenario: Switching tabs shows the matching provider's data
- **WHEN** the user selects the "Oracle Cloud" tab
- **THEN** the dashboard displays OCI's total, trend chart, breakdown table, and last-sync indicator for the selected period

#### Scenario: Failed last sync shows a warning
- **WHEN** the sync status for the active tab's provider is `failed`
- **THEN** the dashboard shows a non-blocking warning alongside the (possibly stale) cost data already displayed

#### Scenario: Total is shown above the trend and breakdown
- **WHEN** the user views the AWS or Oracle Cloud tab
- **THEN** the period total and its period-over-period change are the first cost information visible, above the trend chart and the breakdown table

#### Scenario: Disabled provider's tab is hidden
- **WHEN** a provider is disabled in its provider configuration
- **THEN** the Dashboard and Sync Logs pages do not show a tab for that provider

### Requirement: Service trend API
The system SHALL provide an endpoint returning the monthly total cost of a single service, for a given provider, service name, and currency (`usd` or `brl`, defaulting to `usd`), over the last N closed months plus the current month (N defaulting to 6), reading exclusively from persisted `cost_records` (and, for `brl`, persisted `exchange_rates`).

#### Scenario: Monthly totals for a service
- **WHEN** an authenticated request asks for the AWS service trend for service `EC2` with `months=6`
- **THEN** the system returns the total EC2 cost for each of the last 6 closed months plus the current month, ordered oldest first

#### Scenario: Service with no recorded cost
- **WHEN** an authenticated request asks for the service trend of a `service_name` with no matching `cost_records` in the requested range
- **THEN** the system returns an empty list instead of an error

#### Scenario: Service trend converted to BRL uses each day's own rate
- **WHEN** an authenticated request asks for a service trend with `currency=brl`
- **THEN** the system converts each underlying day's cost using that day's own USD→BRL rate (with carry-forward for days with no published rate) before summing into monthly totals

### Requirement: Dashboard overview tab
The frontend SHALL present a combined "Overview" tab, shown before the per-provider tabs, displaying the combined total cost across all enabled providers (with its period-over-period change) and a summary card per enabled provider (each showing that provider's total and a trend indicator).

#### Scenario: Overview shows combined total and per-provider cards
- **WHEN** the user selects the "Overview" tab and at least one provider is enabled
- **THEN** the dashboard displays the sum of the enabled providers' totals with its period-over-period change, and one summary card per enabled provider

#### Scenario: One provider fails to load
- **WHEN** the cost summary request for one enabled provider fails while another succeeds
- **THEN** the Overview tab shows the successfully loaded provider's card and an error state for the other, without blocking the combined total from being shown as unavailable

#### Scenario: No drill-down from the overview
- **WHEN** the user is on the "Overview" tab
- **THEN** clicking a provider's summary card navigates to that provider's tab, and no per-service detail is shown within the Overview tab itself

### Requirement: Empty state when no providers are enabled
The frontend SHALL show a message directing the user to the settings page instead of an empty or broken dashboard when no provider is currently enabled.

#### Scenario: No providers enabled
- **WHEN** the user opens the Dashboard and no provider is enabled
- **THEN** the system shows a message indicating no cloud is configured, with a link to the settings page, instead of any provider tab or the Overview tab

### Requirement: Per-service drill-down
The frontend SHALL allow the user to select a service row in a provider's breakdown table to view that service's monthly cost history for the last 6 closed months plus the current month, alongside its period-over-period change.

#### Scenario: Selecting a service shows its monthly history
- **WHEN** the user clicks a service row in the AWS or Oracle Cloud breakdown table
- **THEN** the dashboard displays a detail panel with that service's name, its cost and share of the provider's total for the selected period, and a bar chart of its monthly totals for the last 6 closed months plus the current month with the change versus the previous month

#### Scenario: No service selected yet
- **WHEN** the user has not clicked any service row
- **THEN** the detail panel shows an empty/placeholder state instead of any service's data

### Requirement: Light/dark theme
The frontend SHALL support both a light and a dark visual theme across all authenticated and unauthenticated pages, defaulting to the browser's `prefers-color-scheme` setting, with a manual toggle that overrides and persists the user's choice across sessions.

#### Scenario: First visit follows system preference
- **WHEN** a user with no previously saved theme preference loads any page
- **THEN** the page renders in the theme matching the browser's `prefers-color-scheme` setting

#### Scenario: Manual override persists
- **WHEN** the user toggles the theme manually
- **THEN** the selected theme is applied immediately and used on subsequent visits, regardless of the browser's `prefers-color-scheme` setting

### Requirement: Currency toggle
The frontend SHALL let the user switch the displayed currency between USD and BRL via a toggle in the header, defaulting to USD, with the choice persisted across sessions and applied to every monetary value shown on the Overview, AWS, and Oracle Cloud tabs.

#### Scenario: Toggling currency refreshes displayed values
- **WHEN** the user switches the currency toggle to BRL
- **THEN** the dashboard refetches and displays totals, trends, breakdowns, and the service detail panel converted to BRL

#### Scenario: Currency choice persists across sessions
- **WHEN** the user has previously selected BRL and reloads the dashboard in a new session
- **THEN** the dashboard loads with BRL selected, without requiring the user to toggle it again

### Requirement: Consistent monetary formatting
The frontend SHALL format every displayed monetary value with exactly two decimal places and locale-appropriate thousands separators, regardless of which component renders it.

#### Scenario: Large totals show a thousands separator
- **WHEN** a total or breakdown amount is one thousand or greater
- **THEN** the displayed value includes a thousands separator appropriate to the selected currency's locale (e.g. `1,234.56` for USD, `1.234,56` for BRL)
