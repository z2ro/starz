"""Critical SQL casualty cleanup and campaign reload in an isolated experimental schema."""
import os
import unittest
from pathlib import Path
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, func, text
from sqlalchemy.orm import Session
from starz.data import Catalog
from starz.db import models as m
from starz.db.store import Store, load
from starz import campaign


@unittest.skipUnless(os.getenv('CAMPAIGN_TEST_DATABASE_URL'), 'experimental DB URL required')
class CampaignDatabase(unittest.TestCase):
    def test_migration_combat_casualty_and_reload(self):
        url = os.environ['CAMPAIGN_TEST_DATABASE_URL']; schema = 'campaign_test_' + uuid4().hex
        admin = create_engine(url)
        with admin.begin() as conn: conn.execute(text('CREATE SCHEMA ' + schema))
        db = create_engine(url, connect_args={'options': '-csearch_path=' + schema})
        try:
            cfg = Config('alembic.ini')
            with db.begin() as conn:
                cfg.attributes['connection'] = conn; command.upgrade(cfg, 'head'); command.check(cfg)
            catalog = Catalog.load(Path(__file__).parents[1] / 'game_data', Path(__file__).parents[1] / 'campaign_data')
            store = Store(db, catalog, clock=lambda: 0); empire_id = store.bootstrap(now=1000)
            def prepare(e):
                campaign.initialize(e)
                e.state.research['completed'] = ['orbital_engineering']
                e.state.research['completed_at'] = {'orbital_engineering': 1000}
                e.state.districts['orbital_shipyard'] = 1
            store.run(empire_id, prepare)
            ship = store.run(empire_id, lambda e: e.build_ship(now=e.state.last_updated))
            ship_id = ship['id']
            def depart(e):
                r = e.state.campaign['rivals'][0]
                e.state.system_knowledge[f"{r['x']}:{r['y']}"] = e.state.last_updated
                campaign.order(e, 'dispatch', ship_id=ship_id, x=r['x'], y=r['y'])
            store.run(empire_id, depart, now=ship['ready_at'])
            store.run(empire_id, campaign.next_turn)
            def battle(e):
                result = campaign.order(e, 'attack', target='helion', ship_ids=[ship_id])
                self.assertFalse(result['victory'])
            store.run(empire_id, battle)
            with Session(db) as session:
                state = load(session, session.get(m.Empire, empire_id), catalog=catalog)
                self.assertEqual(state.ships, []); self.assertEqual(state.fleets, [])
                self.assertEqual(session.scalar(select(func.count()).select_from(m.FleetShip)), 0)
                self.assertEqual(state.campaign['turn'], 1)
                self.assertTrue(any('Perdida:' in row['message'] for row in state.campaign['log']))
        finally:
            db.dispose()
            with admin.begin() as conn: conn.execute(text('DROP SCHEMA ' + schema + ' CASCADE'))
            admin.dispose()
