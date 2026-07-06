## ADDED Requirements

### Requirement: Encrypted credential storage
The system SHALL store each cloud provider's credentials (AWS: access key ID, secret access key, region; OCI: tenancy OCID, user OCID, fingerprint, region, private key PEM) encrypted at rest in a single per-provider record, using an encryption key supplied only via environment variable and never persisted in the database.

#### Scenario: Credentials are not stored in plain text
- **WHEN** a provider's credentials are saved
- **THEN** the persisted record contains only an encrypted payload, not the plain-text field values

#### Scenario: Missing encryption key prevents startup
- **WHEN** the backend starts without the encryption key configured
- **THEN** the application fails to start instead of falling back to storing credentials unencrypted

### Requirement: Credential validation before save
The system SHALL test a provider's submitted credentials against that provider's real cost API before persisting them, and SHALL NOT save the credentials if the test fails.

#### Scenario: Valid credentials are saved
- **WHEN** the user submits credentials for a provider and the test call to that provider's cost API succeeds
- **THEN** the system encrypts and stores the credentials, and records a successful validation with a timestamp

#### Scenario: Invalid credentials are rejected
- **WHEN** the user submits credentials for a provider and the test call fails
- **THEN** the system does not store the submitted credentials, returns the error to the user, and leaves any previously saved credentials for that provider unchanged

### Requirement: Provider enable/disable
The system SHALL let the user enable or disable each provider independently, and SHALL refuse to enable a provider that has no saved credentials.

#### Scenario: Enabling a configured provider
- **WHEN** the user enables a provider that already has saved credentials
- **THEN** the provider becomes enabled and is included in future sync runs

#### Scenario: Enabling an unconfigured provider is rejected
- **WHEN** the user attempts to enable a provider with no saved credentials
- **THEN** the system rejects the request without changing the provider's enabled state

#### Scenario: Disabling a provider does not delete its data
- **WHEN** the user disables a provider
- **THEN** the provider's previously synced cost records remain in the database unchanged

### Requirement: Credentials are never redisplayed
The system SHALL NOT return any previously saved credential value (secret or non-secret) through the API; only the provider's configured/enabled state and last validation outcome are readable.

#### Scenario: Listing providers omits credential values
- **WHEN** an authenticated request lists provider configuration status
- **THEN** the response includes `enabled`, `configured`, and the last validation outcome, but no credential field values

### Requirement: Settings page
The frontend SHALL provide an authenticated settings page showing one card per provider, each with an enable/disable toggle, a credentials form that starts blank on every visit, a save action that reports the validation outcome, and the timestamp/result of the last validation.

#### Scenario: Saving invalid credentials shows the error inline
- **WHEN** the user submits a provider's form and validation fails
- **THEN** the settings page displays the returned error without navigating away or clearing the enabled toggle of other providers
