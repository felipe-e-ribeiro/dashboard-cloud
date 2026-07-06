from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import CloudProviderConfig
from ..schemas import AwsCredentialsIn, EnabledIn, OciCredentialsIn, ProviderStatus
from ..services import provider_config
from ..services.aws_cost import fetch_daily_costs_by_service as fetch_aws_costs
from ..services.oci_cost import fetch_daily_costs_by_service as fetch_oci_costs

router = APIRouter(prefix="/api/settings", tags=["settings"])

VALID_PROVIDERS = {"aws", "oci"}


def _status(db: Session, provider: str) -> ProviderStatus:
    config = db.query(CloudProviderConfig).filter(CloudProviderConfig.provider == provider).first()
    if config is None:
        return ProviderStatus(
            provider=provider,
            enabled=False,
            configured=False,
            last_validated_at=None,
            last_validation_status=None,
            last_validation_error=None,
        )
    return ProviderStatus(
        provider=provider,
        enabled=config.enabled,
        configured=True,
        last_validated_at=config.last_validated_at,
        last_validation_status=config.last_validation_status,
        last_validation_error=config.last_validation_error,
    )


@router.get("/providers", response_model=list[ProviderStatus])
def list_providers(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return [_status(db, provider) for provider in sorted(VALID_PROVIDERS)]


@router.put("/providers/aws", response_model=ProviderStatus)
def save_aws_credentials(
    body: AwsCredentialsIn,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    credentials = body.model_dump()
    today = date.today()
    try:
        fetch_aws_costs(today, today, credentials)
    except Exception as exc:  # noqa: BLE001 - surface the cloud API's error to the user
        message = getattr(exc, "message", None) or str(exc)
        raise HTTPException(status_code=400, detail=message) from exc

    provider_config.save_validated(db, "aws", credentials, datetime.now(timezone.utc))
    return _status(db, "aws")


@router.put("/providers/oci", response_model=ProviderStatus)
def save_oci_credentials(
    body: OciCredentialsIn,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    credentials = body.model_dump()
    today = date.today()
    try:
        fetch_oci_costs(today, today, credentials)
    except Exception as exc:  # noqa: BLE001 - surface the cloud API's error to the user
        message = getattr(exc, "message", None) or str(exc)
        raise HTTPException(status_code=400, detail=message) from exc

    provider_config.save_validated(db, "oci", credentials, datetime.now(timezone.utc))
    return _status(db, "oci")


@router.put("/providers/{provider}/enabled", response_model=ProviderStatus)
def set_provider_enabled(
    provider: str,
    body: EnabledIn,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")

    try:
        provider_config.set_enabled(db, provider, body.enabled)
    except provider_config.ProviderNotConfiguredError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    return _status(db, provider)
