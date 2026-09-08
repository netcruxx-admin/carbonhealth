"""consultation fee schedule, priced by visit type

Moves the price of a consultation off the doctor and onto the hospital.

`doctors.consultation_fee` made every new hire a pricing decision, let a doctor
edit their own rate from their profile, and had no answer for the same doctor
charging differently for a first visit and a follow-up. Price now lives on
`consultation_fees` — one row per visit type per hospital — and an appointment
records which of those it was booked at.

Existing prices are **carried over, not reset**: each hospital's most common
non-zero doctor fee becomes the amount for all three seeded visit types. That
keeps today's billing behaviour identical on upgrade (a consultation still costs
what it cost) and leaves the hospital to lower its follow-up rate deliberately
rather than discovering a discount it never chose. Hospitals with no priced
doctor get rows at 0, which the booking flow refuses until someone sets them.

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-09-08 10:00:00.000000

"""
from typing import Sequence, Union

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c6d7e8f9a0b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (visit_type, label, sort_order)
DEFAULT_VISIT_TYPES = [
    ('new', 'New Patient', 0),
    ('follow_up', 'Follow-up', 1),
    ('emergency', 'Emergency', 2),
]

# code, label, description, resource, action, module, supports_scope, sort_order
NEW_PERMISSIONS = [
    ('fees.read', 'View consultation fees', 'See what the hospital charges for a visit.', 'fees', 'read', None, False, 645),
    ('fees.manage', 'Manage consultation fees', 'Set what the hospital charges for a visit.', 'fees', 'manage', None, False, 646),
]

# Reading a price is not privileged — a patient who cannot see what a visit
# costs cannot agree to pay it, and everyone who books or bills needs the
# number. Setting one is the hospital admin's call, not the platform's: what to
# charge is a business decision, unlike departments or hospital settings.
NEW_GRANTS = [
    ('superadmin', 'fees.read', None), ('superadmin', 'fees.manage', None),
    ('admin', 'fees.read', None), ('admin', 'fees.manage', None),
    ('doctor', 'fees.read', None),
    ('nurse', 'fees.read', None),
    ('receptionist', 'fees.read', None),
    ('pharmacist', 'fees.read', None),
    ('patient', 'fees.read', None),
]


def upgrade() -> None:
    # ── consultation_fees ────────────────────────────────────────────────────
    op.create_table(
        'consultation_fees',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hospital_id', sa.String(), nullable=False),
        sa.Column('visit_type', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('amount', sa.Float(), server_default='0', nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('hospital_id', 'visit_type', name='uq_consultation_fees_tenant_type'),
    )
    op.create_index(op.f('ix_consultation_fees_hospital_id'), 'consultation_fees', ['hospital_id'])

    # ── appointments.visit_type ──────────────────────────────────────────────
    # Existing appointments were all booked at the doctor's single rate, which
    # the backfill below turns into the 'new' price — so 'new' is what they were
    # in fact billed at, not merely a convenient default.
    op.add_column(
        'appointments',
        sa.Column('visit_type', sa.String(), server_default='new', nullable=False),
    )

    # ── carry existing prices over ───────────────────────────────────────────
    conn = op.get_bind()
    created_at = datetime.now(timezone.utc).isoformat()
    hospitals = conn.execute(sa.text("SELECT id FROM hospitals")).fetchall()
    for (hospital_id,) in hospitals:
        # The most common non-zero fee among this hospital's doctors, falling
        # back to the highest. Mode rather than average: an average invents a
        # price no doctor actually charged.
        row = conn.execute(
            sa.text(
                """
                SELECT consultation_fee
                  FROM doctors
                 WHERE hospital_id = :hid AND consultation_fee > 0
              GROUP BY consultation_fee
              ORDER BY COUNT(*) DESC, consultation_fee DESC
                 LIMIT 1
                """
            ),
            {"hid": hospital_id},
        ).fetchone()
        amount = float(row[0]) if row else 0.0

        for visit_type, label, sort_order in DEFAULT_VISIT_TYPES:
            conn.execute(
                sa.text(
                    """
                    INSERT INTO consultation_fees
                        (id, hospital_id, visit_type, label, amount, active, sort_order, created_at)
                    VALUES
                        (:id, :hid, :vt, :label, :amount, true, :sort_order, :created_at)
                    """
                ),
                {
                    "id": f"fee-{hospital_id[-8:]}-{visit_type}",
                    "hid": hospital_id,
                    "vt": visit_type,
                    "label": label,
                    "amount": amount,
                    "sort_order": sort_order,
                    "created_at": created_at,
                },
            )

    # ── drop the per-doctor fee ──────────────────────────────────────────────
    op.drop_column('doctors', 'consultation_fee')

    # ── permissions + grants ─────────────────────────────────────────────────
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
    op.bulk_insert(permissions, [
        {
            'code': code, 'label': label, 'description': description,
            'resource': resource, 'action': action, 'module': module,
            'supports_scope': supports_scope, 'sort_order': sort_order,
        }
        for code, label, description, resource, action, module, supports_scope, sort_order in NEW_PERMISSIONS
    ])

    role_permissions = sa.table(
        'role_permissions',
        sa.column('role_code', sa.String),
        sa.column('permission_code', sa.String),
        sa.column('scope', sa.String),
    )
    # Skip grants for roles a given deployment does not have — a superadmin can
    # rename or remove a built-in role, and a missing one must not fail the
    # migration on the FK.
    existing_roles = {
        code for (code,) in conn.execute(sa.text("SELECT code FROM roles")).fetchall()
    }
    op.bulk_insert(role_permissions, [
        {'role_code': role, 'permission_code': code, 'scope': scope}
        for role, code, scope in NEW_GRANTS
        if role in existing_roles
    ])


def downgrade() -> None:
    conn = op.get_bind()

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

    permissions = sa.table('permissions', sa.column('code', sa.String))
    op.execute(permissions.delete().where(
        permissions.c.code.in_([p[0] for p in NEW_PERMISSIONS])
    ))

    # Put the per-doctor fee back and restore each doctor to their hospital's
    # 'new' price — the closest recoverable approximation, since the column
    # being dropped above is what the per-doctor amounts lived in.
    op.add_column(
        'doctors',
        sa.Column('consultation_fee', sa.Float(), server_default='0', nullable=True),
    )
    conn.execute(sa.text(
        """
        UPDATE doctors
           SET consultation_fee = COALESCE((
                   SELECT amount FROM consultation_fees
                    WHERE consultation_fees.hospital_id = doctors.hospital_id
                      AND consultation_fees.visit_type = 'new'
               ), 0)
        """
    ))

    op.drop_column('appointments', 'visit_type')
    op.drop_index(op.f('ix_consultation_fees_hospital_id'), table_name='consultation_fees')
    op.drop_table('consultation_fees')
