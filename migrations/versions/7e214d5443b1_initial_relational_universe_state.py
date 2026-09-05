"""Initial relational universe state"""

from alembic import op
import sqlalchemy as sa


revision = "7e214d5443b1"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "universe",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("seed", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "star_system",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("universe_id", sa.Uuid(), nullable=False),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["universe_id"],
            ["universe.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("universe_id", "x", "y"),
    )
    op.create_table(
        "empire",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("universe_id", sa.Uuid(), nullable=False),
        sa.Column("home_system_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["home_system_id"],
            ["star_system.id"],
        ),
        sa.ForeignKeyConstraint(
            ["universe_id"],
            ["universe.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("universe_id", "name"),
    )
    op.create_table(
        "completed_technology",
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("technology_id", sa.String(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.PrimaryKeyConstraint("empire_id", "technology_id"),
    )
    op.create_table(
        "empire_stock",
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("resource_id", sa.String(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.CheckConstraint(
            "amount >= 0 AND amount < 'Infinity'::float8",
            name="stock_finite_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.PrimaryKeyConstraint("empire_id", "resource_id"),
    )
    op.create_table(
        "fleet",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
        sa.Column("destination_x", sa.Integer(), nullable=False),
        sa.Column("destination_y", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("departure_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("arrival_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("propulsion_id", sa.String(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("fuel_cost", sa.Float(), nullable=False),
        sa.CheckConstraint(
            "fuel_cost >= 0 AND fuel_cost < 'Infinity'::float8",
            name="fleet_fuel_nonnegative",
        ),
        sa.CheckConstraint("status IN ('ARRIVED', 'TRANSIT')", name="fleet_status"),
        sa.CheckConstraint("arrival_at >= departure_at", name="fleet_time_order"),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "empire_id"),
    )
    op.create_index(op.f("ix_fleet_arrival_at"), "fleet", ["arrival_at"], unique=False)
    op.create_index(op.f("ix_fleet_empire_id"), "fleet", ["empire_id"], unique=False)
    op.create_table(
        "notice",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empire_id", "sequence"),
    )
    op.create_table(
        "planet_state",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("system_id", sa.Uuid(), nullable=False),
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("population_total", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("population_total >= 0", name="population_nonnegative"),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.ForeignKeyConstraint(
            ["system_id"],
            ["star_system.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("empire_id"),
        sa.UniqueConstraint("system_id"),
    )
    op.create_table(
        "research_state",
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("active_technology_id", sa.String(), nullable=True),
        sa.Column("remaining_work", sa.Float(), nullable=False),
        sa.Column("complete_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "remaining_work >= 0 AND remaining_work < 'Infinity'::float8",
            name="research_work_nonnegative",
        ),
        sa.CheckConstraint(
            "active_technology_id IS NOT NULL OR remaining_work = 0",
            name="inactive_research_no_work",
        ),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.PrimaryKeyConstraint("empire_id"),
    )
    op.create_table(
        "ship",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.Column("hull_id", sa.String(), nullable=False),
        sa.Column("propulsion_id", sa.String(), nullable=False),
        sa.Column("fuel_id", sa.String(), nullable=False),
        sa.Column("crew", sa.Integer(), nullable=False),
        sa.Column("mass", sa.Float(), nullable=False),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "mass > 0 AND mass < 'Infinity'::float8", name="mass_positive"
        ),
        sa.CheckConstraint("crew >= 0", name="crew_nonnegative"),
        sa.CheckConstraint("ready_at >= created_at", name="ship_time_order"),
        sa.ForeignKeyConstraint(
            ["empire_id"],
            ["empire.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id", "empire_id"),
    )
    op.create_index(op.f("ix_ship_empire_id"), "ship", ["empire_id"], unique=False)
    op.create_table(
        "construction_job",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("planet_id", sa.Uuid(), nullable=False),
        sa.Column("district_id", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("complete_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("complete_at >= started_at", name="construction_time_order"),
        sa.ForeignKeyConstraint(
            ["planet_id"],
            ["planet_state.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_construction_job_complete_at"),
        "construction_job",
        ["complete_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_construction_job_planet_id"),
        "construction_job",
        ["planet_id"],
        unique=False,
    )
    op.create_table(
        "fleet_ship",
        sa.Column("fleet_id", sa.Uuid(), nullable=False),
        sa.Column("ship_id", sa.Uuid(), nullable=False),
        sa.Column("empire_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["fleet_id", "empire_id"],
            ["fleet.id", "fleet.empire_id"],
        ),
        sa.ForeignKeyConstraint(
            ["ship_id", "empire_id"],
            ["ship.id", "ship.empire_id"],
        ),
        sa.PrimaryKeyConstraint("fleet_id", "ship_id"),
        sa.UniqueConstraint("ship_id"),
    )
    op.create_table(
        "planet_district",
        sa.Column("planet_id", sa.Uuid(), nullable=False),
        sa.Column("district_id", sa.String(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.CheckConstraint("level >= 0", name="district_level_nonnegative"),
        sa.ForeignKeyConstraint(
            ["planet_id"],
            ["planet_state.id"],
        ),
        sa.PrimaryKeyConstraint("planet_id", "district_id"),
    )


def downgrade():
    op.drop_table("planet_district")
    op.drop_table("fleet_ship")
    op.drop_index(op.f("ix_construction_job_planet_id"), table_name="construction_job")
    op.drop_index(
        op.f("ix_construction_job_complete_at"), table_name="construction_job"
    )
    op.drop_table("construction_job")
    op.drop_index(op.f("ix_ship_empire_id"), table_name="ship")
    op.drop_table("ship")
    op.drop_table("research_state")
    op.drop_table("planet_state")
    op.drop_table("notice")
    op.drop_index(op.f("ix_fleet_empire_id"), table_name="fleet")
    op.drop_index(op.f("ix_fleet_arrival_at"), table_name="fleet")
    op.drop_table("fleet")
    op.drop_table("empire_stock")
    op.drop_table("completed_technology")
    op.drop_table("empire")
    op.drop_table("star_system")
    op.drop_table("universe")
