"""Planet-owned defense inventories, paid queues and per-unit durability."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
revision = 'd04d00000001'
down_revision = 'd03c00000001'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('planet_defense_state',sa.Column('planet_id',sa.Uuid(),sa.ForeignKey('planet_state.id'),primary_key=True),sa.Column('payload',postgresql.JSONB(),nullable=False))

def downgrade():
    op.drop_table('planet_defense_state')
