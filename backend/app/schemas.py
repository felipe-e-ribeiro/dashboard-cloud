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
    trend: list[TrendPoint]


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
