## ADDED Requirements

### Requirement: Sync history API
The system SHALL provide an endpoint returning the most recent 20 `sync_runs` entries for a given provider, ordered by start time descending.

#### Scenario: History returns the most recent runs
- **WHEN** an authenticated request asks for the sync history of a provider with more than 20 recorded runs
- **THEN** the system returns exactly the 20 most recent runs for that provider, newest first

### Requirement: Manual sync button per tab
Each dashboard tab SHALL show a button to trigger a sync for that tab's provider. The button SHALL be disabled and show a "Sincronizando..." state while that provider's latest sync is running, and the tab's cost data SHALL refresh once the sync finishes.

#### Scenario: Button disabled while sync in progress
- **WHEN** the user triggers a sync from a tab
- **THEN** the button becomes disabled and shows a syncing state until the provider's sync status is no longer `running`

#### Scenario: Tab data refreshes after sync completes
- **WHEN** a triggered sync for the active tab's provider finishes
- **THEN** the tab's summary, breakdown, and last-sync indicator refresh to reflect the new data without a manual page reload

### Requirement: Sync logs page
The system SHALL provide a `/sync-logs` page with separate AWS and Oracle Cloud tabs, each showing a table of that provider's sync history, reachable via a button in the dashboard header.

#### Scenario: Sync logs page shows per-provider history
- **WHEN** the user navigates to `/sync-logs` and selects the AWS tab
- **THEN** the page shows a table of AWS sync runs (start time, status, records synced, error message when present)

#### Scenario: Header button navigates to the logs page
- **WHEN** the user clicks "Ver logs de sync" in the dashboard header
- **THEN** the application navigates to `/sync-logs`
