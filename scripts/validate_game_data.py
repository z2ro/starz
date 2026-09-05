from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parents[1]))
from starz.data import Catalog


if __name__ == "__main__":
    catalog = Catalog.load(Path(__file__).parents[1] / "game_data")
    print("validated", sum(len(items) for items in catalog.items.values()), "content items")
