from pathlib import Path
import sys
import argparse

sys.path.insert(0, str(Path(__file__).parents[1]))
from starz.data import Catalog


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--campaign", action="store_true", help="validate the experimental overlay")
    args = parser.parse_args()
    root = Path(__file__).parents[1]
    catalog = Catalog.load(root / "game_data", root / "campaign_data" if args.campaign else None)
    print("validated", sum(len(items) for items in catalog.items.values()), "content items")
