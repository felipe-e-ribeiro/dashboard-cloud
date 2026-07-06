from app.models import CloudProviderConfig
from app.services import provider_config


def _login(client):
    client.post("/auth/login", json={"username": "admin", "password": "admin-password"})


def _aws_payload():
    return {"access_key_id": "AKIA123", "secret_access_key": "shh", "region": "us-east-1"}


def _oci_payload():
    return {
        "tenancy_ocid": "ocid1.tenancy.oc1..aaa",
        "user_ocid": "ocid1.user.oc1..bbb",
        "fingerprint": "aa:bb:cc",
        "region": "us-ashburn-1",
        "private_key_pem": "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
    }


def test_list_providers_requires_auth(client):
    response = client.get("/api/settings/providers")
    assert response.status_code == 401


def test_list_providers_never_includes_credential_values(client, db_session, monkeypatch):
    from app.routers import settings as settings_router

    monkeypatch.setattr(settings_router, "fetch_aws_costs", lambda start, end, credentials: [])
    _login(client)

    client.put("/api/settings/providers/aws", json=_aws_payload())
    response = client.get("/api/settings/providers")

    assert response.status_code == 200
    body = {item["provider"]: item for item in response.json()}
    assert body["aws"]["configured"] is True
    assert body["aws"]["enabled"] is False
    assert "access_key_id" not in body["aws"]
    assert "secret_access_key" not in body["aws"]
    assert body["oci"]["configured"] is False


def test_save_valid_aws_credentials_succeeds(client, db_session, monkeypatch):
    from app.routers import settings as settings_router

    monkeypatch.setattr(settings_router, "fetch_aws_costs", lambda start, end, credentials: [])
    _login(client)

    response = client.put("/api/settings/providers/aws", json=_aws_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert body["last_validation_status"] == "success"
    assert provider_config.get_decrypted(db_session, "aws") == _aws_payload()


def test_save_invalid_credentials_is_not_persisted(client, db_session, monkeypatch):
    from app.routers import settings as settings_router

    def failing_fetch(start, end, credentials):
        raise RuntimeError("invalid credentials")

    monkeypatch.setattr(settings_router, "fetch_aws_costs", failing_fetch)
    _login(client)

    response = client.put("/api/settings/providers/aws", json=_aws_payload())

    assert response.status_code == 400
    assert "invalid credentials" in response.json()["detail"]
    assert db_session.query(CloudProviderConfig).filter_by(provider="aws").count() == 0


def test_save_invalid_credentials_does_not_overwrite_existing(client, db_session, monkeypatch):
    from datetime import datetime, timezone

    from app.routers import settings as settings_router

    provider_config.save_validated(db_session, "aws", _aws_payload(), datetime.now(timezone.utc))

    def failing_fetch(start, end, credentials):
        raise RuntimeError("bad new creds")

    monkeypatch.setattr(settings_router, "fetch_aws_costs", failing_fetch)
    _login(client)

    bad_payload = {"access_key_id": "WRONG", "secret_access_key": "wrong", "region": "us-east-1"}
    response = client.put("/api/settings/providers/aws", json=bad_payload)

    assert response.status_code == 400
    assert provider_config.get_decrypted(db_session, "aws") == _aws_payload()


def test_enable_unconfigured_provider_rejected(client):
    _login(client)
    response = client.put("/api/settings/providers/aws/enabled", json={"enabled": True})
    assert response.status_code == 409


def test_enable_configured_provider_succeeds(client, db_session, monkeypatch):
    from app.routers import settings as settings_router

    monkeypatch.setattr(settings_router, "fetch_oci_costs", lambda start, end, credentials: [])
    _login(client)

    client.put("/api/settings/providers/oci", json=_oci_payload())
    response = client.put("/api/settings/providers/oci/enabled", json={"enabled": True})

    assert response.status_code == 200
    assert response.json()["enabled"] is True

    disable_response = client.put("/api/settings/providers/oci/enabled", json={"enabled": False})
    assert disable_response.status_code == 200
    assert disable_response.json()["enabled"] is False
