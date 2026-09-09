"""letterhead safe-area margins per hospital

Adds letterhead_margin_{top,bottom,left,right}_mm to hospital_profiles.

A hospital's letterhead is full-page artwork — a header band, a footer block
with the address and GST number, often a centred watermark. Where the usable
space begins and ends is different for every design and cannot be read off the
image, so the hospital declares it: four millimetre margins from the edges of
an A4 page, set with the visual picker when they upload the artwork. The print
sheet (see app/printing.py and the /print routes) pads its content to that box
so nothing it draws lands on top of the letterhead.

Backfilled with defaults (48/32/18/18) rather than left NULL: a hospital that
already uploaded a letterhead under the old "banner across the top" model
should get a sane box immediately, not a broken one, and can refine it from the
settings screen. server_default carries the same values onto rows inserted by
anything that bypasses the ORM.

No new permission: the picker saves through PATCH /hospitals/me/settings behind
the existing hospital.profile.manage, like every other field on that form.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_COLUMNS = {
    "letterhead_margin_top_mm": "48",
    "letterhead_margin_bottom_mm": "32",
    "letterhead_margin_left_mm": "18",
    "letterhead_margin_right_mm": "18",
}


def upgrade() -> None:
    for name, default in _COLUMNS.items():
        op.add_column(
            "hospital_profiles",
            sa.Column(
                name, sa.Integer(), nullable=False, server_default=default
            ),
        )


def downgrade() -> None:
    for name in reversed(list(_COLUMNS)):
        op.drop_column("hospital_profiles", name)
