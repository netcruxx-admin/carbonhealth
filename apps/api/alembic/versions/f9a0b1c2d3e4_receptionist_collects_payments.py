"""the front desk collects, not just bills

`payments.create` let the receptionist raise a pending bill at booking but not
settle it, so the cash they take at the counter could never be marked collected
— the day-report showed everything as outstanding forever.

Granting `payments.manage` closes that loop. It is broader than "mark paid": it
also covers editing an amount and voiding a bill. That is the standard front
desk — the person who takes the money reconciles it — but it is worth knowing
that this role can now change what a bill says, not only whether it is settled.
If that needs narrowing later, the split to make is `payments.collect` (settle
an existing bill) against `payments.manage` (change or void one), in the shape
of `payments.create` vs `payments.manage`.

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-09-08 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.get_bind().execute(sa.text(
        """
        INSERT INTO role_permissions (role_code, permission_code, scope)
        SELECT 'receptionist', 'payments.manage', NULL
         WHERE EXISTS (SELECT 1 FROM roles WHERE code = 'receptionist')
        ON CONFLICT DO NOTHING
        """
    ))


def downgrade() -> None:
    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_code', sa.String),
        sa.column('permission_code', sa.String),
    )
    op.execute(role_permissions.delete().where(
        sa.and_(
            role_permissions.c.role_code == 'receptionist',
            role_permissions.c.permission_code == 'payments.manage',
        )
    ))
