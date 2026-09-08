"""Patient identity and address.

A patient record held a phone number and a date of birth and nothing that says
*who* or *where*. Three screens collect a patient — public sign-up, the front
desk's Add Patient, and the edit modal — and each collected a different subset,
so the same person arrived with different amounts of themselves depending on
which door they came through.

Aadhaar is optional and validated rather than merely stored (see
app/identity.py). Its operational purpose is matching a person to the record
they already have, which is also why it is unique per tenant: registering the
same person twice at one hospital is the failure the number exists to prevent.
The index is partial, because "not given" is the common case and must stay
repeatable.

Address columns are named exactly as `hospital_profiles` names them, so the one
address form — Google Places autocomplete included — serves both.

Revision ID: a1b2c3d4e5f6
Revises: f9a0b1c2d3e4
Create Date: 2026-09-08 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (column, default) — every one is a plain string, blank when not collected.
NEW_COLUMNS = [
    ("aadhaar_number", ""),
    ("address_line1", ""),
    ("address_line2", ""),
    ("city", ""),
    ("district", ""),
    ("state", ""),
    ("pincode", ""),
    ("country", "India"),
]


def upgrade() -> None:
    for name, default in NEW_COLUMNS:
        op.add_column(
            "patients",
            sa.Column(name, sa.String(), nullable=False, server_default=default),
        )

    op.create_index(
        "uq_patients_tenant_aadhaar",
        "patients",
        ["hospital_id", "aadhaar_number"],
        unique=True,
        postgresql_where=sa.text("aadhaar_number <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_patients_tenant_aadhaar", table_name="patients")
    for name, _default in reversed(NEW_COLUMNS):
        op.drop_column("patients", name)
