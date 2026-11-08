from __future__ import annotations

from math import hypot
from time import time
from uuid import UUID, uuid4
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from .db.models import Campaign, Empire, Universe
from . import campaign
from .simulation import Engine
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Body, FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from .persistent.security import current_empire, COOKIE, token_hash
from .persistent.service import PersistentStore
from .persistent.routes import router as persistent_router
from .db.models import PlayerSession, PlayerAccount
import asyncio
import logging
from sqlalchemy import text
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .data import Catalog, DataValidationError
from .db.store import Store, database_engine
from .settings import Settings
from .effects import unlocked_content
from .progression import building_quote, research_quote, effect
from .universe import generate_system

ROOT = Path(__file__).resolve().parent.parent
settings_at_import = Settings.from_env()
catalog = Catalog.load(ROOT / 'game_data', ROOT / 'persistent_data' if settings_at_import.persistent else ROOT / 'campaign_data' if settings_at_import.campaign else None)


@asynccontextmanager
async def lifespan(app):
    settings = Settings.from_env()
    database = database_engine(settings.database_url)
    task = None
    try:
        app.state.persistent = settings.persistent
        if settings.persistent:
            store = PersistentStore(database, catalog, settings.universe_seed)
            app.state.store = store
            async def heartbeat():
                while True:
                    try:
                        await asyncio.to_thread(store.tick)
                    except Exception:
                        logging.exception('Persistent universe heartbeat failed')
                    await asyncio.sleep(2)
            task = asyncio.create_task(heartbeat())
            yield
            return
        store = Store(database, catalog, settings.universe_seed, clock=(lambda: 0) if settings.campaign else time)
        if settings.campaign:
            with Session(database) as session:
                saved = session.scalar(select(Campaign).order_by(Campaign.selected_at.desc()).limit(1))
                saved_id = saved.empire_id if saved else None
            app.state.default_empire_id = saved_id or store.bootstrap(now=time(), universe_name='Concordat')
            if not saved_id:
                store.run(app.state.default_empire_id, campaign.initialize)
        else:
            app.state.default_empire_id = store.bootstrap()
        app.state.store = store
        yield
    finally:
        if task:
            task.cancel()
            try: await task
            except asyncio.CancelledError: pass
        database.dispose()


app = FastAPI(title="StarZ", version="0.1.0", lifespan=lifespan)
app.include_router(persistent_router)


@app.middleware('http')
async def account_context(request: Request, call_next):
    if not getattr(app.state, 'persistent', False) or not request.url.path.startswith('/api/'):
        return await call_next(request)
    path = request.url.path
    if request.method not in {'GET','HEAD','OPTIONS'}:
        origin = request.headers.get('origin')
        if request.headers.get('x-starz-request') != '1' or (origin and origin != f'{request.url.scheme}://{request.headers.get("host")}'):
            return JSONResponse({'detail':'Origem ou proteção CSRF inválida.'},status_code=403)
    if path.startswith('/api/campaign/'):
        return JSONResponse({'detail':'Concordat está disponível apenas no ambiente opcional separado.'},status_code=404)
    public = {'/api/config','/api/catalog','/api/auth/login','/api/auth/register'}
    if path in public:
        return await call_next(request)
    with Session(app.state.store.database) as session:
        account = session.scalar(select(PlayerAccount).join(PlayerSession).where(PlayerSession.token_hash == token_hash(request.cookies.get(COOKIE,'')), PlayerSession.expires_at > func.now()))
        empire_id = account.empire_id if account else None
    if empire_id is None:
        return JSONResponse({'detail':'Entre na sua conta para acessar o império.'},status_code=401)
    token = current_empire.set(empire_id)
    try:
        return await call_next(request)
    finally:
        current_empire.reset(token)


@app.get('/api/config')
def game_config():
    return {'persistent':getattr(app.state,'persistent',False)}


app.mount("/static", StaticFiles(directory=ROOT / "frontend" / "dist", check_dir=False), name="static")


class BuildRequest(BaseModel):
    id: str
    planet_id: str | None = None


class ResearchRequest(BaseModel):
    id: str
    planet_id: str | None = None


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


def action(call, *, planet_id=None, colony_target=None, mutating=False):
    try:
        options = {}
        if planet_id is not None:
            options['planet_id'] = planet_id
        if colony_target is not None:
            options['colony_target'] = colony_target
        return app.state.store.run(current_empire.get() if getattr(app.state, 'persistent', False) else app.state.default_empire_id, (lambda e: campaign.command(e, call)) if mutating else call, **options)
    except DataValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get('/health')
