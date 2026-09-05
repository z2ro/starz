"""Allow multiple planet states and make the homeworld explicit."""

from alembic import op
import sqlalchemy as sa


revision = "2c4f8a1b9e77"
down_revision = "7e214d5443b1"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("planet_state_system_id_key", "planet_state", type_="unique")
    op.drop_constraint("planet_state_empire_id_key", "planet_state", type_="unique")
    op.alter_column("planet_state", "empire_id", nullable=True)
    op.add_column("planet_state", sa.Column("planet_index", sa.Integer(), nullable=True))
    op.execute(sa.text("UPDATE planet_state SET planet_index = 0 WHERE planet_index IS NULL"))
    op.alter_column("planet_state", "planet_index", nullable=False)
    op.create_check_constraint(
        "planet_index_nonnegative", "planet_state", "planet_index >= 0"
    )
    op.create_unique_constraint(
        "uq_planet_state_system_index", "planet_state", ["system_id", "planet_index"]
    )

    op.add_column("empire", sa.Column("home_planet_id", sa.Uuid(), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE empire AS e
            SET home_planet_id = p.id
            FROM planet_state AS p
            WHERE p.empire_id = e.id AND p.planet_index = 0
            """
        )
    )
    op.create_foreign_key(
        "fk_empire_home_planet", "empire", "planet_state", ["home_planet_id"], ["id"]
    )


def downgrade():
    op.drop_constraint("fk_empire_home_planet", "empire", type_="foreignkey")
    op.drop_column("empire", "home_planet_id")
    op.drop_constraint("uq_planet_state_system_index", "planet_state", type_="unique")
    op.drop_constraint("planet_index_nonnegative", "planet_state", type_="check")
    op.drop_column("planet_state", "planet_index")
    op.alter_column("planet_state", "empire_id", nullable=False)
    op.create_unique_constraint("planet_state_system_id_key", "planet_state", ["system_id"])
    op.create_unique_constraint("planet_state_empire_id_key", "planet_state", ["empire_id"])
