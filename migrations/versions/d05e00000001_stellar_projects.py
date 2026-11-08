"""Normalized stellar source, physical modules and five-phase construction.

Experimental numbers remain in the stellar service, outside this schema.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd05e00000001'
down_revision = 'd04d00000001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint('star_system_id_universe_id_key', 'star_system', ['id', 'universe_id'])
    op.create_unique_constraint('empire_id_universe_id_key', 'empire', ['id', 'universe_id'])
    op.create_unique_constraint('planet_state_id_empire_id_key', 'planet_state', ['id', 'empire_id'])
    op.create_unique_constraint('planet_state_id_system_id_key', 'planet_state', ['id', 'system_id'])
    op.create_table('stellar_source',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('universe_id', sa.Uuid(), nullable=False),
    sa.Column('origin_system_id', sa.Uuid(), nullable=False),
    sa.Column('removed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['origin_system_id', 'universe_id'], ['star_system.id', 'star_system.universe_id'], ),
    sa.ForeignKeyConstraint(['universe_id'], ['universe.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id', 'universe_id'),
    sa.UniqueConstraint('origin_system_id')
    )
    op.create_table('stellar_project',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('universe_id', sa.Uuid(), nullable=False),
    sa.Column('source_id', sa.Uuid(), nullable=False),
    sa.Column('empire_id', sa.Uuid(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('completed_phases', sa.Integer(), nullable=False),
    sa.Column('phase_records', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('stocks', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("(status = 'commissioned') = (completed_phases = 5)", name='stellar_project_commissioned'),
    sa.CheckConstraint("status IN ('reserved', 'building', 'commissioned', 'cancelled')", name='stellar_project_status'),
    sa.CheckConstraint('completed_phases BETWEEN 0 AND 5', name='stellar_project_phases'),
    sa.ForeignKeyConstraint(['empire_id', 'universe_id'], ['empire.id', 'empire.universe_id'], ),
    sa.ForeignKeyConstraint(['source_id', 'universe_id'], ['stellar_source.id', 'stellar_source.universe_id'], ),
    sa.ForeignKeyConstraint(['universe_id'], ['universe.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('id', 'universe_id'),
    sa.UniqueConstraint('id', 'universe_id', 'empire_id')
    )
    op.create_index('stellar_project_active_source', 'stellar_project', ['source_id'], unique=True, postgresql_where=sa.text("status <> 'cancelled'"))
    op.create_table('stellar_module',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('universe_id', sa.Uuid(), nullable=False),
    sa.Column('empire_id', sa.Uuid(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('status', sa.String(), nullable=False),
    sa.Column('origin_planet_id', sa.Uuid(), nullable=False),
    sa.Column('project_id', sa.Uuid(), nullable=True),
    sa.Column('fleet_id', sa.Uuid(), nullable=True),
    sa.Column('consumed_phase', sa.Integer(), nullable=True),
    sa.Column('manufacture_order_id', sa.Uuid(), nullable=False),
    sa.Column('phase_order_id', sa.Uuid(), nullable=True),
    sa.Column('delivery_order_id', sa.Uuid(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("(status = 'transit') = (fleet_id IS NOT NULL)", name='stellar_module_fleet'),
    sa.CheckConstraint("kind IN ('containment', 'shielding', 'control', 'propulsion', 'weapons')", name='stellar_module_kind'),
    sa.CheckConstraint("status IN ('manufacturing', 'ready', 'transit', 'delivered', 'committed', 'consumed')", name='stellar_module_status'),
    sa.CheckConstraint("status NOT IN ('transit', 'delivered', 'committed', 'consumed') OR project_id IS NOT NULL", name='stellar_module_project'),
    sa.CheckConstraint('consumed_phase IS NULL OR consumed_phase BETWEEN 1 AND 5', name='stellar_module_phase'),
    sa.ForeignKeyConstraint(['delivery_order_id'], ['universe_order.id'], ),
    sa.ForeignKeyConstraint(['empire_id', 'universe_id'], ['empire.id', 'empire.universe_id'], ),
    sa.ForeignKeyConstraint(['fleet_id', 'empire_id'], ['fleet.id', 'fleet.empire_id'], ),
    sa.ForeignKeyConstraint(['manufacture_order_id'], ['universe_order.id'], ),
    sa.ForeignKeyConstraint(['origin_planet_id', 'empire_id'], ['planet_state.id', 'planet_state.empire_id'], ),
    sa.ForeignKeyConstraint(['phase_order_id'], ['universe_order.id'], ),
    sa.ForeignKeyConstraint(['project_id', 'universe_id', 'empire_id'], ['stellar_project.id', 'stellar_project.universe_id', 'stellar_project.empire_id'], ),
    sa.ForeignKeyConstraint(['universe_id'], ['universe.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('manufacture_order_id'),
    sa.UniqueConstraint('phase_order_id')
    )
    op.create_table('stellar_unit',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('universe_id', sa.Uuid(), nullable=False),
    sa.Column('source_id', sa.Uuid(), nullable=False),
    sa.Column('project_id', sa.Uuid(), nullable=False),
    sa.Column('empire_id', sa.Uuid(), nullable=False),
    sa.Column('system_id', sa.Uuid(), nullable=False),
    sa.Column('planet_id', sa.Uuid(), nullable=True),
    sa.Column('state', sa.String(), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('stocks', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.CheckConstraint("state IN ('operational', 'damaged', 'incapacitated', 'sealed_wreck', 'rebuilding', 'repatriating', 'sealed_relic', 'reinstalled', 'transit')", name='stellar_unit_state'),
    sa.ForeignKeyConstraint(['empire_id', 'universe_id'], ['empire.id', 'empire.universe_id'], ),
    sa.ForeignKeyConstraint(['planet_id', 'system_id'], ['planet_state.id', 'planet_state.system_id'], ),
    sa.ForeignKeyConstraint(['project_id', 'universe_id'], ['stellar_project.id', 'stellar_project.universe_id'], ),
    sa.ForeignKeyConstraint(['source_id', 'universe_id'], ['stellar_source.id', 'stellar_source.universe_id'], ),
    sa.ForeignKeyConstraint(['system_id', 'universe_id'], ['star_system.id', 'star_system.universe_id'], ),
    sa.ForeignKeyConstraint(['universe_id'], ['universe.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('project_id'),
    sa.UniqueConstraint('source_id')
    )


def downgrade():
    # A populated stellar schema cannot be discarded by a rollback.
    if op.get_bind().scalar(sa.text("""
        SELECT EXISTS (SELECT 1 FROM stellar_source)
            OR EXISTS (SELECT 1 FROM stellar_project)
            OR EXISTS (SELECT 1 FROM stellar_module)
            OR EXISTS (SELECT 1 FROM stellar_unit)
            OR EXISTS (
                SELECT 1 FROM universe_order
                WHERE NOT resolved AND (
                    kind IN ('stellar_module', 'stellar_phase', 'stellar_action')
                    OR (kind = 'mission' AND payload->>'mission' = 'STELLAR_DELIVERY')
                )
            )
    """)):
        raise RuntimeError('Stellar records exist; rollback must preserve their state.')
    op.drop_table('stellar_unit')
    op.drop_table('stellar_module')
    op.drop_index('stellar_project_active_source', table_name='stellar_project', postgresql_where=sa.text("status <> 'cancelled'"))
    op.drop_table('stellar_project')
    op.drop_table('stellar_source')
    op.drop_constraint('planet_state_id_system_id_key', 'planet_state', type_='unique')
    op.drop_constraint('planet_state_id_empire_id_key', 'planet_state', type_='unique')
    op.drop_constraint('empire_id_universe_id_key', 'empire', type_='unique')
    op.drop_constraint('star_system_id_universe_id_key', 'star_system', type_='unique')
