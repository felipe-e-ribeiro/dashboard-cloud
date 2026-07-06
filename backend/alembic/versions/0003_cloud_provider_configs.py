"""cloud_provider_configs table for web-based provider credentials

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cloud_provider_configs",
        sa.Column("provider", sa.String(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("encrypted_config", sa.LargeBinary(), nullable=False),
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_validation_status", sa.String(), nullable=True),
        sa.Column("last_validation_error", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("cloud_provider_configs")
