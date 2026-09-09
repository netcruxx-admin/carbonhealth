"""patient self-booking window per hospital

Adds patient_booking_window_start / patient_booking_window_end to
hospital_profiles so a hospital admin can limit the hours in which a patient
may book their own appointment online. Receptionist and admin bookings
(scope "all") and a doctor's own follow-up bookings are never restricted by
this — only a patient booking for themselves (scope "own") is checked, in
POST /appointments.

Unlike the lunch break columns this is deliberately left unset (NULL) with no
backfill: this is a new restriction on an existing flow, and an unset window
must mean "no restriction" so hospitals that never configure it see no change
in behavior.

No new permission: editing flows through the existing hospital.profile.manage
permission via PATCH /hospitals/me/settings, same as every other field on
this form.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "hospital_profiles",
        sa.Column("patient_booking_window_start", sa.String(), nullable=True),
    )
    op.add_column(
        "hospital_profiles",
        sa.Column("patient_booking_window_end", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("hospital_profiles", "patient_booking_window_end")
    op.drop_column("hospital_profiles", "patient_booking_window_start")
