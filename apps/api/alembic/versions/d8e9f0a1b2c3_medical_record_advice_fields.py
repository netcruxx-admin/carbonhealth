"""medical_records: rename prescription → treatment_advice, add follow_up_advice

The clinical-notes form now collects Diagnosis / Treatment advice / Follow-up
advice. `prescription` was a misnomer on this table — real drug orders live in
the Prescription table — so it is renamed to `treatment_advice` (its data
carries over), and `follow_up_advice` is added alongside.

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-09-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("medical_records", "prescription", new_column_name="treatment_advice")
    op.add_column(
        "medical_records",
        sa.Column("follow_up_advice", sa.Text(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("medical_records", "follow_up_advice")
    op.alter_column("medical_records", "treatment_advice", new_column_name="prescription")
