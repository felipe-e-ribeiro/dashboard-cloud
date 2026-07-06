from datetime import datetime

from sqlalchemy.orm import Session

from ..models import CloudProviderConfig
from . import secrets_crypto


class ProviderNotConfiguredError(Exception):
    pass


def _get(db: Session, provider: str) -> CloudProviderConfig | None:
    return db.query(CloudProviderConfig).filter(CloudProviderConfig.provider == provider).first()


def is_configured(db: Session, provider: str) -> bool:
    return _get(db, provider) is not None


def is_enabled(db: Session, provider: str) -> bool:
    config = _get(db, provider)
    return bool(config and config.enabled)


def get_decrypted(db: Session, provider: str) -> dict | None:
    config = _get(db, provider)
    if config is None:
        return None
    return secrets_crypto.decrypt(config.encrypted_config)


def save_validated(db: Session, provider: str, credentials: dict, validated_at: datetime) -> CloudProviderConfig:
    encrypted = secrets_crypto.encrypt(credentials)
    config = _get(db, provider)
    if config:
        config.encrypted_config = encrypted
        config.last_validated_at = validated_at
        config.last_validation_status = "success"
        config.last_validation_error = None
    else:
        config = CloudProviderConfig(
            provider=provider,
            enabled=False,
            encrypted_config=encrypted,
            last_validated_at=validated_at,
            last_validation_status="success",
            last_validation_error=None,
        )
        db.add(config)
    db.commit()
    db.refresh(config)
    return config


def set_enabled(db: Session, provider: str, enabled: bool) -> CloudProviderConfig:
    config = _get(db, provider)
    if config is None:
        raise ProviderNotConfiguredError(f"Provider {provider} has no saved credentials")
    config.enabled = enabled
    db.commit()
    db.refresh(config)
    return config
