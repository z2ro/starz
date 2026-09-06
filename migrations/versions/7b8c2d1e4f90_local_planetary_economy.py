"""local planetary stocks and physical ship origins

Revision ID: 7b8c2d1e4f90
Revises: 4a6d1c9e8b20
"""
from alembic import op
import sqlalchemy as sa


revision = '7b8c2d1e4f90'
down_revision = '4a6d1c9e8b20'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'planet_stock',
        sa.Column('planet_id', sa.Uuid(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.CheckConstraint("amount >= 0 AND amount < 'Infinity'::float8", name='stock_finite_nonnegative'),
        sa.ForeignKeyConstraint(['planet_id'], ['planet_state.id']),
        sa.PrimaryKeyConstraint('planet_id', 'resource_id'),
    )
    op.execute(
        """
        INSERT INTO planet_stock (planet_id, resource_id, amount)
        SELECT e.home_planet_id, s.resource_id, s.amount
        FROM empire_stock s
        JOIN empire e ON e.id = s.empire_id
        WHERE e.home_planet_id IS NOT NULL
        """
    )
    op.drop_table('empire_stock')

    op.add_column('ship', sa.Column('origin_planet_id', sa.Uuid(), nullable=True))
    op.add_column('ship', sa.Column('system_x', sa.Integer(), nullable=True))
    op.add_column('ship', sa.Column('system_y', sa.Integer(), nullable=True))
    op.create_foreign_key('ship_origin_planet_fk', 'ship', 'planet_state', ['origin_planet_id'], ['id'])
    op.execute(
        """
        UPDATE ship s
        SET origin_planet_id = e.home_planet_id,
            system_x = ss.x,
            system_y = ss.y
        FROM empire e
        JOIN planet_state p ON p.id = e.home_planet_id
        JOIN star_system ss ON ss.id = p.system_id
        WHERE s.empire_id = e.id
        """
    )

    op.add_column('fleet', sa.Column('colonization_origin_planet_id', sa.Uuid(), nullable=True))
    op.create_foreign_key('fleet_colonization_origin_planet_fk', 'fleet', 'planet_state', ['colonization_origin_planet_id'], ['id'])


def downgrade():
    op.drop_constraint('fleet_colonization_origin_planet_fk', 'fleet', type_='foreignkey')
    op.drop_column('fleet', 'colonization_origin_planet_id')

    op.drop_constraint('ship_origin_planet_fk', 'ship', type_='foreignkey')
    op.drop_column('ship', 'system_y')
    op.drop_column('ship', 'system_x')
    op.drop_column('ship', 'origin_planet_id')

    op.create_table(
        'empire_stock',
        sa.Column('empire_id', sa.Uuid(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.CheckConstraint("amount >= 0 AND amount < 'Infinity'::float8", name='stock_finite_nonnegative'),
        sa.ForeignKeyConstraint(['empire_id'], ['empire.id']),
        sa.PrimaryKeyConstraint('empire_id', 'resource_id'),
    )
    op.execute(
        """
        INSERT INTO empire_stock (empire_id, resource_id, amount)
        SELECT p.empire_id, ps.resource_id, SUM(ps.amount)
        FROM planet_stock ps
        JOIN planet_state p ON p.id = ps.planet_id
        WHERE p.empire_id IS NOT NULL
        GROUP BY p.empire_id, ps.resource_id
        """
    )
    op.drop_table('planet_stock')
