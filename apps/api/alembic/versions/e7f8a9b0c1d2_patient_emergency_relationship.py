"""patients: emergency contact relationship

Adds ``emergency_relationship`` to ``patients`` — how the emergency contact is
related to the patient (e.g. "Spouse", "Parent"). Sits alongside the existing
``emergency_contact`` (name) and ``emergency_phone`` columns.

Backfilled with an empty-string default rather than left NULL so ``PatientOut``
can keep the same non-optional shape as its sibling emergency-contact fields,
and so rows written by anything bypassing the ORM still satisfy NOT NULL.

Revision ID: e7f8a9b0c1d2
Revises: f6a7b8c9d0e1
Create Date: 2026-09-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "patients",
        sa.Column(
            "emergency_relationship",
            sa.String(),
            nullable=False,
            server_default="",
        ),
    )


def downgrade() -> None:
    op.drop_column("patients", "emergency_relationship")
