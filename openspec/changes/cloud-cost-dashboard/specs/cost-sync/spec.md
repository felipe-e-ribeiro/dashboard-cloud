## ADDED Requirements

### Requirement: Daily sync per provider
The system SHALL run a scheduled job once per day that synchronizes cost data independently for AWS (via Cost Explorer) and for Oracle Cloud (via the OCI Usage API), such that a failure in one provider's sync does not prevent or interrupt the other's.

#### Scenario: Successful AWS sync records cost data
- **WHEN** the daily job runs and the AWS Cost Explorer call succeeds
- **THEN** the system upserts the returned per-service, per-day cost records for AWS into `cost_records`

#### Scenario: Successful OCI sync records cost data
- **WHEN** the daily job runs and the OCI Usage API call succeeds
- **THEN** the system upserts the returned per-service, per-day cost records for OCI into `cost_records`

#### Scenario: AWS failure does not block OCI sync
- **WHEN** the AWS sync step raises an error (e.g., invalid credentials, rate limit)
- **THEN** the system still attempts and completes the OCI sync step in the same run

### Requirement: Initial backfill
The system SHALL, on the first sync for a given provider (no existing `cost_records` for that provider), fetch and store the last 6 closed months plus the current month, instead of only the current day.

#### Scenario: First sync backfills 6 months
- **WHEN** the daily job runs for a provider with no existing `cost_records`
- **THEN** the system fetches and stores cost data for the last 6 closed months and the current month for that provider

### Requirement: Idempotent upsert
The system SHALL store at most one `cost_records` row per unique combination of provider, service name, and usage date, updating the amount on re-sync instead of creating duplicates.

#### Scenario: Re-running sync for the same day does not duplicate
- **WHEN** the sync job runs twice for the same provider and the same usage date
- **THEN** `cost_records` contains a single row for that provider/service/date with the latest synced amount

### Requirement: Sync run auditing
The system SHALL record one `sync_runs` entry per provider per execution, capturing start time, end time, status (success or failed), and an error message when applicable.

#### Scenario: Successful sync is recorded
- **WHEN** a provider's sync step completes without error
- **THEN** the system writes a `sync_runs` row with status `success` and the number of records synced

#### Scenario: Failed sync is recorded with error detail
- **WHEN** a provider's sync step raises an error
- **THEN** the system writes a `sync_runs` row with status `failed` and a non-empty error message, without raising an unhandled exception that crashes the process
