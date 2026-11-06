"""Version the research payload; legacy jobs are promoted atomically on next load.

Levels and the relational research row remain intact. The deterministic loader
uses catalog domains and preserves the remaining work/rate of the legacy job.
"""
from alembic import op
revision = 'd03c00000001'
down_revision = 'd02b00000001'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("UPDATE empire_progress SET payload = jsonb_set(payload, '{research_schema}', '2'::jsonb)")

def downgrade():
    # Keep domain jobs: deleting in-flight work would lose paid player progress.
    op.execute("UPDATE empire_progress SET payload = payload - 'research_schema'")
