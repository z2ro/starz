"""Clean installation and existing-universe upgrade in disposable PostgreSQL."""
import os
import unittest
from uuid import uuid4

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from starz.db import models as m
from starz.db.store import utc


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'), 'disposable PostgreSQL required')
class OrderMigrationHistory(unittest.TestCase):
    def setUp(self):
        self.db = create_engine(os.environ['PERSISTENT_TEST_DATABASE_URL'])
        self.addCleanup(self.db.dispose)
        self.assertEqual(inspect(self.db).get_table_names(), [], 'test requires an empty disposable database')

    def migrate(self, revision):
        config = Config('alembic.ini')
        with self.db.begin() as connection:
            config.attributes['connection'] = connection
            command.upgrade(config, revision)

    def check_schema(self):
        config = Config('alembic.ini')
        with self.db.begin() as connection:
            config.attributes['connection'] = connection
            command.check(config)
            inspector = inspect(connection)
            fk = next(f for f in inspector.get_foreign_keys('universe_order')
                      if f['name'] == 'fk_universe_order_empire_universe')
            self.assertEqual(fk['constrained_columns'], ['empire_id', 'universe_id'])
            self.assertEqual((fk['referred_table'], fk['referred_columns']), ('empire', ['id', 'universe_id']))
            self.assertTrue(any(u['column_names'] == ['id', 'universe_id']
                                for u in inspector.get_unique_constraints('empire')))
            self.assertTrue(connection.scalar(text("SELECT convalidated FROM pg_constraint WHERE conname = 'fk_universe_order_empire_universe' AND conrelid = 'universe_order'::regclass")))

    def populate(self):
        pairs = []
        with Session(self.db) as session, session.begin():
            for index in range(2):
                universe_id, system_id, empire_id = uuid4(), uuid4(), uuid4()
                session.add(m.Universe(id=universe_id, name='migration-' + uuid4().hex,
                                       seed='synthetic', created_at=utc(1000)))
                session.flush()
                session.add(m.StarSystem(id=system_id, universe_id=universe_id, x=0, y=0, created_at=utc(1000)))
                session.flush()
                session.add(m.Empire(id=empire_id, universe_id=universe_id, home_system_id=system_id,
                                     name='test-' + uuid4().hex, created_at=utc(1000), last_updated=utc(1000)))
                session.flush()
                session.add(m.UniverseOrder(id=uuid4(), universe_id=universe_id, empire_id=empire_id,
                            kind='migration_test', payload={'index': index}, due_at=utc(1500 + index),
                            resolved=bool(index)))
                pairs.append((universe_id, empire_id))
        return pairs

    def orders(self):
        with self.db.connect() as connection:
            return sorted((tuple(row) for row in connection.execute(select(m.UniverseOrder.__table__))), key=repr)

    def reject_crossed_order(self, pairs):
        with self.assertRaises(IntegrityError):
            with Session(self.db) as session, session.begin():
                session.add(m.UniverseOrder(id=uuid4(), universe_id=pairs[1][0], empire_id=pairs[0][1],
                                           kind='migration_test', payload={}, resolved=False))
                session.flush()

    def test_clean_install_to_head(self):
        self.migrate('head')
        self.check_schema()
        pairs = self.populate()
        before = self.orders()
        self.assertEqual(len(before), 2)
        self.reject_crossed_order(pairs)
        self.assertEqual(self.orders(), before)

    def test_incremental_upgrade_preserves_two_universes(self):
        self.migrate('d06f00000001')
        pairs = self.populate()
        before = self.orders()
        self.assertEqual(len(before), 2)
        self.migrate('head')
        self.check_schema()
        self.assertEqual(self.orders(), before)
        self.reject_crossed_order(pairs)
        self.assertEqual(self.orders(), before)
        with Session(self.db) as session, session.begin():
            session.add(m.UniverseOrder(id=uuid4(), universe_id=pairs[0][0], empire_id=pairs[0][1],
                                       kind='migration_test', payload={'after': True}, resolved=False))
        self.assertEqual(len(self.orders()), 3)
