"""Accounts and persistent universe orders; existing empires/saves are retained."""
from alembic import op
from sqlalchemy.schema import CreateTable
from starz.db.models import PlayerAccount, PlayerSession, EmpireProgress, UniverseOrder
revision = 'd02b00000001'
down_revision = 'c01a00000001'
branch_labels = None
depends_on = None
TABLES = (PlayerAccount.__table__, PlayerSession.__table__, EmpireProgress.__table__, UniverseOrder.__table__)
def upgrade():
    for table in TABLES:
        if table is UniverseOrder.__table__:
            # This historical revision predates the composite FK and its referenced unique key.
            foreign_keys = [fk for fk in table.foreign_key_constraints
                            if fk.name != 'fk_universe_order_empire_universe']
            op.execute(CreateTable(table, include_foreign_key_constraints=foreign_keys))
            for index in table.indexes:
                index.create(op.get_bind())
        else:
            table.create(op.get_bind())
def downgrade():
    for table in reversed(TABLES):
        table.drop(op.get_bind())
