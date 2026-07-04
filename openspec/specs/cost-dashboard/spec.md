## Purpose

API de leitura (totais/tendência/breakdown por serviço, por cloud e período) e UI React em abas para visualizar os custos já sincronizados.

## Requirements

### Requirement: Cost summary API
The system SHALL provide an endpoint returning the total cost and a trend series for a given provider (`aws` or `oci`) and period (`current_month` or `last_6_months`), reading exclusively from persisted `cost_records` (no live call to AWS/OCI APIs at request time).

#### Scenario: Summary for current month
- **WHEN** an authenticated request asks for the AWS summary with period `current_month`
- **THEN** the system returns the total cost and a daily trend series for the current month, computed from `cost_records`

#### Scenario: Summary is served even if the last sync failed
- **WHEN** the most recent `sync_runs` entry for a provider has status `failed`
- **THEN** the summary endpoint still returns the last persisted cost data for that provider instead of an error

### Requirement: Cost breakdown API
The system SHALL provide an endpoint returning cost grouped by service name for a given provider and period.

#### Scenario: Breakdown by service
- **WHEN** an authenticated request asks for the OCI breakdown with period `last_6_months`
- **THEN** the system returns the total cost per service name for OCI over the last 6 closed months

### Requirement: Sync status API
The system SHALL provide an endpoint returning the most recent sync timestamp and status for a given provider.

#### Scenario: Status reflects last sync outcome
- **WHEN** an authenticated request asks for AWS sync status
- **THEN** the system returns the timestamp and status (`success` or `failed`) of the most recent AWS `sync_runs` entry

### Requirement: Dashboard tabs per cloud
The frontend SHALL present the AWS and Oracle Cloud cost views as separate tabs within the authenticated dashboard, each showing a trend chart, a service breakdown table, a period selector (current month / last 6 months), and a last-sync indicator.

#### Scenario: Switching tabs shows the matching provider's data
- **WHEN** the user selects the "Oracle Cloud" tab
- **THEN** the dashboard displays OCI's trend chart, breakdown table, and last-sync indicator for the selected period

#### Scenario: Failed last sync shows a warning
- **WHEN** the sync status for the active tab's provider is `failed`
- **THEN** the dashboard shows a non-blocking warning alongside the (possibly stale) cost data already displayed
