"""planetary colonization

Revision ID: 4a6d1c9e8b20
Revises: 9f32b1e6d4aa
"""
from alembic import op
import sqlalchemy as sa

revision = '4a6d1c9e8b20'
down_revision = '9f32b1e6d4aa'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('fleet_mission', 'fleet', type_='check')
    op.add_column('fleet', sa.Column('target_planet_index', sa.Integer(), nullable=True))
    op.add_column('fleet', sa.Column('colonization_population', sa.Integer(), nullable=True))
    op.add_column('planet_state', sa.Column('last_updated', sa.DateTime(timezone=True), nullable=True))
    op.execute('UPDATE planet_state SET last_updated = empire.last_updated FROM empire WHERE planet_state.empire_id = empire.id')
    op.execute('UPDATE planet_state SET last_updated = created_at WHERE last_updated IS NULL')
    op.alter_column('planet_state', 'last_updated', nullable=False)
    op.create_check_constraint('fleet_mission', 'fleet', "mission IN ('MOVE', 'SURVEY', 'COLONIZE')")
    op.create_check_constraint(
        'fleet_colonization_target', 'fleet',
        "(mission = 'COLONIZE' AND target_planet_index IS NOT NULL AND target_planet_index >= 0 AND colonization_population > 0) OR (mission <> 'COLONIZE' AND target_planet_index IS NULL AND colonization_population IS NULL)",
    )


def downgrade():
    op.execute("UPDATE fleet SET mission = 'MOVE', target_planet_index = NULL, colonization_population = NULL WHERE mission = 'COLONIZE'")
    op.drop_constraint('fleet_colonization_target', 'fleet', type_='check')
    op.drop_constraint('fleet_mission', 'fleet', type_='check')
    op.drop_column('fleet', 'colonization_population')
    op.drop_column('fleet', 'target_planet_index')
    op.drop_column('planet_state', 'last_updated')
    op.create_check_constraint('fleet_mission', 'fleet', "mission IN ('MOVE', 'SURVEY')")
