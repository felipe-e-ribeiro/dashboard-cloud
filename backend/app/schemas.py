from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    auth_provider: str


class TrendPoint(BaseModel):
    usage_date: date
    amount: float


class CostSummary(BaseModel):
    provider: str
    period: str
    currency: str
    total: float
    previous_total: float
    change_pct: float | None
    trend: list[TrendPoint]


class ServiceTrendPoint(BaseModel):
    month: str
    amount: float


class ServiceTrend(BaseModel):
    provider: str
    service_name: str
    currency: str
    points: list[ServiceTrendPoint]


class BreakdownItem(BaseModel):
    service_name: str
    amount: float


class CostBreakdown(BaseModel):
    provider: str
    period: str
    currency: str
    items: list[BreakdownItem]


class SyncStatus(BaseModel):
    provider: str
    status: str | None
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None


class SyncRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    started_at: datetime
    finished_at: datetime | None
    records_synced: int
    error_message: str | None


class SyncTriggerResponse(BaseModel):
    status: str


class ProviderStatus(BaseModel):
    provider: str
    enabled: bool
    configured: bool
    last_validated_at: datetime | None
    last_validation_status: str | None
    last_validation_error: str | None


class AwsCredentialsIn(BaseModel):
    access_key_id: str
    secret_access_key: str
    region: str


class OciCredentialsIn(BaseModel):
    tenancy_ocid: str
    user_ocid: str
    fingerprint: str
    region: str
    private_key_pem: str


class EnabledIn(BaseModel):
    enabled: bool
