## 1. Backend — Manual Trigger (`cost-sync`)

- [ ] 1.1 Add a helper to check for an in-progress (`running`, no `finished_at`) `sync_runs` row for a given provider
- [ ] 1.2 Implement `POST /api/sync/trigger?provider=` that returns 409 if a sync is already running, otherwise starts `sync_provider()` in a background thread and responds immediately
- [ ] 1.3 Write pytest tests: trigger starts a background sync, trigger rejected while one is running, trigger allowed after previous run finishes

## 2. Backend — Sync History (`cost-dashboard`)

- [ ] 2.1 Implement `GET /api/sync/logs?provider=` returning the 20 most recent `sync_runs` for that provider, newest first
- [ ] 2.2 Write pytest tests for the logs endpoint (ordering, 20-row limit, empty history)

## 3. Frontend — Manual Sync Button

- [ ] 3.1 Add a "Sincronizar agora" button to `ProviderPanel`, calling the trigger endpoint
- [ ] 3.2 Disable the button and show a syncing state while the provider's sync status is `running`, polling `GET /api/sync/status` every ~3s
- [ ] 3.3 Refresh summary, breakdown, and sync status once the sync finishes
- [ ] 3.4 Write Vitest tests: button disables during sync, data refreshes after completion, trigger rejected (409) shows a message without crashing

## 4. Frontend — Sync Logs Page

- [ ] 4.1 Add `GET /api/sync/logs` call to the API client
- [ ] 4.2 Create a `SyncLogsPage` with AWS / Oracle Cloud tabs, each rendering a table of that provider's history
- [ ] 4.3 Add `/sync-logs` route (behind the existing auth guard) and a "Ver logs de sync" button in the dashboard header linking to it
- [ ] 4.4 Write Vitest tests for the sync logs page (tab switch, table rendering, empty state)

## 5. Wiring & Verification

- [ ] 5.1 Rebuild backend and frontend via `docker compose up -d --build` and manually verify: trigger a sync from the UI, confirm the button disables/re-enables, confirm data refreshes, confirm a concurrent trigger is rejected, and confirm `/sync-logs` shows the new run
- [ ] 5.2 Update README with a note on the manual sync button, the logs page, and how to recover an orphaned `running` sync_runs row after a backend restart
