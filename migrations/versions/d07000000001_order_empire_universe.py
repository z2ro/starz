"""Require every order and its empire to belong to the same universe."""
from alembic import op
import sqlalchemy as sa

revision = 'd07000000001'
down_revision = 'd06f00000001'
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    unique = inspector.get_unique_constraints('empire')
    if not any(item['column_names'] == ['id', 'universe_id'] for item in unique):
        raise RuntimeError('Missing empire(id, universe_id) unique constraint.')
    if any(item['name'] == 'fk_universe_order_empire_universe'
           for item in inspector.get_foreign_keys('universe_order')):
        raise RuntimeError('Order empire/universe constraint already exists; inspect schema before upgrading.')
    connection.execute(sa.text('LOCK TABLE universe_order IN SHARE ROW EXCLUSIVE MODE'))
    if connection.scalar(sa.text('''
        SELECT EXISTS (SELECT 1 FROM universe_order o
        LEFT JOIN empire e ON e.id = o.empire_id AND e.universe_id = o.universe_id
        WHERE e.id IS NULL)
    ''')):
        raise RuntimeError('Inconsistent universe_order empire/universe references; inspect data before upgrading.')
    op.create_foreign_key('fk_universe_order_empire_universe', 'universe_order', 'empire',
                          ['empire_id', 'universe_id'], ['id', 'universe_id'])


def downgrade():
    op.drop_constraint('fk_universe_order_empire_universe', 'universe_order', type_='foreignkey')
