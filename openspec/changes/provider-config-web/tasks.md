## 1. Backend: data model and encryption

- [x] 1.1 Add `cryptography` to `backend/requirements.txt` (pin to the installed `49.0.0` or newer compatible version).
- [x] 1.2 Add `secrets_encryption_key: str` (required, no default) to `Settings` in `app/config.py`; remove `aws_access_key_id`, `aws_secret_access_key`, `aws_region`, `oci_tenancy_ocid`, `oci_user_ocid`, `oci_fingerprint`, `oci_region`, `oci_key_file_path`.
- [x] 1.3 Add `CloudProviderConfig` model in `app/models.py` (`provider` PK, `enabled: bool` default `False`, `encrypted_config: bytes`, `last_validated_at: datetime | None`, `last_validation_status: str | None`, `last_validation_error: str | None`), plus Alembic migration `0003_cloud_provider_configs.py`.
- [x] 1.4 Create `app/services/secrets_crypto.py`: `encrypt(data: dict) -> bytes` / `decrypt(blob: bytes) -> dict` using `Fernet(settings.secrets_encryption_key)` and JSON serialization.
- [x] 1.5 Create `app/services/provider_config.py`: `is_enabled(db, provider) -> bool`, `is_configured(db, provider) -> bool`, `get_decrypted(db, provider) -> dict | None`, `save_validated(db, provider, credentials, validated_at)`, `set_enabled(db, provider, enabled) -> None` (raises if enabling an unconfigured provider).
- [x] 1.6 Add backend tests: `secrets_crypto` roundtrip, `provider_config` CRUD (save, `is_enabled` default false, `set_enabled` rejects enabling unconfigured provider, disabling doesn't touch `cost_records`).

## 2. Backend: sync reads credentials from provider_config

- [x] 2.1 Change `fetch_daily_costs_by_service(start, end_inclusive)` in `app/services/aws_cost.py` to `fetch_daily_costs_by_service(start, end_inclusive, credentials: dict)`, building the boto3 client from `credentials` instead of `settings`.
- [x] 2.2 Change `fetch_daily_costs_by_service(start, end_inclusive)` in `app/services/oci_cost.py` to accept `credentials: dict` the same way, building the OCI client config from it instead of `settings`.
- [x] 2.3 Update `sync_provider()` in `app/services/sync.py`: return immediately (no `SyncRun` row created) if `provider_config.is_enabled(db, provider)` is `False`; otherwise load `provider_config.get_decrypted(db, provider)` and pass it to the provider's fetcher.
- [x] 2.4 Update backend tests in `test_cost_sync.py`/`test_sync_control.py` for the new `credentials` parameter and the disabled-provider-skips-sync behavior (including the manual trigger endpoint).

## 3. Backend: settings API

- [x] 3.1 Add Pydantic schemas in `app/schemas.py`: `ProviderStatus` (`provider`, `enabled`, `configured`, `last_validated_at`, `last_validation_status`, `last_validation_error`), `AwsCredentialsIn`, `OciCredentialsIn`, `EnabledIn` (`enabled: bool`).
- [x] 3.2 Create `app/routers/settings.py`: `GET /api/settings/providers` (list `ProviderStatus` for `aws` and `oci`); `PUT /api/settings/providers/{provider}` (validates provider name, calls the real fetcher with `credentials` for a 1-day range, on success encrypts+upserts via `provider_config.save_validated` and returns `ProviderStatus`, on failure returns `400` with the error message and does not persist); `PUT /api/settings/providers/{provider}/enabled` (calls `provider_config.set_enabled`, returns `409` if enabling an unconfigured provider). Register the router in `app/main.py`. (Implemented as two concrete routes `PUT /providers/aws` / `PUT /providers/oci` instead of one templated `{provider}` route, since each provider needs a different, strongly-typed request body — same external behavior.)
- [x] 3.3 Add backend tests: `GET` never includes credential fields; `PUT` with valid mocked credentials saves and returns success; `PUT` with failing mocked credentials returns `400` and leaves any prior saved config untouched; enabling an unconfigured provider returns `409`; enabling a configured provider succeeds.

## 4. Deployment config

- [x] 4.1 Update `.env.example`: remove the AWS/OCI credential vars, add `SECRETS_ENCRYPTION_KEY` with a comment showing the generation command (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
- [x] 4.2 Update `docker-compose.yml`: remove the `secrets/oci_key.pem` volume mount from the `backend` service (no longer read from a file).
- [x] 4.3 Update `secrets/README.md` to reflect that OCI's private key is now pasted into the `/settings` page instead of mounted as a file (or remove the file if it's no longer needed for anything else).

## 5. Frontend: API client and settings page

- [x] 5.1 Add `ProviderStatus`, `AwsCredentials`, `OciCredentials` types and `api.getProviderStatuses()`, `api.saveProviderCredentials(provider, credentials)`, `api.setProviderEnabled(provider, enabled)` to `api/client.ts`.
- [x] 5.2 Create `SettingsPage` (`pages/SettingsPage.tsx`): fetches provider statuses on mount; renders one card per provider with an enable/disable toggle (disabled if `!configured`), a blank credentials form (AWS: access key ID, secret access key, region; OCI: tenancy OCID, user OCID, fingerprint, region, private key textarea), a "Testar e salvar" button with a loading state, and the last validation outcome (timestamp + success/error message).
- [x] 5.3 Add the `/settings` route in `App.tsx` (authenticated, same `RequireAuth` wrapper as Dashboard/Sync Logs) and a "Configurações" link in `AppHeader` next to "Ver logs de sync".

## 6. Frontend: navigation respects enabled providers

- [x] 6.1 Update `DashboardPage`/`ProviderTabs` to fetch provider statuses and only show tabs (Overview + per-provider) for enabled providers; show an empty-state message linking to `/settings` when none are enabled.
- [x] 6.2 Update `SyncLogsPage` the same way (only enabled providers' tabs).
- [x] 6.3 Update `OverviewPanel` to only fetch/render cards for enabled providers (it already tolerates a provider failing to load; reuse that same code path by simply not including disabled providers in the list it iterates).

## 7. Tests and verification

- [x] 7.1 Add frontend tests: `SettingsPage` (loads statuses, submits a form and shows success/error, enable/disable toggle disabled when unconfigured), Dashboard/SyncLogs empty state when no providers enabled, tabs reflect only enabled providers.
- [x] 7.2 Run full backend (`pytest`) and frontend (`npm test`, `npx tsc -b`) suites; fix regressions from the credential-plumbing and navigation-filtering changes.
- [x] 7.3 Manually verify end to end: with `docker compose up -d --build`, confirm the backend fails to start without `SECRETS_ENCRYPTION_KEY`, then with it set, configure AWS/OCI via `/settings` (including an intentionally wrong credential to see the validation error), enable both, confirm sync starts working and the dashboard shows their tabs; disable one and confirm its tab disappears and its historical data is untouched in the database. (Verified: startup fails without the key, starts and migrates with it; Settings page loads both cards as unconfigured/disabled; a wrong AWS credential is rejected with the real AWS error and left unsaved; Dashboard/Sync Logs correctly show the "no providers enabled" empty state with a link to /settings. Enabling with real AWS/OCI credentials was left to the user, since entering real cloud secrets isn't something this session should do on their behalf.)
