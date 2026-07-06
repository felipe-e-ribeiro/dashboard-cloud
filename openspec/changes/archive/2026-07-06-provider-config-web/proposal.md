## Why

AWS and OCI credentials currently live entirely in `.env` and a file mounted into the backend container, managed outside the application. The user wants to configure them through the dashboard itself, and be able to enable or disable each cloud independently — without weakening the security of credentials that grant full access to their cloud accounts.

## What Changes

- **BREAKING**: `.env`/`secrets/oci_key.pem` are no longer read for AWS/OCI credentials — replaced entirely by a new encrypted, database-backed configuration managed through the web UI. Existing deployments must reconfigure both providers via `/settings` after this change ships.
- New `cloud_provider_configs` table stores one row per provider (`aws`/`oci`): an `enabled` flag and the provider's credentials as a single JSON blob encrypted at rest (Fernet), plus the outcome of the last validation attempt.
- New required env var `SECRETS_ENCRYPTION_KEY` (a Fernet key) — the backend fails to start without it, same as `JWT_SECRET` today.
- `fetch_daily_costs_by_service()` in `aws_cost.py`/`oci_cost.py` now takes credentials as a parameter instead of reading `app.config.settings`; `sync_provider()` skips a provider entirely (no `sync_runs` row) when it's disabled, and loads its decrypted credentials from the new table instead of `settings`.
- New settings API: list provider status, save+validate a provider's credentials (tests the real fetcher with a 1-day range before persisting; a failure is not saved), and toggle `enabled` (blocked with `409` if the provider isn't configured yet).
- New `/settings` page: one card per provider with an enable/disable toggle, a form that is always blank (no credential value, secret or not, is ever redisplayed), a "Test and save" action, and the last validation outcome.
- `ProviderTabs` (Dashboard, Sync Logs) and `OverviewPanel` now only list providers with `enabled=true`; an empty state links to `/settings` when none are enabled.

## Capabilities

### New Capabilities

- `provider-config`: encrypted storage of per-provider cloud credentials, the enable/disable state, credential validation on save, and the `/settings` UI.

### Modified Capabilities

- `cost-sync`: the daily/manual sync now sources credentials from `provider-config` instead of environment variables, and skips disabled providers without recording a sync run.
- `cost-dashboard`: provider tabs and the Overview only show enabled providers; an empty state appears when none are enabled.

## Impact

- Backend: new `CloudProviderConfig` model + Alembic migration, new `app/services/secrets_crypto.py` (Fernet encrypt/decrypt) and `app/services/provider_config.py` (data-access layer), new `app/routers/settings.py`, changes to `aws_cost.py`, `oci_cost.py`, `sync.py`, `app/config.py` (drops `aws_*`/`oci_*` fields, adds `secrets_encryption_key`).
- Deployment: `.env.example` and `docker-compose.yml` lose the AWS/OCI env vars and the `oci_key.pem` volume mount; gain `SECRETS_ENCRYPTION_KEY`.
- Frontend: new `SettingsPage`, changes to `AppHeader` (new nav link), `ProviderTabs`, `OverviewPanel`, `api/client.ts`.
- New dependency: `cryptography` (Fernet) in `backend/requirements.txt`.
