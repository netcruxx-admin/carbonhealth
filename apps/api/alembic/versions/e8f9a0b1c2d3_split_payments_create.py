"""split raising a bill from altering one

`payments.manage` covered both "record that this patient owes ₹300" and "change
what an existing bill says". Those are different powers, and the front desk only
needs the first: booking a cash consultation writes a pending payment, which a
receptionist could not do without also being able to edit and void bills.

So `payments.create` becomes its own permission, the same way `appointments.create`
is separate from `appointments.manage` and `lab_orders.create` from
`lab_orders.process`. Everyone who held `payments.manage` also gets
`payments.create`, so no existing role loses anything.

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-09-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSION = (
    'payments.create', 'Raise a bill',
    'Record that a patient owes for a service.',
    'payments', 'create', 'payments', False, 635,
)


def upgrade() -> None:
    conn = op.get_bind()

    permissions = sa.table(
        'permissions',
        sa.column('code', sa.String),
        sa.column('label', sa.String),
        sa.column('description', sa.String),
        sa.column('resource', sa.String),
        sa.column('action', sa.String),
        sa.column('module', sa.String),
        sa.column('supports_scope', sa.Boolean),
        sa.column('sort_order', sa.Integer),
    )
    code, label, description, resource, action, module, supports_scope, sort_order = NEW_PERMISSION
    op.bulk_insert(permissions, [{
        'code': code, 'label': label, 'description': description,
        'resource': resource, 'action': action, 'module': module,
        'supports_scope': supports_scope, 'sort_order': sort_order,
    }])

    # Nobody loses a capability in a split: every holder of `payments.manage`
    # could already raise a bill, so they all get the narrower permission too.
    conn.execute(sa.text(
        """
        INSERT INTO role_permissions (role_code, permission_code, scope)
        SELECT role_code, 'payments.create', NULL
          FROM role_permissions
         WHERE permission_code = 'payments.manage'
        ON CONFLICT DO NOTHING
        """
    ))

    # The front desk raises bills without being able to alter them.
    conn.execute(sa.text(
        """
        INSERT INTO role_permissions (role_code, permission_code, scope)
        SELECT 'receptionist', 'payments.create', NULL
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
        role_permissions.c.permission_code == 'payments.create'
    ))
    permissions = sa.table('permissions', sa.column('code', sa.String))
    op.execute(permissions.delete().where(permissions.c.code == 'payments.create'))
