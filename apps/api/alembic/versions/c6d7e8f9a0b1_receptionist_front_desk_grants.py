"""receptionist front-desk grants

Widens the receptionist beyond patient registration to the rest of the front
desk: seeing the day's appointments and booking them, the doctor directory for
routing a walk-in, and billing to answer "what does this patient owe".

Read-only where it should be. `appointments.manage` is deliberately absent, so a
receptionist books but does not reschedule, cancel or complete; `doctors.manage`
and `payments.manage` are absent for the same reason.

This **replaces** the role's whole grant list rather than adding to it. A front
desk account is the lowest-trust staff login in a hospital, and this role was
found holding every permission in the catalog — including `platform.read`, which
reads across every tenant, and `roles.manage`, which lets the holder grant
itself anything else. Deleting first is what makes the set below the whole truth
about what a receptionist can do, on every environment this runs on.

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-09-07 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ROLE = 'receptionist'

# (permission_code, scope) — the complete set, not a delta.
GRANTS = [
    ('profile.manage', None),
    ('patients.read', 'all'),
    ('patients.manage', None),
    ('appointments.read', 'all'),
    ('appointments.create', 'all'),
    ('doctors.read', 'all'),
    ('payments.read', 'all'),
    # Enabling reads for the screens above, found by driving them: the
    # appointments board and the doctors list both filter by department, and the
    # board reads schedule blocks to show when a doctor is unavailable. Without
    # these the screens render but their filters come back empty.
    ('departments.read', 'all'),
    ('schedule.read', 'all'),
]

# What b5c6d7e8f9a0 left behind, restored on downgrade.
ORIGINAL_GRANTS = [
    ('profile.manage', None),
    ('patients.read', 'all'),
    ('patients.manage', None),
]


def _role_permissions() -> sa.TableClause:
    return sa.table(
        'role_permissions',
        sa.column('role_code', sa.String),
        sa.column('permission_code', sa.String),
        sa.column('scope', sa.String),
    )


def _replace_grants(grants: list[tuple[str, str | None]]) -> None:
    role_permissions = _role_permissions()
    op.execute(role_permissions.delete().where(role_permissions.c.role_code == ROLE))
    op.bulk_insert(role_permissions, [
        {'role_code': ROLE, 'permission_code': code, 'scope': scope}
        for code, scope in grants
    ])


def upgrade() -> None:
    _replace_grants(GRANTS)


def downgrade() -> None:
    _replace_grants(ORIGINAL_GRANTS)
