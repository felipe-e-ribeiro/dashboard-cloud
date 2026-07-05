"""exchange_rates table for USD->BRL conversion

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-05

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "exchange_rates",
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("rate", sa.Numeric(10, 4), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("exchange_rates")