def health():
    with app.state.store.database.connect() as connection:
        connection.execute(text('SELECT 1'))
    return {'app': 'ok', 'database': 'ok'}


@app.get("/")
def index():
    return FileResponse(ROOT / "frontend" / "dist" / "index.html")


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
    kinds = ('resources', 'districts', 'technologies', 'ships', 'propulsion', 'fuels', 'travel_modes', 'defenses')
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
                sovereign = next((r['name'] for r in engine.state.campaign['rivals'] if not r['conquered'] and [x, y] in r['claims']), None) if engine.state.campaign else None
                item['civilization'] = sovereign
                planets = []
                owned = {(item['x'], item['y'], item['planet_index']): item for item in engine.state.planets}
                for index, planet in enumerate(system.planets):
                    status = engine.colonization_status(x, y, index)
                    owner = 'OWNED' if (x, y, index) in owned else ('OCCUPIED' if sovereign or engine.planet_key(x, y, index) in engine.state.occupied_planets else 'UNCLAIMED')
                    planets.append({
                        'planet_index': index, 'name': planet.name, 'gravity': planet.gravity,
                        'temperature': planet.temperature, 'water': planet.water, 'radiation': planet.radiation,
                        'viability': status.get('viability'), 'ownership': owner,
                        'colonization': {**status, 'population': engine.colonization_rules.population, 'cost': engine.colonization_rules.cost},
                    })
                item.update({
                    'id': system.id, 'name': system.name,
                    'star': {'stellar_class': system.star.stellar_class, 'luminosity': system.star.luminosity, 'activity': system.star.activity, **engine.state.stellar_states.get(f'{x}:{y}',{})},
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
    return {"ship_health": (engine.state.universe or {}).get("ship_health",{}), "defenses": engine.state.defenses if engine.state.universe is not None else None, "science": engine.science() if engine.state.universe is not None else None, "research_domains": (engine.state.universe or {}).get("research_domains"), "economic_districts": [d.model_dump() for d in engine.economic_catalog().items['districts'].values()] if engine.state.universe is not None else None, "building_quotes": {k: building_quote(engine.catalog, engine.state, k) for k in engine.catalog.items['districts'] if engine.state.districts.get(k, 0) < 50} if engine.state.universe is not None else {}, "research_work": research_quote(engine.catalog, engine.state, engine.state.research['active'])['work'] if engine.state.universe is not None and engine.state.research['active'] else None, "persistent": engine.state.universe is not None, "empire_levels": (engine.state.universe or {}).get("levels", {}), "campaign": campaign.snapshot(engine), "observed_at": engine.state.last_updated, "system": system.to_dict(), "active_planet": {"id": engine.state.planet_id, "planet_index": engine.state.planet_index, "home": engine.state.planet_id == engine.state.home_planet_id}, "planets": planet_list(engine), "stocks": {key: round(value, 2) for key, value in engine.state.stocks.items()}, "capacities": capacities, "population": {"total": engine.state.population_total, "available": capacities["available_population"], "capacity": (100 + sum(engine.catalog.get("districts", key).population_capacity * level for key, level in engine.state.districts.items())) * (1 + effect(engine.catalog, engine.state, "population"))}, "districts": dict(engine.state.districts), "construction": list(engine.state.construction), "research": dict(engine.state.research), "ships": [dict(ship) for ship in engine.state.ships], "fleets": [{**fleet, "eta": max(0, round(fleet["arrival_at"] - engine.state.last_updated)) if fleet["status"] == "TRANSIT" else 0} for fleet in engine.state.fleets], "notices": engine.state.notices[:5], "travel_modes": [item.model_dump() for _, item in sorted(catalog.items['travel_modes'].items())], "unlocked_content": sorted(unlocked_content(catalog, engine.state.research['completed']))}


def planet_list(engine):
    result = []
    for item in engine.state.planets:
        physical = generate_system(engine.state.seed, item['x'], item['y'], engine.catalog).planets[item['planet_index']]
        result.append({**item, 'name': physical.name, 'stocks': {key: round(value, 2) for key, value in engine.state.stocks_by_planet.get(item['id'], {}).items()}})
    return result


@app.post("/api/build")
def build(request: BuildRequest):
    return action(lambda engine: engine.build(request.id, now=engine.state.last_updated), planet_id=request.planet_id, mutating=True)


@app.post("/api/research")
def research(request: ResearchRequest):
    return action(lambda engine: engine.research(request.id, now=engine.state.last_updated), planet_id=request.planet_id, mutating=True)


@app.post("/api/build-ship")
def build_ship(request: BuildShipRequest = Body(default=BuildShipRequest())):
    return action(lambda engine: engine.build_ship(request.hull_id, request.propulsion_id, request.fuel_id, now=engine.state.last_updated), planet_id=request.planet_id, mutating=True)


@app.post("/api/travel")
def travel(request: TravelRequest):
    if getattr(app.state, 'persistent', False):
        raise HTTPException(400, 'Use o console Universo para missões multi-nave.')
    if request.mission == 'COLONIZE' and request.planet_id is None:
        raise HTTPException(status_code=400, detail='COLONIZE exige planet_id como origem da missão')
    target = (request.target_x, request.target_y, request.target_planet_index) if request.mission == 'COLONIZE' and request.target_planet_index is not None else None
    return action(lambda engine: engine.send_fleet(request.target_x, request.target_y, request.propulsion_id, request.mode, now=engine.state.last_updated, fleet_id=request.fleet_id, ship_id=request.ship_id, mission=request.mission, target_planet_index=request.target_planet_index, planet_id=request.planet_id), planet_id=request.planet_id, colony_target=target, mutating=True)


@app.post("/api/travel-preview")
def travel_preview(request: TravelRequest):
    if getattr(app.state, 'persistent', False):
        raise HTTPException(400, 'As missões multi-nave usam o console Universo.')
    if request.mission == 'COLONIZE' and request.planet_id is None:
        raise HTTPException(status_code=400, detail='COLONIZE exige planet_id como origem da missão')
    def preview(engine):
        catalog.get('travel_modes', request.mode)
        return {mode: engine.preview_travel(request.target_x, request.target_y, request.propulsion_id, mode, fleet_id=request.fleet_id, ship_id=request.ship_id, planet_id=request.planet_id, intra_system=request.mission == 'COLONIZE') for mode in sorted(catalog.items['travel_modes'])}
    return action(preview, planet_id=request.planet_id)


class CampaignOrder(BaseModel):
    action: str = Field(max_length=32)
    planet_id: str | None = None
    target: str | None = Field(default=None, max_length=100)
    ship_id: str | None = None
    ship_ids: list[str] | None = Field(default=None, max_length=12)
    resource: str | None = None
    amount: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    choice: str | None = None
    x: int | None = Field(default=None, ge=-100, le=100)
    y: int | None = Field(default=None, ge=-100, le=100)
    planet_index: int | None = Field(default=None, ge=0)


@app.post('/api/campaign/order')
def campaign_order(request: CampaignOrder):
    return action(lambda e: campaign.order(e, request.action, **request.model_dump(exclude={'action', 'planet_id'})), planet_id=None if request.action in {'end_turn', 'event'} else request.planet_id)


class NewCampaign(BaseModel):
    seed: str = Field(default='STARZ-CONCORDAT', min_length=1, max_length=64)


@app.post('/api/campaign/new')
def new_campaign(request: NewCampaign):
    if not Settings.from_env().campaign:
        raise HTTPException(status_code=400, detail='Use o ambiente experimental isolado.')
    try:
        campaign.initialize(Engine.new(catalog, request.seed, now=0))
    except DataValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    store = Store(app.state.store.database, catalog, request.seed, clock=lambda: 0)
    empire_id = store.bootstrap(now=time(), universe_name='Concordat-' + str(uuid4()))
    store.run(empire_id, campaign.initialize)
    app.state.default_empire_id = empire_id
    return {'started': True}


@app.get('/api/campaign/saves')
def campaign_saves():
    if not Settings.from_env().campaign:
        return []
    with Session(app.state.store.database) as session:
        rows = session.execute(select(Campaign, Universe).join(Empire, Empire.id == Campaign.empire_id).join(Universe, Universe.id == Empire.universe_id).order_by(Campaign.selected_at.desc())).all()
        return [{'id': str(c.empire_id), 'seed': u.seed, 'turn': c.payload['turn'], 'phase': c.payload['phase'], 'active': c.empire_id == app.state.default_empire_id} for c, u in rows]


class LoadCampaign(BaseModel):
    empire_id: UUID


@app.post('/api/campaign/load')
def load_campaign(request: LoadCampaign):
    if not Settings.from_env().campaign:
        raise HTTPException(status_code=400, detail='Use o ambiente experimental isolado.')
    with Session(app.state.store.database) as session, session.begin():
        saved = session.get(Campaign, request.empire_id)
        if saved is None:
            raise HTTPException(status_code=404, detail='Partida inexistente.')
        saved.selected_at = func.now()
    app.state.default_empire_id = request.empire_id
    return {'loaded': True}
