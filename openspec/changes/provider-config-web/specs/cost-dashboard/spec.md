## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Empty state when no providers are enabled
The frontend SHALL show a message directing the user to the settings page instead of an empty or broken dashboard when no provider is currently enabled.

#### Scenario: No providers enabled
- **WHEN** the user opens the Dashboard and no provider is enabled
- **THEN** the system shows a message indicating no cloud is configured, with a link to the settings page, instead of any provider tab or the Overview tab
