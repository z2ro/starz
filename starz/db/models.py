from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    type_annotation_map = {datetime: DateTime(timezone=True)}


class Universe(Base):
    __tablename__ = 'universe'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(unique=True)
    seed: Mapped[str]
    created_at: Mapped[datetime]


class StarSystem(Base):
    __tablename__ = 'star_system'
    __table_args__ = (UniqueConstraint('universe_id', 'x', 'y'), UniqueConstraint('id', 'universe_id'))
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    x: Mapped[int]
    y: Mapped[int]
    created_at: Mapped[datetime]


class Empire(Base):
    __tablename__ = 'empire'
    __table_args__ = (UniqueConstraint('universe_id', 'name'), UniqueConstraint('id', 'universe_id'))
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    home_system_id: Mapped[UUID] = mapped_column(ForeignKey('star_system.id'))
    home_planet_id: Mapped[UUID | None] = mapped_column(
        ForeignKey('planet_state.id', use_alter=True)
    )
    name: Mapped[str]
    last_updated: Mapped[datetime]
    created_at: Mapped[datetime]


class Planet(Base):
    __tablename__ = 'planet_state'
    __table_args__ = (
        UniqueConstraint('system_id', 'planet_index'),
        UniqueConstraint('id', 'empire_id'),
        UniqueConstraint('id', 'system_id'),
        CheckConstraint('planet_index >= 0', name='planet_index_nonnegative'),
        CheckConstraint('population_total >= 0', name='population_nonnegative'),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    system_id: Mapped[UUID] = mapped_column(ForeignKey('star_system.id'))
    planet_index: Mapped[int]
    empire_id: Mapped[UUID | None] = mapped_column(ForeignKey('empire.id'))
    population_total: Mapped[int]
    created_at: Mapped[datetime]
    last_updated: Mapped[datetime]


class PlanetStock(Base):
    __tablename__ = 'planet_stock'
    __table_args__ = (CheckConstraint("amount >= 0 AND amount < 'Infinity'::float8", name='stock_finite_nonnegative'),)
    planet_id: Mapped[UUID] = mapped_column(ForeignKey('planet_state.id'), primary_key=True)
    resource_id: Mapped[str] = mapped_column(primary_key=True)
    amount: Mapped[float]


class District(Base):
    __tablename__ = 'planet_district'
    __table_args__ = (CheckConstraint('level >= 0', name='district_level_nonnegative'),)
    planet_id: Mapped[UUID] = mapped_column(ForeignKey('planet_state.id'), primary_key=True)
    district_id: Mapped[str] = mapped_column(primary_key=True)
    level: Mapped[int]


class Construction(Base):
    __tablename__ = 'construction_job'
    __table_args__ = (CheckConstraint('complete_at >= started_at', name='construction_time_order'),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    planet_id: Mapped[UUID] = mapped_column(ForeignKey('planet_state.id'), index=True)
    district_id: Mapped[str]
    started_at: Mapped[datetime]
    complete_at: Mapped[datetime] = mapped_column(index=True)


class Research(Base):
    __tablename__ = 'research_state'
    __table_args__ = (
        CheckConstraint("remaining_work >= 0 AND remaining_work < 'Infinity'::float8", name='research_work_nonnegative'),
        CheckConstraint('active_technology_id IS NOT NULL OR remaining_work = 0', name='inactive_research_no_work'),
    )
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), primary_key=True)
    active_technology_id: Mapped[str | None]
    remaining_work: Mapped[float]
    complete_at: Mapped[datetime | None]
    updated_at: Mapped[datetime]


class CompletedTechnology(Base):
    __tablename__ = 'completed_technology'
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), primary_key=True)
    technology_id: Mapped[str] = mapped_column(primary_key=True)
    completed_at: Mapped[datetime]


class Ship(Base):
    __tablename__ = 'ship'
    __table_args__ = (
        UniqueConstraint('id', 'empire_id'),
        CheckConstraint('crew >= 0', name='crew_nonnegative'),
        CheckConstraint("mass > 0 AND mass < 'Infinity'::float8", name='mass_positive'),
        CheckConstraint('ready_at >= created_at', name='ship_time_order'),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), index=True)
    hull_id: Mapped[str]
    propulsion_id: Mapped[str]
    fuel_id: Mapped[str]
    crew: Mapped[int]
    mass: Mapped[float]
    ready_at: Mapped[datetime]
    created_at: Mapped[datetime]
    origin_planet_id: Mapped[UUID | None] = mapped_column(ForeignKey('planet_state.id'))
    system_x: Mapped[int | None]
    system_y: Mapped[int | None]


