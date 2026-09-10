"""vitals: BMI + obstetric triad (LMP / EDD / POG)

Adds four columns to `vitals`:

* ``bmi`` — body mass index, auto-filled by the form from height + weight but
  editable by the recorder.
* ``lmp`` — last menstrual period (ISO date).
* ``edd`` — expected date of delivery (ISO date).
* ``pog`` — period of gestation, a short free string such as ``"28w 3d"``,
  auto-filled from LMP and editable.

Backfilled with defaults rather than left NULL so ``VitalsOut`` can keep the
same non-optional shape as its sibling fields, and so rows written by anything
bypassing the ORM still satisfy NOT NULL.

Respiratory rate and notes are untouched: the new form no longer collects
either, but the columns stay so historical rows keep their data.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "vitals",
        sa.Column("bmi", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column(
        "vitals",
        sa.Column("lmp", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "vitals",
        sa.Column("edd", sa.String(), nullable=False, server_default=""),
    )
    op.add_column(
        "vitals",
        sa.Column("pog", sa.String(), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("vitals", "pog")
    op.drop_column("vitals", "edd")
    op.drop_column("vitals", "lmp")
    op.drop_column("vitals", "bmi")
