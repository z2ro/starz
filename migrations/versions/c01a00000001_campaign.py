"""Persistent single-player campaign state, separate from planetary stocks."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
revision = 'c01a00000001'
down_revision = '8c9d3e2f5a01'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('campaign', sa.Column('empire_id', sa.Uuid(), sa.ForeignKey('empire.id'), primary_key=True), sa.Column('payload', JSONB(), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('selected_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))


def downgrade():
    op.drop_table('campaign')
