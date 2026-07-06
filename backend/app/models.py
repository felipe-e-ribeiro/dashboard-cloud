from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Integer, LargeBinary, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    auth_provider: Mapped[str] = mapped_column(String, default="local")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class CostRecord(Base):
    __tablename__ = "cost_records"
    __table_args__ = (
        UniqueConstraint("provider", "service_name", "usage_date", name="uq_cost_record_provider_service_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String, index=True)
    service_name: Mapped[str] = mapped_column(String, index=True)
    usage_date: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 4))
    currency: Mapped[str] = mapped_column(String, default="USD")
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    rate: Mapped[float] = mapped_column(Numeric(10, 4))


class CloudProviderConfig(Base):
    __tablename__ = "cloud_provider_configs"

    provider: Mapped[str] = mapped_column(String, primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=False)
    encrypted_config: Mapped[bytes] = mapped_column(LargeBinary)
    last_validated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_validation_status: Mapped[str | None] = mapped_column(String, nullable=True)
    last_validation_error: Mapped[str | None] = mapped_column(String, nullable=True)


class SyncRun(Base):
    __tablename__ = "sync_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    provider: Mapped[str] = mapped_column(String, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    records_synced: Mapped[int] = mapped_column(Integer, default=0)
