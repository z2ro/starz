from __future__ import annotations

from pathlib import Path
import time

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .data import Catalog, DataValidationError
from .simulation import Engine, load_or_create, save

ROOT = Path(__file__).resolve().parent.parent
catalog = Catalog.load(ROOT / "game_data")
engine = load_or_create(catalog, ROOT / "state.json")
# ponytail: single-process state is enough for the local slice; add DB transactions before multi-user deployment.
app = FastAPI(title="StarZ", version="0.1.0")
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


def action(call):
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
    engine.advance()
    save(engine, ROOT / "state.json")
    system = engine.system()
    capacities = engine.capacities()
    return {"system": system.to_dict(), "stocks": {key: round(value, 2) for key, value in engine.state.stocks.items()}, "capacities": {key: round(value, 2) for key, value in capacities.items() if key in {"energy_generation", "energy_consumption", "industrial"}}, "population": {"total": engine.state.population_total, "available": capacities["available_population"], "capacity": 100 + sum(engine.catalog.get("districts", key).population_capacity * level for key, level in engine.state.districts.items())}, "districts": engine.state.districts, "construction": engine.state.construction, "research": engine.state.research, "fleets": [{**fleet, "eta": max(0, round(fleet["arrival_at"] - time.time())) if fleet["status"] == "TRANSIT" else 0} for fleet in engine.state.fleets], "notices": engine.state.notices[:5]}


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
    return action(lambda: engine.send_fleet(request.target_x, request.target_y, request.propulsion_id, request.mode))


@app.post("/api/travel-preview")
def travel_preview(request: TravelRequest):
    engine.advance()
    return {mode: engine.preview_travel(request.target_x, request.target_y, request.propulsion_id, mode) for mode in ("ECONOMY", "NORMAL", "FORCED")}
