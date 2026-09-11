"""Email is no longer required to have an account.

Login already works by phone (see f2a3b4c5d6e7's revert / the /auth login
identifier split), so no form should keep forcing an email that isn't
actually needed to sign in. Every account still needs *some* way in — the API
now refuses to create or save one with both email and phone blank — but
"some way in" no longer means "email specifically".

The two existing unique indexes on email assumed email was always given (it
was, until now), so they were not partial on it the way `uq_patients_tenant_aadhaar`
and phone are. Multiple accounts with a blank email must be able to coexist,
so they are rebuilt here with the same `<> ''` exclusion.

Revision ID: a3b4c5d6e7f8
Revises: e1f2a3b4c5d6
Create Date: 2026-09-12 09:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("uq_users_tenant_email", table_name="users")
    op.drop_index("uq_users_platform_email", table_name="users")
    op.create_index(
        "uq_users_tenant_email",
        "users",
        ["hospital_id", "email"],
        unique=True,
        postgresql_where=sa.text("hospital_id IS NOT NULL AND email <> ''"),
    )
    op.create_index(
        "uq_users_platform_email",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("hospital_id IS NULL AND email <> ''"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_tenant_email", table_name="users")
    op.drop_index("uq_users_platform_email", table_name="users")
    op.create_index(
        "uq_users_tenant_email",
        "users",
        ["hospital_id", "email"],
        unique=True,
        postgresql_where=sa.text("hospital_id IS NOT NULL"),
    )
    op.create_index(
        "uq_users_platform_email",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("hospital_id IS NULL"),
    )
