"""initial schema: users, cost_records, sync_runs

Revision ID: 0001
Revises:
Create Date: 2026-07-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("auth_provider", sa.String(), nullable=False, server_default="local"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "cost_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("service_name", sa.String(), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 4), nullable=False),
        sa.Column("currency", sa.String(), nullable=False, server_default="USD"),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("provider", "service_name", "usage_date", name="uq_cost_record_provider_service_date"),
    )
    op.create_index("ix_cost_records_provider", "cost_records", ["provider"])
    op.create_index("ix_cost_records_service_name", "cost_records", ["service_name"])
    op.create_index("ix_cost_records_usage_date", "cost_records", ["usage_date"])

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("records_synced", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("ix_sync_runs_provider", "sync_runs", ["provider"])


def downgrade() -> None:
    op.drop_index("ix_sync_runs_provider", table_name="sync_runs")
    op.drop_table("sync_runs")

    op.drop_index("ix_cost_records_usage_date", table_name="cost_records")
    op.drop_index("ix_cost_records_service_name", table_name="cost_records")
    op.drop_index("ix_cost_records_provider", table_name="cost_records")
    op.drop_table("cost_records")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
