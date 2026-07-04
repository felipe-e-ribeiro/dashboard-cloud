## ADDED Requirements

### Requirement: Manual sync trigger per provider
The system SHALL allow triggering a sync for a single provider (`aws` or `oci`) on demand, running the sync asynchronously in the background so the triggering request returns immediately without waiting for the sync to finish.

#### Scenario: Trigger starts a background sync
- **WHEN** a manual trigger request is made for a provider with no sync currently running
- **THEN** the system starts `sync_provider()` for that provider in the background and responds without waiting for it to complete

#### Scenario: Trigger response returns before completion
- **WHEN** a manual trigger request is made for the OCI provider (which can take several minutes)
- **THEN** the HTTP response is returned immediately, before the sync has finished

### Requirement: Concurrent sync prevented per provider
The system SHALL reject a new manual trigger for a provider that already has a `sync_runs` entry with status `running` and no `finished_at`, without starting a duplicate sync.

#### Scenario: Trigger rejected while a sync is already running
- **WHEN** a manual trigger request is made for a provider that has an in-progress (`running`) sync
- **THEN** the system rejects the request without starting a second sync for that provider

#### Scenario: Trigger allowed after previous run finishes
- **WHEN** a manual trigger request is made for a provider whose most recent sync has already finished (`success` or `failed`)
- **THEN** the system starts a new sync for that provider
