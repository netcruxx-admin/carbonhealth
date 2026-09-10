"""injections flow — catalogue, stock ledger, and orders

The injection-side mirror of the medicine subsystem (medicines + inventory +
medication_orders), one step shorter: a single-dose injectable is consumed when
it is administered, so there is no pharmacist "dispense" between the doctor's
order and the nurse's shot.

Adds:
  * injectables               — catalogue + stock, the Medicine counterpart
  * injection_stock_movements — append-only ledger, the InventoryMovement counterpart
  * injection_orders          — doctor orders / nurse administers, the MedicationOrder counterpart
  * injectables.{read,manage,delete}
    injection_orders.{read,manage,administer,delete}
  * grants for doctor, nurse, admin, pharmacist and superadmin

Revision ID: b4c5d6e7f8a9
Revises: e7f8a9b0c1d2
Create Date: 2026-09-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'e7f8a9b0c1d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# code, label, description, resource, action, module, supports_scope, sort_order
NEW_PERMISSIONS = [
    ('injectables.read', 'View injectables',
     'See the injectable catalogue and stock levels.',
     'injectables', 'read', 'pharmacy', False, 361),
    ('injectables.manage', 'Manage injectables',
     'Maintain the injectable catalogue and move its stock.',
     'injectables', 'manage', 'pharmacy', False, 362),
    ('injectables.delete', 'Delete injectables',
     'Permanently remove catalogue injectables.',
     'injectables', 'delete', 'pharmacy', False, 363),
    ('injection_orders.read', 'View injection orders',
     'See injections ordered for patients.',
     'injection_orders', 'read', 'pharmacy', True, 364),
    ('injection_orders.manage', 'Manage injection orders',
     'Order and cancel injections.',
     'injection_orders', 'manage', 'pharmacy', False, 365),
    ('injection_orders.administer', 'Administer injections',
     'Record an injection as given.',
     'injection_orders', 'administer', 'pharmacy', False, 366),
    ('injection_orders.delete', 'Delete injection orders',
     'Permanently remove injection orders.',
     'injection_orders', 'delete', 'pharmacy', False, 367),
]

# (role_code, permission_code, scope)
NEW_GRANTS = [
    # doctor — orders shots, sees their own
    ('doctor', 'injectables.read', None),
    ('doctor', 'injection_orders.read', 'own'),
    ('doctor', 'injection_orders.manage', None),
    # nurse — works the queue, gives the shots
    ('nurse', 'injectables.read', None),
    ('nurse', 'injection_orders.read', 'all'),
    ('nurse', 'injection_orders.administer', None),
    # admin — catalogue + visibility, like medicines
    ('admin', 'injectables.read', None),
    ('admin', 'injectables.manage', None),
    ('admin', 'injection_orders.read', 'all'),
    # pharmacist — owns the catalogue and stock
    ('pharmacist', 'injectables.read', 'all'),
    ('pharmacist', 'injectables.manage', None),
    ('pharmacist', 'injection_orders.read', 'all'),
    ('pharmacist', 'injection_orders.manage', None),
    # superadmin — everything, unscoped
    ('superadmin', 'injectables.read', 'all'),
    ('superadmin', 'injectables.manage', None),
    ('superadmin', 'injectables.delete', None),
    ('superadmin', 'injection_orders.read', 'all'),
    ('superadmin', 'injection_orders.manage', None),
    ('superadmin', 'injection_orders.administer', None),
    ('superadmin', 'injection_orders.delete', None),
]


def upgrade() -> None:
    # ── injectables ──────────────────────────────────────────────────────────
    op.create_table(
        'injectables',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hospital_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('category', sa.String(), server_default='', nullable=True),
        sa.Column('form', sa.String(), server_default='', nullable=True),
        sa.Column('strength', sa.String(), server_default='', nullable=True),
        sa.Column('route', sa.String(), server_default='IM', nullable=True),
        sa.Column('price', sa.Float(), server_default='0', nullable=True),
        sa.Column('stock', sa.Integer(), server_default='0', nullable=True),
        sa.Column('reorder_level', sa.Integer(), server_default='10', nullable=True),
        sa.Column('lot_number', sa.String(), server_default='', nullable=True),
        sa.Column('expiry_date', sa.String(), server_default='', nullable=True),
        sa.Column('location', sa.String(), server_default='', nullable=True),
        sa.Column('unit', sa.String(), server_default='', nullable=True),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_injectables_hospital_id'), 'injectables', ['hospital_id'])

    # ── injection_stock_movements ────────────────────────────────────────────
    op.create_table(
        'injection_stock_movements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hospital_id', sa.String(), nullable=False),
        sa.Column('injectable_id', sa.String(), nullable=False),
        sa.Column('movement_type', sa.String(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('lot_number', sa.String(), server_default='', nullable=True),
        sa.Column('expiry_date', sa.String(), server_default='', nullable=True),
        sa.Column('reference_id', sa.String(), server_default='', nullable=True),
        sa.Column('performed_by', sa.String(), nullable=False),
        sa.Column('notes', sa.Text(), server_default='', nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_injection_stock_movements_hospital_id'), 'injection_stock_movements', ['hospital_id'])
    op.create_index(op.f('ix_injection_stock_movements_injectable_id'), 'injection_stock_movements', ['injectable_id'])

    # ── injection_orders ─────────────────────────────────────────────────────
    op.create_table(
        'injection_orders',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('hospital_id', sa.String(), nullable=False),
        sa.Column('appointment_id', sa.String(), nullable=True),
        sa.Column('patient_id', sa.String(), nullable=False),
        sa.Column('doctor_id', sa.String(), nullable=False),
        sa.Column('prescription_id', sa.String(), nullable=True),
        sa.Column('injectable_id', sa.String(), nullable=True),
        sa.Column('injectable_name', sa.String(), server_default='', nullable=True),
        sa.Column('dose', sa.String(), server_default='', nullable=True),
        sa.Column('route', sa.String(), server_default='IM', nullable=True),
        sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
        sa.Column('scheduled_for', sa.String(), server_default='', nullable=True),
        sa.Column('instructions', sa.Text(), server_default='', nullable=True),
        sa.Column('status', sa.String(), server_default='ordered', nullable=True),
        sa.Column('site', sa.String(), server_default='', nullable=True),
        sa.Column('notes', sa.Text(), server_default='', nullable=True),
        sa.Column('administered_by', sa.String(), nullable=True),
        sa.Column('administered_at', sa.String(), nullable=True),
        sa.Column('ordered_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_injection_orders_hospital_id'), 'injection_orders', ['hospital_id'])
    op.create_index(op.f('ix_injection_orders_patient_id'), 'injection_orders', ['patient_id'])
    op.create_index(op.f('ix_injection_orders_appointment_id'), 'injection_orders', ['appointment_id'])
    op.create_index(op.f('ix_injection_orders_prescription_id'), 'injection_orders', ['prescription_id'])

    # ── permissions + grants ────────────────────────────────────────────────
    conn = op.get_bind()
    for code, label, description, resource, action, module, supports_scope, sort_order in NEW_PERMISSIONS:
        conn.execute(
            sa.text(
                "INSERT INTO permissions "
                "(code, label, description, resource, action, module, supports_scope, sort_order) "
                "VALUES (:code, :label, :description, :resource, :action, :module, :scope, :sort) "
                "ON CONFLICT DO NOTHING"
            ),
            {
                "code": code, "label": label, "description": description,
                "resource": resource, "action": action, "module": module,
                "scope": supports_scope, "sort": sort_order,
            },
        )
    for role_code, permission_code, scope in NEW_GRANTS:
        conn.execute(
            sa.text(
                "INSERT INTO role_permissions (role_code, permission_code, scope) "
                "VALUES (:role, :perm, :scope) ON CONFLICT DO NOTHING"
            ),
            {"role": role_code, "perm": permission_code, "scope": scope},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for role_code, permission_code, _scope in NEW_GRANTS:
        conn.execute(
            sa.text(
                "DELETE FROM role_permissions WHERE role_code = :role AND permission_code = :perm"
            ),
            {"role": role_code, "perm": permission_code},
        )
    for row in NEW_PERMISSIONS:
        conn.execute(sa.text("DELETE FROM role_permissions WHERE permission_code = :c"), {"c": row[0]})
        conn.execute(sa.text("DELETE FROM permissions WHERE code = :c"), {"c": row[0]})

    op.drop_index(op.f('ix_injection_orders_prescription_id'), table_name='injection_orders')
    op.drop_index(op.f('ix_injection_orders_appointment_id'), table_name='injection_orders')
    op.drop_index(op.f('ix_injection_orders_patient_id'), table_name='injection_orders')
    op.drop_index(op.f('ix_injection_orders_hospital_id'), table_name='injection_orders')
    op.drop_table('injection_orders')

    op.drop_index(op.f('ix_injection_stock_movements_injectable_id'), table_name='injection_stock_movements')
    op.drop_index(op.f('ix_injection_stock_movements_hospital_id'), table_name='injection_stock_movements')
    op.drop_table('injection_stock_movements')

    op.drop_index(op.f('ix_injectables_hospital_id'), table_name='injectables')
    op.drop_table('injectables')
