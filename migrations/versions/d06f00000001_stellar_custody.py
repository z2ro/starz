"""Orbital stellar custody, material provenance and physical module location."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd06f00000001'
down_revision = 'd05e00000001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('stellar_unit', sa.Column('custodian_empire_id', sa.Uuid(), nullable=True))
    op.add_column('stellar_unit', sa.Column('custody_version', sa.Integer(), server_default='0', nullable=False))
    op.create_unique_constraint('stellar_unit_identity_universe', 'stellar_unit', ['id', 'source_id', 'universe_id'])
    op.create_foreign_key('stellar_unit_custodian_universe', 'stellar_unit', 'empire', ['custodian_empire_id', 'universe_id'], ['id', 'universe_id'])
    op.create_check_constraint('stellar_custody_version', 'stellar_unit', 'custody_version >= 0')
    op.create_table('stellar_operation',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('universe_id', sa.Uuid(), nullable=False),
    sa.Column('source_id', sa.Uuid(), nullable=False),
    sa.Column('unit_id', sa.Uuid(), nullable=False),
    sa.Column('actor_id', sa.Uuid(), nullable=False),
    sa.Column('recipient_id', sa.Uuid(), nullable=True),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('system_id', sa.Uuid(), nullable=False),
    sa.Column('planet_id', sa.Uuid(), nullable=True),
    sa.Column('custody_version', sa.Integer(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("kind IN ('claim', 'conquer', 'offer', 'rebuild', 'repatriate', 'withdraw', 'decommission')", name='stellar_operation_kind'),
    sa.CheckConstraint("status IN ('pending', 'offered', 'working', 'transit', 'returning', 'completed', 'cancelled', 'contested', 'failed')", name='stellar_operation_status'),
    sa.ForeignKeyConstraint(['actor_id', 'universe_id'], ['empire.id', 'empire.universe_id'], ),
    sa.ForeignKeyConstraint(['planet_id', 'system_id'], ['planet_state.id', 'planet_state.system_id'], ),
    sa.ForeignKeyConstraint(['recipient_id', 'universe_id'], ['empire.id', 'empire.universe_id'], ),
    sa.ForeignKeyConstraint(['system_id', 'universe_id'], ['star_system.id', 'star_system.universe_id'], ),
    sa.ForeignKeyConstraint(['unit_id', 'source_id', 'universe_id'], ['stellar_unit.id', 'stellar_unit.source_id', 'stellar_unit.universe_id'], ),
    sa.ForeignKeyConstraint(['universe_id'], ['universe.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id', 'unit_id', 'universe_id'),
    sa.UniqueConstraint('id', 'universe_id', 'actor_id')
    )
    op.create_index('stellar_operation_active_unit', 'stellar_operation', ['unit_id'], unique=True, postgresql_where=sa.text("status IN ('pending', 'offered', 'working', 'transit', 'returning')"))
    op.create_table('stellar_ledger',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('universe_id', sa.Uuid(), nullable=False),
    sa.Column('source_id', sa.Uuid(), nullable=False),
    sa.Column('unit_id', sa.Uuid(), nullable=False),
    sa.Column('operation_id', sa.Uuid(), nullable=False),
    sa.Column('actor_id', sa.Uuid(), nullable=False),
    sa.Column('event_key', sa.String(), nullable=False),
    sa.Column('effect', sa.String(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['actor_id', 'universe_id'], ['empire.id', 'empire.universe_id'], ),
    sa.ForeignKeyConstraint(['operation_id', 'unit_id', 'universe_id'], ['stellar_operation.id', 'stellar_operation.unit_id', 'stellar_operation.universe_id'], ),
    sa.ForeignKeyConstraint(['unit_id', 'source_id', 'universe_id'], ['stellar_unit.id', 'stellar_unit.source_id', 'stellar_unit.universe_id'], ),
    sa.ForeignKeyConstraint(['universe_id'], ['universe.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('unit_id', 'event_key')
    )
    op.add_column('stellar_module', sa.Column('current_planet_id', sa.Uuid(), nullable=True))
    op.add_column('stellar_module', sa.Column('operation_id', sa.Uuid(), nullable=True))
    op.create_unique_constraint('stellar_module_identity_universe', 'stellar_module', ['id', 'universe_id'])
    op.create_foreign_key('stellar_module_current_planet_owner', 'stellar_module', 'planet_state', ['current_planet_id', 'empire_id'], ['id', 'empire_id'])
    op.create_foreign_key('stellar_module_custody_operation', 'stellar_module', 'stellar_operation', ['operation_id', 'universe_id', 'empire_id'], ['id', 'universe_id', 'actor_id'])

    op.drop_constraint('stellar_module_project', 'stellar_module', type_='check')
    op.create_check_constraint('stellar_module_project', 'stellar_module',
        "status NOT IN ('delivered', 'committed', 'consumed') OR project_id IS NOT NULL OR operation_id IS NOT NULL")
    op.drop_constraint('stellar_unit_state', 'stellar_unit', type_='check')
    op.create_check_constraint('stellar_unit_state', 'stellar_unit',
        "state IN ('operational', 'damaged', 'incapacitated', 'sealed_wreck', 'rebuilding', 'repatriating', 'core_transit', 'sealed_relic', 'reinstalled', 'transit')")
    op.execute("UPDATE stellar_module SET current_planet_id = origin_planet_id WHERE status IN ('manufacturing', 'ready')")


def downgrade():
    # Refuse loss of any new runtime state or committed transport.
    if op.get_bind().scalar(sa.text("""
        SELECT EXISTS (SELECT 1 FROM stellar_source)
            OR EXISTS (SELECT 1 FROM stellar_project)
            OR EXISTS (SELECT 1 FROM stellar_module)
            OR EXISTS (SELECT 1 FROM stellar_unit)
            OR EXISTS (SELECT 1 FROM stellar_operation)
            OR EXISTS (SELECT 1 FROM stellar_ledger)
            OR EXISTS (SELECT 1 FROM universe_order WHERE NOT resolved AND
                (kind IN ('stellar_custody', 'stellar_module', 'stellar_phase') OR
                 (kind = 'mission' AND payload->>'mission' IN
                    ('CORE_PICKUP', 'CORE_TRANSPORT', 'CORE_RETURN', 'CORE_REPATRIATION', 'STELLAR_DELIVERY'))))
    """)):
        raise RuntimeError('Stellar state exists; rollback must preserve operations and ledger.')
    op.drop_constraint('stellar_module_custody_operation', 'stellar_module', type_='foreignkey')
    op.drop_constraint('stellar_module_current_planet_owner', 'stellar_module', type_='foreignkey')
    op.drop_constraint('stellar_module_identity_universe', 'stellar_module', type_='unique')
    op.drop_constraint('stellar_module_project', 'stellar_module', type_='check')
    op.create_check_constraint('stellar_module_project', 'stellar_module',
        "status NOT IN ('transit', 'delivered', 'committed', 'consumed') OR project_id IS NOT NULL")
    op.drop_column('stellar_module', 'operation_id')
    op.drop_column('stellar_module', 'current_planet_id')
    op.drop_table('stellar_ledger')
    op.drop_index('stellar_operation_active_unit', table_name='stellar_operation')
    op.drop_table('stellar_operation')
    op.drop_constraint('stellar_unit_custodian_universe', 'stellar_unit', type_='foreignkey')
    op.drop_constraint('stellar_custody_version', 'stellar_unit', type_='check')
    op.drop_constraint('stellar_unit_identity_universe', 'stellar_unit', type_='unique')
    op.drop_column('stellar_unit', 'custody_version')
    op.drop_column('stellar_unit', 'custodian_empire_id')
    op.drop_constraint('stellar_unit_state', 'stellar_unit', type_='check')
    op.create_check_constraint('stellar_unit_state', 'stellar_unit',
        "state IN ('operational', 'damaged', 'incapacitated', 'sealed_wreck', 'rebuilding', 'repatriating', 'sealed_relic', 'reinstalled', 'transit')")
