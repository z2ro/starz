"""Persist system knowledge and fleet missions."""

from alembic import op
import sqlalchemy as sa


revision = "9f32b1e6d4aa"
down_revision = "2c4f8a1b9e77"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "fleet",
        sa.Column("mission", sa.String(), server_default="MOVE", nullable=False),
    )
    op.create_check_constraint(
        "fleet_mission", "fleet", "mission IN ('MOVE', 'SURVEY')"
    )
    op.create_table(
        "system_knowledge",
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("system_x", sa.Integer(), nullable=False),
        sa.Column("system_y", sa.Integer(), nullable=False),
        sa.Column(
            "knowledge_level", sa.String(), server_default="SURVEYED", nullable=False
        ),
        sa.Column("surveyed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "knowledge_level = 'SURVEYED'", name="system_knowledge_level"
        ),
        sa.ForeignKeyConstraint(["empire_id"], ["empire.id"]),
        sa.PrimaryKeyConstraint("empire_id", "system_x", "system_y"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO system_knowledge
                (empire_id, system_x, system_y, knowledge_level, surveyed_at)
            SELECT e.id, s.x, s.y, 'SURVEYED', e.created_at
            FROM empire AS e
            JOIN star_system AS s ON s.id = e.home_system_id
            ON CONFLICT DO NOTHING
            """
        )
    )


def downgrade():
    op.drop_table("system_knowledge")
    op.drop_constraint("fleet_mission", "fleet", type_="check")
    op.drop_column("fleet", "mission")
