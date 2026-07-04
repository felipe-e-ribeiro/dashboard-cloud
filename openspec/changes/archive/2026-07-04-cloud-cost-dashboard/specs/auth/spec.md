## ADDED Requirements

### Requirement: Local login
The system SHALL authenticate a single user via username and password stored (hashed) in PostgreSQL, exposed through a login endpoint that starts a session on success.

#### Scenario: Successful login
- **WHEN** the user submits the correct username and password
- **THEN** the system creates a session and returns success

#### Scenario: Invalid credentials
- **WHEN** the user submits an incorrect username or password
- **THEN** the system rejects the login attempt and does not create a session

### Requirement: Session-protected access
The system SHALL issue a JWT session token in an httpOnly cookie on successful login and SHALL require a valid session for every dashboard and cost API route.

#### Scenario: Authenticated request reaches protected route
- **WHEN** a request includes a valid session cookie
- **THEN** the system allows access to protected routes (dashboard pages and cost APIs)

#### Scenario: Unauthenticated request is rejected
- **WHEN** a request has no session cookie or an invalid/expired one
- **THEN** the system rejects the request with an unauthorized response and does not return cost data

### Requirement: Logout ends the session
The system SHALL invalidate the current session when the user logs out.

#### Scenario: Logout invalidates session
- **WHEN** an authenticated user calls the logout endpoint
- **THEN** the session cookie is cleared and subsequent requests with the old cookie are treated as unauthenticated

### Requirement: Admin user seeded from environment
The system SHALL create exactly one admin user on first startup using `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables, with `auth_provider` set to `local`, and SHALL NOT expose a public self-registration screen.

#### Scenario: First startup creates admin user
- **WHEN** the backend starts and the `users` table is empty
- **THEN** the system creates one user with the configured admin username, a hashed password, and `auth_provider = 'local'`

#### Scenario: Restart does not duplicate admin user
- **WHEN** the backend restarts and the admin user already exists
- **THEN** the system does not create a duplicate user or overwrite the existing password
