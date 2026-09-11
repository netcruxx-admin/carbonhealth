"""medical_records: drop duplicate LMP, add POG-by-scan and exam findings

LMP now lives only on Vitals (it already derives EDD/POG from it there) — a
second copy on medical_records let the two disagree, so it is dropped rather
than kept in sync by hand.

`pog_by_scan` is a deliberately separate field, not a replacement: ultrasound
dating and LMP dating often disagree, and the gap between them is itself a
finding a doctor records, not a bug to reconcile.

`per_abdomen` / `per_speculum` / `per_vaginum` are examination findings taken
at every antenatal visit, not just the first, so they are plain columns
alongside the existing new-visit-only history fields rather than gated with
them.

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-09-12 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8e496818cecd'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("medical_records", "lmp")
    op.add_column("medical_records", sa.Column("pog_by_scan", sa.String(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("per_abdomen", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("per_speculum", sa.Text(), nullable=False, server_default=""))
    op.add_column("medical_records", sa.Column("per_vaginum", sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("medical_records", "per_vaginum")
    op.drop_column("medical_records", "per_speculum")
    op.drop_column("medical_records", "per_abdomen")
    op.drop_column("medical_records", "pog_by_scan")
    op.add_column("medical_records", sa.Column("lmp", sa.String(), nullable=False, server_default=""))
