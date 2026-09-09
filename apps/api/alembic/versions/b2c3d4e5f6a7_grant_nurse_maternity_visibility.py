"""let nurses read pregnancies and newborns

A nurse coordinating antenatal or newborn care needs to see the pregnancy
tracker and the immunisation schedule the same way they already see
prescriptions and medical records — read-only, in the same spirit as
c60b8a3f27e5 and b8a41c92de07. `pregnancies.manage` / `babies.manage` stay
with doctors: recording an antenatal visit or registering a newborn is a
clinical decision, not a coordination task.

Both permissions are module-gated on `anc` already (see
c7e93b2a1d84_add_permissions_and_role_grants.py), so this grant is inert at
hospitals that never enabled the maternity module.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-09 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


GRANTS = [
    ("nurse", "pregnancies.read", "all"),
    ("nurse", "babies.read", "all"),
]


def upgrade() -> None:
    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_code', sa.String), sa.column('permission_code', sa.String),
        sa.column('scope', sa.String),
    )
    op.bulk_insert(role_permissions, [
        {"role_code": role, "permission_code": code, "scope": scope}
        for role, code, scope in GRANTS
    ])


def downgrade() -> None:
    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_code', sa.String), sa.column('permission_code', sa.String),
    )
    for role, code, _scope in GRANTS:
        op.execute(
            role_permissions.delete().where(
                sa.and_(
                    role_permissions.c.role_code == role,
                    role_permissions.c.permission_code == code,
                )
            )
        )
