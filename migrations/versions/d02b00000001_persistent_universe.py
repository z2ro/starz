"""Accounts and persistent universe orders; existing empires/saves are retained."""
from alembic import op
from starz.db.models import PlayerAccount, PlayerSession, EmpireProgress, UniverseOrder
revision = 'd02b00000001'
down_revision = 'c01a00000001'
branch_labels = None
depends_on = None
TABLES = (PlayerAccount.__table__, PlayerSession.__table__, EmpireProgress.__table__, UniverseOrder.__table__)
def upgrade():
    for table in TABLES:
        table.create(op.get_bind())
def downgrade():
    for table in reversed(TABLES):
        table.drop(op.get_bind())