class Fleet(Base):
    __tablename__ = 'fleet'
    __table_args__ = (
        UniqueConstraint('id', 'empire_id'),
        CheckConstraint("status IN ('ARRIVED', 'TRANSIT')", name='fleet_status'),
        CheckConstraint("mission IN ('MOVE', 'SURVEY', 'COLONIZE')", name='fleet_mission'),
        CheckConstraint("(mission = 'COLONIZE' AND target_planet_index IS NOT NULL AND target_planet_index >= 0 AND colonization_population > 0) OR (mission <> 'COLONIZE' AND target_planet_index IS NULL AND colonization_population IS NULL)", name='fleet_colonization_target'),
        CheckConstraint('arrival_at >= departure_at', name='fleet_time_order'),
        CheckConstraint("fuel_cost >= 0 AND fuel_cost < 'Infinity'::float8", name='fleet_fuel_nonnegative'),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), index=True)
    name: Mapped[str]
    x: Mapped[int]
    y: Mapped[int]
    destination_x: Mapped[int]
    destination_y: Mapped[int]
    status: Mapped[str]
    mission: Mapped[str] = mapped_column(default='MOVE', server_default='MOVE')
    target_planet_index: Mapped[int | None]
    colonization_population: Mapped[int | None]
    colonization_origin_planet_id: Mapped[UUID | None] = mapped_column(ForeignKey('planet_state.id'))
    fuel_reserve: Mapped[float] = mapped_column(default=0)
    departure_at: Mapped[datetime]
    arrival_at: Mapped[datetime] = mapped_column(index=True)
    propulsion_id: Mapped[str]
    mode: Mapped[str]
    fuel_cost: Mapped[float]


class FleetShip(Base):
    __tablename__ = 'fleet_ship'
    __table_args__ = (
        ForeignKeyConstraint(['fleet_id', 'empire_id'], ['fleet.id', 'fleet.empire_id']),
        ForeignKeyConstraint(['ship_id', 'empire_id'], ['ship.id', 'ship.empire_id']),
        UniqueConstraint('ship_id'),
    )
    fleet_id: Mapped[UUID] = mapped_column(primary_key=True)
    ship_id: Mapped[UUID] = mapped_column(primary_key=True)
    empire_id: Mapped[UUID]


class Notice(Base):
    __tablename__ = 'notice'
    __table_args__ = (UniqueConstraint('empire_id', 'sequence'),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'))
    sequence: Mapped[int]
    message: Mapped[str]
    created_at: Mapped[datetime]


class SystemKnowledge(Base):
    __tablename__ = 'system_knowledge'
    __table_args__ = (
        CheckConstraint("knowledge_level = 'SURVEYED'", name='system_knowledge_level'),
    )
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), primary_key=True)
    system_x: Mapped[int] = mapped_column(primary_key=True)
    system_y: Mapped[int] = mapped_column(primary_key=True)
    knowledge_level: Mapped[str] = mapped_column(default='SURVEYED', server_default='SURVEYED')
    surveyed_at: Mapped[datetime]


class Campaign(Base):
    __tablename__ = 'campaign'
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONB)
    selected_at: Mapped[datetime] = mapped_column(server_default=func.now())
    created_at: Mapped[datetime]


class PlayerAccount(Base):
    __tablename__ = 'player_account'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    username: Mapped[str] = mapped_column(unique=True)
    password_hash: Mapped[str]
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), unique=True)
    created_at: Mapped[datetime]


class PlayerSession(Base):
    __tablename__ = 'player_session'
    token_hash: Mapped[str] = mapped_column(primary_key=True)
    account_id: Mapped[UUID] = mapped_column(ForeignKey('player_account.id'), index=True)
    expires_at: Mapped[datetime]


class EmpireProgress(Base):
    __tablename__ = 'empire_progress'
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONB)


