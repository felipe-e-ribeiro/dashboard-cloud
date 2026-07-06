from datetime import datetime, timezone

import pytest

from app.models import CostRecord
from app.services import provider_config, secrets_crypto


def test_secrets_crypto_roundtrip():
    data = {"access_key_id": "AKIA123", "secret_access_key": "shh", "region": "us-east-1"}

    encrypted = secrets_crypto.encrypt(data)

    assert encrypted != data
    assert secrets_crypto.decrypt(encrypted) == data


def test_is_enabled_defaults_false_when_unconfigured(db_session):
    assert provider_config.is_enabled(db_session, "aws") is False
    assert provider_config.is_configured(db_session, "aws") is False


def test_save_validated_persists_encrypted_credentials(db_session):
    now = datetime.now(timezone.utc)
    creds = {"access_key_id": "AKIA123", "secret_access_key": "shh", "region": "us-east-1"}

    provider_config.save_validated(db_session, "aws", creds, now)

    assert provider_config.is_configured(db_session, "aws") is True
    assert provider_config.is_enabled(db_session, "aws") is False  # saving doesn't auto-enable
    assert provider_config.get_decrypted(db_session, "aws") == creds


def test_set_enabled_rejects_unconfigured_provider(db_session):
    with pytest.raises(provider_config.ProviderNotConfiguredError):
        provider_config.set_enabled(db_session, "aws", True)


def test_set_enabled_succeeds_once_configured(db_session):
    now = datetime.now(timezone.utc)
    provider_config.save_validated(db_session, "oci", {"tenancy_ocid": "ocid1..."}, now)

    provider_config.set_enabled(db_session, "oci", True)
    assert provider_config.is_enabled(db_session, "oci") is True

    provider_config.set_enabled(db_session, "oci", False)
    assert provider_config.is_enabled(db_session, "oci") is False


def test_disabling_provider_does_not_touch_cost_records(db_session):
    from datetime import date

    now = datetime.now(timezone.utc)
    provider_config.save_validated(db_session, "aws", {"access_key_id": "AKIA123"}, now)
    provider_config.set_enabled(db_session, "aws", True)
    db_session.add(CostRecord(provider="aws", service_name="EC2", usage_date=date.today(), amount=1.0, currency="USD"))
    db_session.commit()

    provider_config.set_enabled(db_session, "aws", False)

    assert db_session.query(CostRecord).filter_by(provider="aws").count() == 1
