"""patients: W/O · D/O · B/O identity line

Adds two columns to ``patients``:

* ``relation_type`` — one of "wife_of" | "daughter_of" | "baby_of" (or "" when
  not given). Rendered on records as W/O · D/O · B/O.
* ``relation_name`` — the relative's name.

Backfilled with empty-string defaults + NOT NULL so ``PatientOut`` keeps its
non-optional shape and rows written outside the ORM still satisfy the constraint.

Revision ID: c7d8e9f0a1b2
Revises: b4c5d6e7f8a9
Create Date: 2026-09-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("patients", sa.Column("relation_type", sa.String(), nullable=False, server_default=""))
    op.add_column("patients", sa.Column("relation_name", sa.String(), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("patients", "relation_name")
    op.drop_column("patients", "relation_type")
