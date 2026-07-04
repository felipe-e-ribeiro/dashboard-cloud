## 1. Project Scaffolding

- [x] 1.1 Create `backend/` FastAPI project structure (app, routers, models, services, alembic)
- [x] 1.2 Create `frontend/` React + Vite project structure
- [x] 1.3 Write `docker-compose.yml` with `postgres`, `backend`, `frontend` services
- [x] 1.4 Write `.env.example` documenting all required variables (DB, JWT, admin, AWS, OCI)
- [x] 1.5 Add OCI private key volume mount convention (`OCI_KEY_FILE_PATH`) to compose file

## 2. Database & Models

- [x] 2.1 Set up SQLAlchemy + Alembic in the backend
- [x] 2.2 Create `users` table/model (id, username, password_hash, auth_provider, created_at)
- [x] 2.3 Create `cost_records` table/model with unique constraint on (provider, service_name, usage_date)
- [x] 2.4 Create `sync_runs` table/model (provider, started_at, finished_at, status, error_message, records_synced)
- [x] 2.5 Write and run initial Alembic migration

## 3. Authentication (`auth` capability)

- [x] 3.1 Implement password hashing (bcrypt) and admin user seeding from `ADMIN_USERNAME`/`ADMIN_PASSWORD` on startup
- [x] 3.2 Implement `POST /auth/login` issuing a JWT in an httpOnly cookie
- [x] 3.3 Implement `POST /auth/logout` clearing the session cookie
- [x] 3.4 Implement `GET /auth/me` and an auth dependency/middleware protecting all `/api/*` routes
- [x] 3.5 Write pytest tests: successful login, invalid credentials, protected route rejects unauthenticated requests, admin seed is not duplicated on restart

## 4. Cost Sync — AWS (`cost-sync` capability)

- [x] 4.1 Implement AWS Cost Explorer client wrapper (`boto3`) fetching daily cost by service for a date range
- [x] 4.2 Implement upsert logic into `cost_records` for AWS results
- [x] 4.3 Implement backfill detection (no existing AWS records → fetch last 6 closed months + current month)
- [x] 4.4 Wrap AWS sync step with error handling that writes a `sync_runs` row (`success`/`failed`) and never raises to the caller

## 5. Cost Sync — OCI (`cost-sync` capability)

- [x] 5.1 Implement OCI Usage API client wrapper (OCI SDK) using tenancy/user OCID, fingerprint, region, and the mounted PEM key
- [x] 5.2 Implement upsert logic into `cost_records` for OCI results
- [x] 5.3 Implement backfill detection (no existing OCI records → fetch last 6 closed months + current month)
- [x] 5.4 Wrap OCI sync step with error handling that writes a `sync_runs` row (`success`/`failed`) and never raises to the caller

## 6. Scheduler

- [x] 6.1 Configure APScheduler inside the FastAPI process with a daily trigger
- [x] 6.2 Run AWS sync step and OCI sync step sequentially and independently (one's exception must not stop the other)
- [x] 6.3 Write pytest tests with mocked AWS/OCI clients: successful sync, AWS failure doesn't block OCI, re-sync of same day doesn't duplicate records, first sync backfills 6 months

## 7. Cost Dashboard API (`cost-dashboard` capability)

- [x] 7.1 Implement `GET /api/costs/summary?provider=&period=` (total + trend series from `cost_records`)
- [x] 7.2 Implement `GET /api/costs/breakdown?provider=&period=` (grouped by service_name)
- [x] 7.3 Implement `GET /api/sync/status?provider=` (latest `sync_runs` entry)
- [x] 7.4 Write pytest tests for summary/breakdown aggregation logic and for serving data when last sync failed

## 8. Frontend

- [x] 8.1 Implement login page (split layout: branding + form) calling `POST /auth/login`
- [x] 8.2 Implement authenticated route guard redirecting to login when session is invalid
- [x] 8.3 Implement dashboard layout with "AWS" / "Oracle Cloud" tabs
- [x] 8.4 Implement period selector (current month / last 6 months) per tab
- [x] 8.5 Implement trend chart (Recharts) and service breakdown table per tab
- [x] 8.6 Implement last-sync indicator and non-blocking failure warning per tab
- [x] 8.7 Write Vitest + React Testing Library tests for tabs, charts, and login flow using mocked API responses

## 9. Wiring & Finalization

- [x] 9.1 Wire frontend `/api` calls through the dev/proxy config to the backend service in docker-compose
- [x] 9.2 Verify `docker-compose up` boots postgres, backend (with migrations + admin seed), and frontend end-to-end
- [x] 9.3 Manually verify: login, tab switch, period switch, and a simulated sync failure showing the warning
- [x] 9.4 Update project README with setup instructions (env vars, OCI key mount, how to run)
