"""Environment is read here, never in the simulation or mapper."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    database_url: str
    universe_seed: str
    test_database_url: str | None

    @classmethod
    def from_env(cls):
        return cls(
            database_url=os.environ.get('DATABASE_URL', ''),
            universe_seed=os.environ.get('STARZ_UNIVERSE_SEED', 'STARZ-ALPHA'),
            test_database_url=os.environ.get('TEST_DATABASE_URL'),
        )
