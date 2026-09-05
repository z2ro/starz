from __future__ import annotations

from pathlib import Path
from threading import RLock

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .data import Catalog, DataValidationError
from .simulation import load_or_create, save
from .effects import unlocked_content

ROOT = Path(__file__).resolve().parent.parent
catalog = Catalog.load(ROOT / "game_data")
engine = load_or_create(catalog, ROOT / "state.json")
# ponytail: single-process state is enough for the local slice; add DB transactions before multi-user deployment.
app = FastAPI(title="StarZ", version="0.1.0")
state_lock = RLock()
app.mount("/static", StaticFiles(directory=ROOT / "frontend"), name="static")


class BuildRequest(BaseModel):
    id: str


class ResearchRequest(BaseModel):
    id: str


class TravelRequest(BaseModel):
    target_x: int = Field(ge=-100, le=100)
    target_y: int = Field(ge=-100, le=100)
    propulsion_id: str
    mode: str
    fleet_id: str | None = None
    ship_id: str | None = None


def action(call):
    with state_lock:
        try:
            result = call()
            save(engine, ROOT / "state.json")
            return result
        except DataValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
def index():
    return FileResponse(ROOT / "frontend" / "index.html")


@app.get("/api/state")
def state():
    return action(state_snapshot)


def state_snapshot():
    engine.advance()
    system = engine.system()
    capacities = engine.capacities()
    return {"system": system.to_dict(), "stocks": {key: round(value, 2) for key, value in engine.state.stocks.items()}, "capacities": capacities, "population": {"total": engine.state.population_total, "available": capacities["available_population"], "capacity": 100 + sum(engine.catalog.get("districts", key).population_capacity * level for key, level in engine.state.districts.items())}, "districts": dict(engine.state.districts), "construction": list(engine.state.construction), "research": dict(engine.state.research), "ships": [dict(ship) for ship in engine.state.ships], "fleets": [{**fleet, "eta": max(0, round(fleet["arrival_at"] - engine.state.last_updated)) if fleet["status"] == "TRANSIT" else 0} for fleet in engine.state.fleets], "notices": engine.state.notices[:5], "travel_modes": [item.model_dump() for _, item in sorted(catalog.items['travel_modes'].items())], "unlocked_content": sorted(unlocked_content(catalog, engine.state.research['completed']))}


@app.post("/api/build")
def build(request: BuildRequest):
    return action(lambda: engine.build(request.id))


@app.post("/api/research")
def research(request: ResearchRequest):
    return action(lambda: engine.research(request.id))


@app.post("/api/build-ship")
def build_ship():
    return action(lambda: engine.build_ship())


@app.post("/api/travel")
def travel(request: TravelRequest):
    return action(lambda: engine.send_fleet(request.target_x, request.target_y, request.propulsion_id, request.mode, fleet_id=request.fleet_id, ship_id=request.ship_id))


@app.post("/api/travel-preview")
def travel_preview(request: TravelRequest):
    def preview():
        engine.advance()
        catalog.get('travel_modes', request.mode)
        return {mode: engine.preview_travel(request.target_x, request.target_y, request.propulsion_id, mode, fleet_id=request.fleet_id, ship_id=request.ship_id) for mode in sorted(catalog.items['travel_modes'])}
    return action(preview)
