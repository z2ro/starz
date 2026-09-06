from __future__ import annotations

from math import hypot
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Body, FastAPI, HTTPException, Query
from sqlalchemy import text
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .data import Catalog, DataValidationError
from .db.store import Store, database_engine
from .settings import Settings
from .effects import unlocked_content
from .universe import generate_system

ROOT = Path(__file__).resolve().parent.parent
catalog = Catalog.load(ROOT / "game_data")


@asynccontextmanager
async def lifespan(app):
    settings = Settings.from_env()
    database = database_engine(settings.database_url)
    try:
        store = Store(database, catalog, settings.universe_seed)
        app.state.default_empire_id = store.bootstrap()
        app.state.store = store
        yield
    finally:
        database.dispose()


app = FastAPI(title="StarZ", version="0.1.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT / "frontend"), name="static")


class BuildRequest(BaseModel):
    id: str
    planet_id: str | None = None


class ResearchRequest(BaseModel):
    id: str


class BuildShipRequest(BaseModel):
    planet_id: str | None = None
    hull_id: str = 'scout_hull'
    propulsion_id: str = 'chemical_drive'
    fuel_id: str = 'ion_fuel'


class TravelRequest(BaseModel):
    planet_id: str | None = None
    target_x: int = Field(ge=-100, le=100)
    target_y: int = Field(ge=-100, le=100)
    propulsion_id: str
    mode: str
    fleet_id: str | None = None
    ship_id: str | None = None
    mission: Literal['MOVE', 'SURVEY', 'COLONIZE'] = 'MOVE'
    target_planet_index: int | None = Field(default=None, ge=0)


def action(call, *, planet_id=None, colony_target=None):
    try:
        options = {}
        if planet_id is not None:
            options['planet_id'] = planet_id
        if colony_target is not None:
            options['colony_target'] = colony_target
        return app.state.store.run(app.state.default_empire_id, call, **options)
    except DataValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get('/health')
def health():
    with app.state.store.database.connect() as connection:
        connection.execute(text('SELECT 1'))
    return {'app': 'ok', 'database': 'ok'}


@app.get("/")
def index():
    return FileResponse(ROOT / "frontend" / "index.html")


@app.get("/api/state")
def state(planet_id: str | None = None):
    return action(state_snapshot, planet_id=planet_id)


@app.get('/api/planets')
def planets():
    return action(lambda engine: planet_list(engine))


@app.get('/api/planets/{planet_id}')
def planet_detail(planet_id: str):
    return action(state_snapshot, planet_id=planet_id)


@app.get('/api/catalog')
def game_catalog():
    kinds = ('resources', 'districts', 'technologies', 'ships', 'propulsion', 'fuels', 'travel_modes')
    return {kind: [item.model_dump() for _, item in sorted(catalog.items[kind].items())] for kind in kinds}


def galaxy_snapshot(engine, center: tuple[int, int], radius: int):
    home = (engine.state.home_system_x if engine.state.home_system_x is not None else engine.state.system_x, engine.state.home_system_y if engine.state.home_system_y is not None else engine.state.system_y)
    valid_centers = {home, *((fleet['x'], fleet['y']) for fleet in engine.state.fleets if fleet['status'] == 'ARRIVED')}
    if center not in valid_centers:
        raise DataValidationError('centro do mapa deve ser o homeworld ou uma frota em sistema')
    systems = []
    for x in range(center[0] - radius, center[0] + radius + 1):
        for y in range(center[1] - radius, center[1] + radius + 1):
            level = engine.knowledge_level(x, y)
            item = {'id': f'{x}:{y}', 'x': x, 'y': y, 'distance': round(hypot(x - center[0], y - center[1]), 2), 'home': (x, y) == home, 'knowledge_level': level}
            if level == 'SURVEYED':
                system = generate_system(engine.state.seed, x, y, engine.catalog)
                planets = []
                owned = {(item['x'], item['y'], item['planet_index']): item for item in engine.state.planets}
                for index, planet in enumerate(system.planets):
                    status = engine.colonization_status(x, y, index)
                    owner = 'OWNED' if (x, y, index) in owned else ('OCCUPIED' if engine.planet_key(x, y, index) in engine.state.occupied_planets else 'UNCLAIMED')
                    planets.append({
                        'planet_index': index, 'name': planet.name, 'gravity': planet.gravity,
                        'temperature': planet.temperature, 'water': planet.water, 'radiation': planet.radiation,
                        'viability': status.get('viability'), 'ownership': owner,
                        'colonization': {**status, 'population': engine.colonization_rules.population, 'cost': engine.colonization_rules.cost},
                    })
                item.update({
                    'id': system.id, 'name': system.name,
                    'star': {'stellar_class': system.star.stellar_class, 'luminosity': system.star.luminosity, 'activity': system.star.activity},
                    'planet': {'name': system.planet.name, 'gravity': system.planet.gravity, 'temperature': system.planet.temperature, 'water': system.planet.water, 'radiation': system.planet.radiation},
                    'planets': planets,
                })
            systems.append(item)
    return {'center': list(center), 'home': list(home), 'radius': radius, 'systems': systems}


@app.get('/api/galaxy')
def galaxy(
    radius: int = Query(2, ge=1, le=3),
    center_x: int | None = Query(None, ge=-100, le=100),
    center_y: int | None = Query(None, ge=-100, le=100),
):
    if (center_x is None) != (center_y is None):
        raise HTTPException(status_code=422, detail='center_x e center_y devem ser informados juntos')
    return action(lambda engine: galaxy_snapshot(engine, (engine.state.system_x, engine.state.system_y) if center_x is None else (center_x, center_y), radius))


def state_snapshot(engine):
    system = engine.system()
    capacities = engine.capacities()
    return {"system": system.to_dict(), "active_planet": {"id": engine.state.planet_id, "planet_index": engine.state.planet_index, "home": engine.state.planet_id == engine.state.home_planet_id}, "planets": planet_list(engine), "stocks": {key: round(value, 2) for key, value in engine.state.stocks.items()}, "capacities": capacities, "population": {"total": engine.state.population_total, "available": capacities["available_population"], "capacity": 100 + sum(engine.catalog.get("districts", key).population_capacity * level for key, level in engine.state.districts.items())}, "districts": dict(engine.state.districts), "construction": list(engine.state.construction), "research": dict(engine.state.research), "ships": [dict(ship) for ship in engine.state.ships], "fleets": [{**fleet, "eta": max(0, round(fleet["arrival_at"] - engine.state.last_updated)) if fleet["status"] == "TRANSIT" else 0} for fleet in engine.state.fleets], "notices": engine.state.notices[:5], "travel_modes": [item.model_dump() for _, item in sorted(catalog.items['travel_modes'].items())], "unlocked_content": sorted(unlocked_content(catalog, engine.state.research['completed']))}


def planet_list(engine):
    result = []
    for item in engine.state.planets:
        physical = generate_system(engine.state.seed, item['x'], item['y'], engine.catalog).planets[item['planet_index']]
        result.append({**item, 'name': physical.name, 'stocks': {key: round(value, 2) for key, value in engine.state.stocks_by_planet.get(item['id'], {}).items()}})
    return result


@app.post("/api/build")
def build(request: BuildRequest):
    return action(lambda engine: engine.build(request.id, now=engine.state.last_updated), planet_id=request.planet_id)


@app.post("/api/research")
def research(request: ResearchRequest):
    return action(lambda engine: engine.research(request.id, now=engine.state.last_updated))


@app.post("/api/build-ship")
def build_ship(request: BuildShipRequest = Body(default=BuildShipRequest())):
    return action(lambda engine: engine.build_ship(request.hull_id, request.propulsion_id, request.fuel_id, now=engine.state.last_updated), planet_id=request.planet_id)


@app.post("/api/travel")
def travel(request: TravelRequest):
    if request.mission == 'COLONIZE' and request.planet_id is None:
        raise HTTPException(status_code=400, detail='COLONIZE exige planet_id como origem da missão')
    target = (request.target_x, request.target_y, request.target_planet_index) if request.mission == 'COLONIZE' and request.target_planet_index is not None else None
    return action(lambda engine: engine.send_fleet(request.target_x, request.target_y, request.propulsion_id, request.mode, now=engine.state.last_updated, fleet_id=request.fleet_id, ship_id=request.ship_id, mission=request.mission, target_planet_index=request.target_planet_index, planet_id=request.planet_id), planet_id=request.planet_id, colony_target=target)


@app.post("/api/travel-preview")
def travel_preview(request: TravelRequest):
    if request.mission == 'COLONIZE' and request.planet_id is None:
        raise HTTPException(status_code=400, detail='COLONIZE exige planet_id como origem da missão')
    def preview(engine):
        catalog.get('travel_modes', request.mode)
        return {mode: engine.preview_travel(request.target_x, request.target_y, request.propulsion_id, mode, fleet_id=request.fleet_id, ship_id=request.ship_id, planet_id=request.planet_id, intra_system=request.mission == 'COLONIZE') for mode in sorted(catalog.items['travel_modes'])}
    return action(preview, planet_id=request.planet_id)
