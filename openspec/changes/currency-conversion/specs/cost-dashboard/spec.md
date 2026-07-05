## MODIFIED Requirements

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

### Requirement: Dashboard tabs per cloud
The frontend SHALL present the AWS and Oracle Cloud cost views as separate tabs within the authenticated dashboard, each showing the period total (with its period-over-period change) above a trend chart and a service breakdown table, a period selector (current month / last 6 months), and a last-sync indicator.

#### Scenario: Switching tabs shows the matching provider's data
- **WHEN** the user selects the "Oracle Cloud" tab
- **THEN** the dashboard displays OCI's total, trend chart, breakdown table, and last-sync indicator for the selected period

#### Scenario: Failed last sync shows a warning
- **WHEN** the sync status for the active tab's provider is `failed`
- **THEN** the dashboard shows a non-blocking warning alongside the (possibly stale) cost data already displayed

#### Scenario: Total is shown above the trend and breakdown
- **WHEN** the user views the AWS or Oracle Cloud tab
- **THEN** the period total and its period-over-period change are the first cost information visible, above the trend chart and the breakdown table

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

## ADDED Requirements

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
