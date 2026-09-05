"""Legacy JSON round trips used ONLY by domain regression fixtures."""
import json
from pathlib import Path

from starz.simulation import Engine, GameState


def load_or_create(catalog, path):
    return Engine(catalog, GameState.from_dict(json.loads(Path(path).read_text())))


def save(engine, path):
    Path(path).write_text(json.dumps(engine.state.to_dict()))
