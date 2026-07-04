## 1. Project Scaffolding

- [ ] 1.1 Create `backend/` FastAPI project structure (app, routers, models, services, alembic)
- [ ] 1.2 Create `frontend/` React + Vite project structure
- [ ] 1.3 Write `docker-compose.yml` with `postgres`, `backend`, `frontend` services
- [ ] 1.4 Write `.env.example` documenting all required variables (DB, JWT, admin, AWS, OCI)
- [ ] 1.5 Add OCI private key volume mount convention (`OCI_KEY_FILE_PATH`) to compose file

## 2. Database & Models

- [ ] 2.1 Set up SQLAlchemy + Alembic in the backend
- [ ] 2.2 Create `users` table/model (id, username, password_hash, auth_provider, created_at)
- [ ] 2.3 Create `cost_records` table/model with unique constraint on (provider, service_name, usage_date)
- [ ] 2.4 Create `sync_runs` table/model (provider, started_at, finished_at, status, error_message, records_synced)
- [ ] 2.5 Write and run initial Alembic migration

## 3. Authentication (`auth` capability)

- [ ] 3.1 Implement password hashing (bcrypt) and admin user seeding from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup
- [ ] 3.2 Implement `POST /auth/login` issuing a JWT in an httpOnly cookie
- [ ] 3.3 Implement `POST /auth/logout` clearing the session cookie
- [ ] 3.4 Implement `GET /auth/me` and an auth dependency/middleware protecting all `/api/*` routes
- [ ] 3.5 Write pytest tests: successful login, invalid credentials, protected route rejects unauthenticated requests, admin seed is not duplicated on restart

## 4. Cost Sync — AWS (`cost-sync` capability)

- [ ] 4.1 Implement AWS Cost Explorer client wrapper (`boto3`) fetching daily cost by service for a date range
- [ ] 4.2 Implement upsert logic into `cost_records` for AWS results
- [ ] 4.3 Implement backfill detection (no existing AWS records → fetch last 6 closed months + current month)
- [ ] 4.4 Wrap AWS sync step with error handling that writes a `sync_runs` row (`success`/`failed`) and never raises to the caller

## 5. Cost Sync — OCI (`cost-sync` capability)

- [ ] 5.1 Implement OCI Usage API client wrapper (OCI SDK) using tenancy/user OCID, fingerprint, region, and the mounted PEM key
- [ ] 5.2 Implement upsert logic into `cost_records` for OCI results
- [ ] 5.3 Implement backfill detection (no existing OCI records → fetch last 6 closed months + current month)
- [ ] 5.4 Wrap OCI sync step with error handling that writes a `sync_runs` row (`success`/`failed`) and never raises to the caller

## 6. Scheduler

- [ ] 6.1 Configure APScheduler inside the FastAPI process with a daily trigger
- [ ] 6.2 Run AWS sync step and OCI sync step sequentially and independently (one's exception must not stop the other)
- [ ] 6.3 Write pytest tests with mocked AWS/OCI clients: successful sync, AWS failure doesn't block OCI, re-sync of same day doesn't duplicate records, first sync backfills 6 months

## 7. Cost Dashboard API (`cost-dashboard` capability)

- [ ] 7.1 Implement `GET /api/costs/summary?provider=&period=` (total + trend series from `cost_records`)
- [ ] 7.2 Implement `GET /api/costs/breakdown?provider=&period=` (grouped by service_name)
- [ ] 7.3 Implement `GET /api/sync/status?provider=` (latest `sync_runs` entry)
- [ ] 7.4 Write pytest tests for summary/breakdown aggregation logic and for serving data when last sync failed

## 8. Frontend

- [ ] 8.1 Implement login page (split layout: branding + form) calling `POST /auth/login`
- [ ] 8.2 Implement authenticated route guard redirecting to login when session is invalid
- [ ] 8.3 Implement dashboard layout with "AWS" / "Oracle Cloud" tabs
- [ ] 8.4 Implement period selector (current month / last 6 months) per tab
- [ ] 8.5 Implement trend chart (Recharts) and service breakdown table per tab
- [ ] 8.6 Implement last-sync indicator and non-blocking failure warning per tab
- [ ] 8.7 Write Vitest + React Testing Library tests for tabs, charts, and login flow using mocked API responses

## 9. Wiring & Finalization

- [ ] 9.1 Wire frontend `/api` calls through the dev/proxy config to the backend service in docker-compose
- [ ] 9.2 Verify `docker-compose up` boots postgres, backend (with migrations + admin seed), and frontend end-to-end
- [ ] 9.3 Manually verify: login, tab switch, period switch, and a simulated sync failure showing the warning
- [ ] 9.4 Update project README with setup instructions (env vars, OCI key mount, how to run)
