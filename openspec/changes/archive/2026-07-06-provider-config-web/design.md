## Context

`app/config.py::Settings` currently reads `aws_access_key_id`/`aws_secret_access_key`/`aws_region` and `oci_tenancy_ocid`/`oci_user_ocid`/`oci_fingerprint`/`oci_region`/`oci_key_file_path` from `.env`; `oci_key_file_path` points at `secrets/oci_key.pem`, mounted read-only into the backend container by `docker-compose.yml`. `aws_cost.py`/`oci_cost.py` import `settings` directly and use these fields to build their SDK clients. This design moves that configuration into the application itself (encrypted in Postgres, edited via a new `/settings` page), decided and scoped with the user in `docs/superpowers/specs/2026-07-05-provider-config-web-design.md`.

## Goals / Non-Goals

**Goals:**
- Store AWS/OCI credentials encrypted at rest in Postgres, editable from a new authenticated `/settings` page.
- Validate credentials against the real cloud API before persisting them.
- Let the user enable/disable each provider independently; disabled providers are skipped by sync and hidden from navigation, without deleting their historical `cost_records`.

**Non-Goals:**
- Multiple accounts per cloud (still exactly one AWS account, one OCI tenancy).
- Automatic credential rotation.
- Re-backfilling the gap left by a disable→enable cycle (sync simply resumes from "today").
- Any fallback to `.env` for cloud credentials — this is a full replacement, not a seed/override layered on top of the old mechanism.

## Decisions

### 1. One encrypted JSON blob per provider, not per-field encrypted columns
`cloud_provider_configs.encrypted_config` holds the provider's entire credential set as a single Fernet-encrypted JSON payload. All fields of a provider are always read/written together (there's no use case for reading just the OCI fingerprint without the rest), so per-field encryption would add code with no benefit.

### 2. Encryption key lives in an env var, never in the database
`SECRETS_ENCRYPTION_KEY` (a Fernet key) is required at startup — `Settings` fails fast if it's missing, the same pattern already used for `JWT_SECRET`/`DATABASE_URL`. Keeping the key outside the database means a Postgres backup/leak alone doesn't expose the credentials. `app/services/secrets_crypto.py` is the only module that touches `Fernet` directly; everything else calls `encrypt(dict)`/`decrypt(bytes)`.

### 3. Validation reuses the production fetcher instead of a separate lightweight check
`PUT /api/settings/providers/{provider}` calls `fetch_daily_costs_by_service(today, today, credentials=...)` — the exact function the daily sync uses — before saving anything. **Alternative considered:** a cheaper call like AWS STS `get_caller_identity` — rejected because it would confirm the keys are valid without confirming they have Cost Explorer access, which is the actual failure mode worth catching early. The cost is a slower save (a real API round-trip), acceptable for an action a single user performs rarely.

### 4. Credentials are write-only from the API's perspective
`GET /api/settings/providers` never returns credential values — only `enabled`, `configured` (a row exists), and the last validation outcome. The edit form is always blank; saving requires re-entering every field for that provider, even to change just one value. **Alternative considered:** redisplaying non-secret fields (AWS access key ID, OCI OCIDs/fingerprint/region) to make partial edits easier — rejected per the user's explicit preference for the simpler, uniformly-blank form.

### 5. `sync_provider()` treats a disabled provider as absent, not as a failure
When `provider_config.is_enabled(db, provider)` is `false`, `sync_provider()` returns immediately without creating a `sync_runs` row — a disabled provider produces no audit trail entry, same as a provider that was never configured. This keeps `sync_runs`/the Sync Logs page meaningful (only real sync attempts appear) and requires no change to the daily scheduler or the manual trigger endpoint, since the check lives inside the one function both call.

### 6. Credentials move from `settings` to function parameters, not a second global
`fetch_daily_costs_by_service(start, end, credentials: dict)` takes credentials explicitly instead of reading a module-level object. This makes both call sites (the real sync, and the validation call in the settings endpoint) pass credentials the same way, and makes it obvious from the function signature that nothing here reads global config anymore.

## Risks / Trade-offs

- **[Risk] Losing `SECRETS_ENCRYPTION_KEY` makes all stored credentials unrecoverable** → same class of risk as losing `JWT_SECRET` today, but with a larger blast radius (both cloud accounts need reconfiguring, not just re-login). Mitigation: document in the README that this key must be backed up like any other permanent secret once generated.
- **[Trade-off] No backfill after a disable→enable cycle** → a gap appears in the trend chart for the days a provider was off. Accepted as consistent with the existing initial-backfill-only behavior.
- **[Trade-off] Synchronous validation adds latency to `PUT /api/settings/providers/{provider}`** → acceptable given how infrequently a single user edits these settings; not worth a background job.
- **[Risk] No `.env` fallback means the dashboard has zero enabled providers immediately after this ships** → until the user visits `/settings` and reconfigures both providers, the Overview/tabs show the "no providers enabled" empty state. This is an expected, one-time migration step, not an ongoing risk.

## Migration Plan

- New Alembic migration adds `cloud_provider_configs` (empty on creation — no data migration from `.env` is attempted, since the whole point is to stop trusting env-sourced secrets as the source of truth).
- Deploy requires setting `SECRETS_ENCRYPTION_KEY` in `.env` before the backend starts (document the generation command in `.env.example`); `docker-compose.yml` drops the `oci_key.pem` volume mount and the AWS/OCI env vars.
- Immediately after deploy, the user visits `/settings`, configures and enables both providers. Until then, no provider syncs and the dashboard shows the empty state — expected, not a bug.
- Rollback: revert the deploy and restore the previous `.env` (still valid, since this change doesn't delete `.env`, just stops reading cloud-credential fields from it) and `docker-compose.yml`; `cloud_provider_configs` can be dropped or left unused.

## Open Questions

None — all storage, validation, and disable-behavior decisions were made during design review.
