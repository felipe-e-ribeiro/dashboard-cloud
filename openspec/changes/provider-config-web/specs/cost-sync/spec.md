## MODIFIED Requirements

### Requirement: Daily sync per provider
The system SHALL run a scheduled job once per day that synchronizes cost data independently for AWS (via Cost Explorer) and for Oracle Cloud (via the OCI Usage API) using credentials loaded from encrypted, database-stored provider configuration, such that a failure in one provider's sync does not prevent or interrupt the other's, and such that a disabled provider is skipped entirely.

#### Scenario: Successful AWS sync records cost data
- **WHEN** the daily job runs and the AWS Cost Explorer call succeeds
- **THEN** the system upserts the returned per-service, per-day cost records for AWS into `cost_records`

#### Scenario: Successful OCI sync records cost data
- **WHEN** the daily job runs and the OCI Usage API call succeeds
- **THEN** the system upserts the returned per-service, per-day cost records for OCI into `cost_records`

#### Scenario: AWS failure does not block OCI sync
- **WHEN** the AWS sync step raises an error (e.g., invalid credentials, rate limit)
- **THEN** the system still attempts and completes the OCI sync step in the same run

#### Scenario: Disabled provider is skipped without a sync run record
- **WHEN** the daily job runs and a provider is disabled in its provider configuration
- **THEN** the system does not call that provider's cost API and does not create a `sync_runs` row for it in that execution

#### Scenario: Manual trigger also respects the disabled state
- **WHEN** a manual sync is triggered for a provider that is currently disabled
- **THEN** the system does not start a sync for that provider
