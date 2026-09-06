"""persist fuel loaded on a fleet

Revision ID: 8c9d3e2f5a01
Revises: 7b8c2d1e4f90
"""
from alembic import op
import sqlalchemy as sa


revision = '8c9d3e2f5a01'
down_revision = '7b8c2d1e4f90'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('fleet', sa.Column('fuel_reserve', sa.Float(), nullable=False, server_default='0'))
    op.create_check_constraint('fleet_fuel_reserve_nonnegative', 'fleet', "fuel_reserve >= 0 AND fuel_reserve < 'Infinity'::float8")


def downgrade():
    op.drop_constraint('fleet_fuel_reserve_nonnegative', 'fleet', type_='check')
    op.drop_column('fleet', 'fuel_reserve')
