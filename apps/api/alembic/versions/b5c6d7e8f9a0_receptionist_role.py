"""receptionist role

Adds the receptionist role, scoped to front-desk patient registration. Reuses
existing permissions rather than adding new ones: receptionist needs to see
and create patient records, and manage its own profile (password change on
first login), the same baseline every other staff role gets.

Revision ID: b5c6d7e8f9a0
Revises: z1a2b3c4d5e6
Create Date: 2026-09-07 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'z1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# New role
# ---------------------------------------------------------------------------
NEW_ROLE = {
    'code': 'receptionist',
    'label': 'Receptionist',
    'description': 'Registers patients at the front desk.',
    'is_platform': False,
    'sort_order': 65,
    'home_path': '/dashboard',
}

# ---------------------------------------------------------------------------
# Grants — all existing permissions, no new catalog rows needed
# (role_code, permission_code, scope)
# ---------------------------------------------------------------------------
NEW_GRANTS = [
    ('receptionist', 'profile.manage', None),
    ('receptionist', 'patients.read', 'all'),
    ('receptionist', 'patients.manage', None),
]


def upgrade() -> None:
    roles = sa.table(
        'roles',
        sa.column('code', sa.String),
        sa.column('label', sa.String),
        sa.column('description', sa.String),
        sa.column('is_platform', sa.Boolean),
        sa.column('sort_order', sa.Integer),
        sa.column('home_path', sa.String),
    )
    op.bulk_insert(roles, [NEW_ROLE])

    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_code', sa.String),
        sa.column('permission_code', sa.String),
        sa.column('scope', sa.String),
    )
    op.bulk_insert(role_permissions, [
        {'role_code': role, 'permission_code': code, 'scope': scope}
        for role, code, scope in NEW_GRANTS
    ])


def downgrade() -> None:
    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_code', sa.String),
        sa.column('permission_code', sa.String),
    )
    for role, code, _scope in NEW_GRANTS:
        op.execute(
            role_permissions.delete().where(
                sa.and_(
                    role_permissions.c.role_code == role,
                    role_permissions.c.permission_code == code,
                )
            )
        )

    roles = sa.table('roles', sa.column('code', sa.String))
    op.execute(roles.delete().where(roles.c.code == 'receptionist'))
