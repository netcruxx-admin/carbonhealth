"""grant lab_orders.read + lab_reports.read (all) to admin

A hospital admin could open a patient's detail screen but its Lab Tests section
came up empty, and the sign-off flow was unreachable: listing test orders needs
`lab_orders.read` and listing results needs `lab_reports.read`, neither of which
the admin held.

This was an oversight, not a policy. The admin already reads every other
clinical collection hospital-wide — patients, appointments, vitals, payments —
and `a91d0e57cb43` gave them `lab_orders.review` at scope **all**, which is
meaningless without being able to read the order first. Scope `all` here for the
same reason: an admin's remit is the whole hospital, not their own caseload.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-09 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_GRANTS = [
    {"role_code": "admin", "permission_code": "lab_orders.read", "scope": "all"},
    {"role_code": "admin", "permission_code": "lab_reports.read", "scope": "all"},
]


def upgrade() -> None:
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_code", sa.String),
        sa.column("permission_code", sa.String),
        sa.column("scope", sa.String),
    )
    op.bulk_insert(role_permissions, _GRANTS)


def downgrade() -> None:
    role_permissions = sa.table(
        "role_permissions",
        sa.column("role_code", sa.String),
        sa.column("permission_code", sa.String),
    )
    op.execute(
        role_permissions.delete().where(
            sa.and_(
                role_permissions.c.role_code == "admin",
                role_permissions.c.permission_code.in_(
                    ["lab_orders.read", "lab_reports.read"]
                ),
            )
        )
    )
