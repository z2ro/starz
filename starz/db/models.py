from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, UniqueConstraint
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
    __table_args__ = (UniqueConstraint('universe_id', 'x', 'y'),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    universe_id: Mapped[UUID] = mapped_column(ForeignKey('universe.id'))
    x: Mapped[int]
    y: Mapped[int]
    created_at: Mapped[datetime]


class Empire(Base):
    __tablename__ = 'empire'
    __table_args__ = (UniqueConstraint('universe_id', 'name'),)
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
        CheckConstraint('planet_index >= 0', name='planet_index_nonnegative'),
        CheckConstraint('population_total >= 0', name='population_nonnegative'),
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    system_id: Mapped[UUID] = mapped_column(ForeignKey('star_system.id'))
    planet_index: Mapped[int]
    empire_id: Mapped[UUID | None] = mapped_column(ForeignKey('empire.id'))
    population_total: Mapped[int]
    created_at: Mapped[datetime]


class Stock(Base):
    __tablename__ = 'empire_stock'
    __table_args__ = (CheckConstraint("amount >= 0 AND amount < 'Infinity'::float8", name='stock_finite_nonnegative'),)
    empire_id: Mapped[UUID] = mapped_column(ForeignKey('empire.id'), primary_key=True)
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


class Fleet(Base):
    __tablename__ = 'fleet'
    __table_args__ = (
        UniqueConstraint('id', 'empire_id'),
        CheckConstraint("status IN ('ARRIVED', 'TRANSIT')", name='fleet_status'),
        CheckConstraint("mission IN ('MOVE', 'SURVEY')", name='fleet_mission'),
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