class UniverseOrder(Base):
    __tablename__ = 'universe_order'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'), index=True)
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), index=True)
    kind: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB)
    due_at: Mapped[datetime | None] = mapped_column(index=True)
    resolved: Mapped[bool] = mapped_column(default=False)


class PlanetDefenseState(Base):
    __tablename__ = 'planet_defense_state'
    planet_id: Mapped[UUID] = mapped_column(ForeignKey('planet_state.id'), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSONB)


class StellarSource(Base):
    __tablename__ = 'stellar_source'
    __table_args__ = (
        UniqueConstraint('origin_system_id'),
        UniqueConstraint('id', 'universe_id'),
        ForeignKeyConstraint(['origin_system_id', 'universe_id'], ['star_system.id', 'star_system.universe_id']),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    origin_system_id: Mapped[UUID]
    removed_at: Mapped[datetime | None]
    created_at: Mapped[datetime]


class StellarProject(Base):
    __tablename__ = 'stellar_project'
    __table_args__ = (
        UniqueConstraint('id', 'universe_id', 'empire_id'),
        UniqueConstraint('id', 'universe_id'),
        ForeignKeyConstraint(['source_id', 'universe_id'], ['stellar_source.id', 'stellar_source.universe_id']),
        ForeignKeyConstraint(['empire_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
        CheckConstraint("status IN ('reserved', 'building', 'commissioned', 'cancelled')", name='stellar_project_status'),
        CheckConstraint('completed_phases BETWEEN 0 AND 5', name='stellar_project_phases'),
        CheckConstraint("(status = 'commissioned') = (completed_phases = 5)", name='stellar_project_commissioned'),
        Index('stellar_project_active_source', 'source_id', unique=True, postgresql_where=text("status <> 'cancelled'")),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    source_id: Mapped[UUID]
    empire_id: Mapped[UUID]
    status: Mapped[str]
    completed_phases: Mapped[int]
    phase_records: Mapped[list] = mapped_column(JSONB)
    stocks: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]


class StellarModule(Base):
    __tablename__ = 'stellar_module'
    __table_args__ = (
        UniqueConstraint('id', 'universe_id'),
        ForeignKeyConstraint(['empire_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
        ForeignKeyConstraint(['origin_planet_id', 'empire_id'], ['planet_state.id', 'planet_state.empire_id']),
        ForeignKeyConstraint(['project_id', 'universe_id', 'empire_id'], ['stellar_project.id', 'stellar_project.universe_id', 'stellar_project.empire_id']),
        ForeignKeyConstraint(['fleet_id', 'empire_id'], ['fleet.id', 'fleet.empire_id']),
        ForeignKeyConstraint(['current_planet_id', 'empire_id'], ['planet_state.id', 'planet_state.empire_id']),
        ForeignKeyConstraint(['operation_id', 'universe_id', 'empire_id'], ['stellar_operation.id', 'stellar_operation.universe_id', 'stellar_operation.actor_id']),
        CheckConstraint("kind IN ('containment', 'shielding', 'control', 'propulsion', 'weapons')", name='stellar_module_kind'),
        CheckConstraint("status IN ('manufacturing', 'ready', 'transit', 'delivered', 'committed', 'consumed')", name='stellar_module_status'),
        CheckConstraint("(status = 'transit') = (fleet_id IS NOT NULL)", name='stellar_module_fleet'),
        CheckConstraint("status NOT IN ('delivered', 'committed', 'consumed') OR project_id IS NOT NULL OR operation_id IS NOT NULL", name='stellar_module_project'),
        CheckConstraint('consumed_phase IS NULL OR consumed_phase BETWEEN 1 AND 5', name='stellar_module_phase'),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    empire_id: Mapped[UUID]
    kind: Mapped[str]
    status: Mapped[str]
    origin_planet_id: Mapped[UUID]
    current_planet_id: Mapped[UUID | None]
    operation_id: Mapped[UUID | None]
    project_id: Mapped[UUID | None]
    fleet_id: Mapped[UUID | None]
    consumed_phase: Mapped[int | None]
    manufacture_order_id: Mapped[UUID] = mapped_column(ForeignKey('universe_order.id'), unique=True)
    phase_order_id: Mapped[UUID | None] = mapped_column(ForeignKey('universe_order.id'), unique=True)
    delivery_order_id: Mapped[UUID | None] = mapped_column(ForeignKey('universe_order.id'))
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]


class StellarUnit(Base):
    __tablename__ = 'stellar_unit'
    __table_args__ = (
        UniqueConstraint('source_id'),
        UniqueConstraint('project_id'),
        UniqueConstraint('id', 'source_id', 'universe_id'),
        ForeignKeyConstraint(['custodian_empire_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
        CheckConstraint('custody_version >= 0', name='stellar_custody_version'),
        ForeignKeyConstraint(['source_id', 'universe_id'], ['stellar_source.id', 'stellar_source.universe_id']),
        ForeignKeyConstraint(['project_id', 'universe_id'], ['stellar_project.id', 'stellar_project.universe_id']),
        ForeignKeyConstraint(['empire_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
        ForeignKeyConstraint(['system_id', 'universe_id'], ['star_system.id', 'star_system.universe_id']),
        ForeignKeyConstraint(['planet_id', 'system_id'], ['planet_state.id', 'planet_state.system_id']),
        CheckConstraint("state IN ('operational', 'damaged', 'incapacitated', 'sealed_wreck', 'rebuilding', 'repatriating', 'core_transit', 'sealed_relic', 'reinstalled', 'transit')", name='stellar_unit_state'),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    source_id: Mapped[UUID]
    project_id: Mapped[UUID]
    empire_id: Mapped[UUID]
    custodian_empire_id: Mapped[UUID | None]
    custody_version: Mapped[int] = mapped_column(default=0, server_default='0')
    system_id: Mapped[UUID]
    planet_id: Mapped[UUID | None]
    state: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime]
    stocks: Mapped[dict] = mapped_column(JSONB)


class StellarOperation(Base):
    __tablename__ = 'stellar_operation'
    __table_args__ = (
        UniqueConstraint('id', 'universe_id', 'actor_id'),
        UniqueConstraint('id', 'unit_id', 'universe_id'),
        ForeignKeyConstraint(['unit_id', 'source_id', 'universe_id'], ['stellar_unit.id', 'stellar_unit.source_id', 'stellar_unit.universe_id']),
        ForeignKeyConstraint(['actor_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
        ForeignKeyConstraint(['recipient_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
        ForeignKeyConstraint(['system_id', 'universe_id'], ['star_system.id', 'star_system.universe_id']),
        ForeignKeyConstraint(['planet_id', 'system_id'], ['planet_state.id', 'planet_state.system_id']),
        CheckConstraint("kind IN ('claim', 'conquer', 'offer', 'rebuild', 'repatriate', 'withdraw', 'decommission')", name='stellar_operation_kind'),
        CheckConstraint("status IN ('pending', 'offered', 'working', 'transit', 'returning', 'completed', 'cancelled', 'contested', 'failed')", name='stellar_operation_status'),
        Index('stellar_operation_active_unit', 'unit_id', unique=True,
              postgresql_where=text("status IN ('pending', 'offered', 'working', 'transit', 'returning')")),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    source_id: Mapped[UUID]
    unit_id: Mapped[UUID]
    actor_id: Mapped[UUID]
    recipient_id: Mapped[UUID | None]
    kind: Mapped[str]
    status: Mapped[str]
    system_id: Mapped[UUID]
    planet_id: Mapped[UUID | None]
    custody_version: Mapped[int]
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime]
    due_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]


class StellarLedger(Base):
    __tablename__ = 'stellar_ledger'
    __table_args__ = (
        UniqueConstraint('unit_id', 'event_key'),
        ForeignKeyConstraint(['unit_id', 'source_id', 'universe_id'], ['stellar_unit.id', 'stellar_unit.source_id', 'stellar_unit.universe_id']),
        ForeignKeyConstraint(['operation_id', 'unit_id', 'universe_id'], ['stellar_operation.id', 'stellar_operation.unit_id', 'stellar_operation.universe_id']),
        ForeignKeyConstraint(['actor_id', 'universe_id'], ['empire.id', 'empire.universe_id']),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    source_id: Mapped[UUID]
    unit_id: Mapped[UUID]
    operation_id: Mapped[UUID]
    actor_id: Mapped[UUID]
    event_key: Mapped[str]
    effect: Mapped[str]
    payload: Mapped[dict] = mapped_column(JSONB)
    created_at: Mapped[datetime]
