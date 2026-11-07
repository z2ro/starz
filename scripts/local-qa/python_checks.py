"""Local QA adapter: existing unittest cases, no inherited database configuration."""
import argparse
import inspect
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
DB_CLASSES = set(json.loads((ROOT / 'scripts/local-qa/dependencies.json').read_text())['databaseClasses'])

def cases(suite):
    for item in suite:
        if isinstance(item, unittest.TestSuite):
            yield from cases(item)
        else:
            yield item

def database_case(test):
    cls = type(test)
    if 'tests.' + cls.__module__.removeprefix('tests.') + '.' + cls.__name__ in DB_CLASSES:
        return True
    # Fail broad for new DB-backed TestCases instead of silently omitting them.
    for base in cls.__mro__:
        if base.__module__.startswith(('tests.', 'test_')):
            try:
                if re.search(r'test_database_url|TEST_DATABASE_URL|create_engine\(', inspect.getsource(base)):
                    return True
            except (OSError, TypeError):
                return True
    return False

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('kind', choices=['unit', 'db', 'content'])
    parser.add_argument('report')
    args = parser.parse_args()
    if args.kind == 'content':
        from starz.data import Catalog
        for overlay in [None, 'campaign_data', 'persistent_data']:
            c = Catalog.load('game_data', overlay) if overlay else Catalog.load('game_data')
            print('Validated content:', overlay or 'base', sum(len(v) for v in c.items.values()))
        data = {'passed': 0, 'checks': 3, 'failed': 0, 'skipped': 0, 'names': []}
        Path(args.report).write_text(json.dumps(data))
    else:
        discovered = list(cases(unittest.defaultTestLoader.discover(str(ROOT / 'tests'), pattern='test_*.py', top_level_dir=str(ROOT / 'tests'))))
        selected = [t for t in discovered if database_case(t) == (args.kind == 'db')]
        if not selected:
            raise SystemExit('No matching unittest cases; inspect the dependency map.')
        result = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite(selected))
        failed = len(result.failures) + len(result.errors)
        # Messages/tracebacks belong to the sanitized full log, not the JSON index.
        data = {'passed': result.testsRun - failed - len(result.skipped), 'checks': 0, 'failed': failed, 'skipped': len(result.skipped), 'names': [t.id() for t, _ in result.failures + result.errors]}
        if args.kind == 'db' and result.skipped:
            data['failed'] += len(result.skipped)
            data['names'] += [t.id() + ' (unexpected DB skip)' for t, _ in result.skipped]
        Path(args.report).write_text(json.dumps(data))
        sys.exit(1 if data['failed'] else 0)
