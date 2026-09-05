from __future__ import annotations

from math import hypot
from pathlib import Path
from contextlib import asynccontextmanager

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


class ResearchRequest(BaseModel):
    id: str


class BuildShipRequest(BaseModel):
    hull_id: str = 'scout_hull'
    propulsion_id: str = 'chemical_drive'
    fuel_id: str = 'ion_fuel'


class TravelRequest(BaseModel):
    target_x: int = Field(ge=-100, le=100)
    target_y: int = Field(ge=-100, le=100)
    propulsion_id: str
    mode: str
    fleet_id: str | None = None
    ship_id: str | None = None


def action(call):
    try:
        return app.state.store.run(app.state.default_empire_id, call)
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
def state():
    return action(state_snapshot)


@app.get('/api/catalog')
def game_catalog():
    kinds = ('resources', 'districts', 'technologies', 'ships', 'propulsion', 'fuels', 'travel_modes')
    return {kind: [item.model_dump() for _, item in sorted(catalog.items[kind].items())] for kind in kinds}


@app.get('/api/galaxy')
def galaxy(radius: int = Query(2, ge=1, le=3)):
    def neighborhood(engine):
        center = (engine.state.system_x, engine.state.system_y)
        systems = []
        for x in range(center[0] - radius, center[0] + radius + 1):
            for y in range(center[1] - radius, center[1] + radius + 1):
                system = generate_system(engine.state.seed, x, y, catalog)
                systems.append({
                    'id': system.id, 'name': system.name, 'x': x, 'y': y,
                    'distance': round(hypot(x - center[0], y - center[1]), 2),
                    'home': (x, y) == center,
                    'star': {'stellar_class': system.star.stellar_class, 'luminosity': system.star.luminosity, 'activity': system.star.activity},
                    'planet': {'name': system.planet.name, 'gravity': system.planet.gravity, 'temperature': system.planet.temperature, 'water': system.planet.water, 'radiation': system.planet.radiation},
                })
        return {'center': list(center), 'radius': radius, 'systems': systems}
    return action(neighborhood)


def state_snapshot(engine):
    system = engine.system()
    capacities = engine.capacities()
    return {"system": system.to_dict(), "stocks": {key: round(value, 2) for key, value in engine.state.stocks.items()}, "capacities": capacities, "population": {"total": engine.state.population_total, "available": capacities["available_population"], "capacity": 100 + sum(engine.catalog.get("districts", key).population_capacity * level for key, level in engine.state.districts.items())}, "districts": dict(engine.state.districts), "construction": list(engine.state.construction), "research": dict(engine.state.research), "ships": [dict(ship) for ship in engine.state.ships], "fleets": [{**fleet, "eta": max(0, round(fleet["arrival_at"] - engine.state.last_updated)) if fleet["status"] == "TRANSIT" else 0} for fleet in engine.state.fleets], "notices": engine.state.notices[:5], "travel_modes": [item.model_dump() for _, item in sorted(catalog.items['travel_modes'].items())], "unlocked_content": sorted(unlocked_content(catalog, engine.state.research['completed']))}


@app.post("/api/build")
def build(request: BuildRequest):
    return action(lambda engine: engine.build(request.id, now=engine.state.last_updated))


@app.post("/api/research")
def research(request: ResearchRequest):
    return action(lambda engine: engine.research(request.id, now=engine.state.last_updated))


@app.post("/api/build-ship")
def build_ship(request: BuildShipRequest = Body(default=BuildShipRequest())):
    return action(lambda engine: engine.build_ship(request.hull_id, request.propulsion_id, request.fuel_id, now=engine.state.last_updated))


@app.post("/api/travel")
def travel(request: TravelRequest):
    return action(lambda engine: engine.send_fleet(request.target_x, request.target_y, request.propulsion_id, request.mode, now=engine.state.last_updated, fleet_id=request.fleet_id, ship_id=request.ship_id))


@app.post("/api/travel-preview")
def travel_preview(request: TravelRequest):
    def preview(engine):
        catalog.get('travel_modes', request.mode)
        return {mode: engine.preview_travel(request.target_x, request.target_y, request.propulsion_id, mode, fleet_id=request.fleet_id, ship_id=request.ship_id) for mode in sorted(catalog.items['travel_modes'])}
    return action(preview)
