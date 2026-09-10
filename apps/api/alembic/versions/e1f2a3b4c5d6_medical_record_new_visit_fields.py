"""medical_records: new-visit history fields

A first encounter collects history a follow-up doesn't re-ask: chief
complaint, medical/surgical/family history, and (for the maternity category)
LMP, menstrual history, marital status, obstetric history. All optional and
blank on a follow-up note, which only ever fills diagnosis/treatment_advice/
follow_up_advice.

Revision ID: e1f2a3b4c5d6
Revises: d8e9f0a1b2c3
Create Date: 2026-09-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("medical_records", sa.Column("chief_complaint", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("medical_history", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("surgical_history", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("family_history", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("lmp", sa.String(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("menstrual_history", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("marital_status", sa.String(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("obstetric_history", sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("medical_records", "obstetric_history")
    op.drop_column("medical_records", "marital_status")
    op.drop_column("medical_records", "menstrual_history")
    op.drop_column("medical_records", "lmp")
    op.drop_column("medical_records", "family_history")
    op.drop_column("medical_records", "surgical_history")
    op.drop_column("medical_records", "medical_history")
    op.drop_column("medical_records", "chief_complaint")
