## ADDED Requirements

### Requirement: Daily exchange rate sync
The system SHALL run a scheduled job once per day that fetches and stores the USD→BRL exchange rate for any date not yet present in `exchange_rates`, independently of and without blocking the AWS/OCI cost sync steps.

#### Scenario: Successful sync stores missing rates
- **WHEN** the daily job runs and there are dates since the last successful exchange-rate sync with no stored rate
- **THEN** the system fetches and upserts the USD→BRL rate for each missing date into `exchange_rates`

#### Scenario: Exchange rate sync failure does not block cost sync
- **WHEN** the exchange rate sync step raises an error (e.g., the external rate API is unreachable)
- **THEN** the AWS and OCI cost sync steps still run and complete in the same scheduled execution

#### Scenario: Startup sync backfills rates without waiting for the schedule
- **WHEN** the backend process starts and `exchange_rates` is missing dates within the range covered by existing `cost_records`
- **THEN** the system attempts to backfill those missing rates immediately, without waiting for the next scheduled run, and without failing application startup if the attempt errors

### Requirement: Exchange rate backfill
The system SHALL, when `exchange_rates` has no data yet, fetch and store rates for the same historical range used for the initial cost backfill (last 6 closed months plus the current month) instead of only the current day.

#### Scenario: First sync backfills 6 months of rates
- **WHEN** the exchange rate sync runs and `exchange_rates` is empty
- **THEN** the system fetches and stores the USD→BRL rate for each date in the last 6 closed months and the current month, where published by the rate source
