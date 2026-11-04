"""Focused campaign rules; no GPU or fake React gameplay."""
import copy
import unittest
from pathlib import Path
from starz.data import Catalog, DataValidationError
from starz.simulation import Engine
from starz import campaign

ROOT = Path(__file__).parents[1]


def fresh():
    catalog = Catalog.load(ROOT / 'game_data', ROOT / 'campaign_data')
    e = Engine.new(catalog, seed='STARZ-CONCORDAT', now=1000)
    e.state.planet_id = e.state.home_planet_id = 'home'
    e.state.home_system_x, e.state.home_system_y = e.state.system_x, e.state.system_y
    e.state.planets = [dict(id='home', x=e.state.system_x, y=e.state.system_y, planet_index=0, home=True, population_total=100)]
    e.state.stocks_by_planet = {'home': e.state.stocks}
    campaign.initialize(e)
    return e


class CampaignRules(unittest.TestCase):
    def test_seed_content_and_turns_are_deterministic(self):
        a, b = fresh(), fresh()
        self.assertEqual(a.state.campaign, b.state.campaign)
        for _ in range(10):
            for e in (a, b):
                if e.state.campaign['event']: campaign.choose_event(e, e.state.campaign['event']['choices'][0])
                campaign.next_turn(e)
        self.assertEqual(a.state.to_dict(), b.state.to_dict())
        self.assertEqual(a.state.last_updated, 4000)
        self.assertGreater(a.state.campaign['rivals'][0]['industry'], 2)

    def test_budget_research_and_terminal_lock(self):
        e = fresh()
        campaign.command(e, lambda game: game.research('orbital_engineering', now=game.state.last_updated))
        self.assertEqual(e.state.campaign['orders'], 3)
        campaign.next_turn(e)
        self.assertIn('orbital_engineering', e.state.research['completed'])
        e.state.campaign['orders'] = 0
        with self.assertRaises(DataValidationError): campaign.command(e, lambda _: None)
        e.state.campaign['phase'] = 'DEFEAT'
        with self.assertRaises(DataValidationError): campaign.next_turn(e)

    def test_deadline_and_idle_raids_reach_defeat(self):
        e = fresh()
        while e.state.campaign['phase'] == 'PLAYING':
            if e.state.campaign['event']: campaign.choose_event(e, e.state.campaign['event']['choices'][-1])
            campaign.next_turn(e)
        self.assertEqual(e.state.campaign['phase'], 'DEFEAT')
        self.assertLessEqual(e.state.campaign['turn'], 60)

    def test_no_fake_victory_or_remote_combat(self):
        e = fresh()
        before = copy.deepcopy(e.state.campaign)
        with self.assertRaises(DataValidationError): campaign.order(e, 'project')
        self.assertEqual(e.state.campaign, before)
        with self.assertRaises(DataValidationError): campaign.order(e, 'attack', target='helion', ship_ids=['invented'])

    def test_roles_and_carrier_power_are_real(self):
        e = fresh()
        atlas = e.catalog.get('ships', 'atlas_hull')
        self.assertEqual(atlas.carrier_capacity, 10)
        self.assertGreater(atlas.cargo_capacity, 0)
        self.assertGreater(e.catalog.get('ships', 'odyssey_hull').science_bonus, 0)
        self.assertGreater(e.catalog.get('ships', 'dominion_hull').combat_power, atlas.combat_power)

    def test_battle_uses_arrived_ships_and_removes_real_casualties(self):
        for design, expected in [('vanguard_hull', True), ('scout_hull', False)]:
            with self.subTest(design=design):
                e = fresh()
                e.state.research['completed'] = list(e.catalog.items['technologies'])
                e.state.districts['orbital_shipyard'] = 1
                e.state.stocks.update(refined_alloy=1000, components=1000, ion_fuel=1000)
                ship = e.build_ship(design, now=e.state.last_updated)
                e.advance(ship['ready_at'])
                r = e.state.campaign['rivals'][0]
                e.state.system_knowledge[f"{r['x']}:{r['y']}"] = e.state.last_updated
                campaign.order(e, 'dispatch', ship_id=ship['id'], x=r['x'], y=r['y'])
                with self.assertRaises(DataValidationError): campaign.order(e, 'attack', target=r['id'], ship_ids=[ship['id']])
                campaign.next_turn(e)
                result = campaign.order(e, 'attack', target=r['id'], ship_ids=[ship['id']])
                self.assertEqual(result['victory'], expected)
                self.assertEqual(r['conquered'], expected)
                self.assertEqual(bool(e.state.ships), expected)
                self.assertEqual(bool(e.state.fleets), expected)

    def test_decommission_recovers_materials_without_destroying_lifeline(self):
        e = fresh(); before = e.state.stocks['refined_alloy']
        e.state.districts['processor'] = 1
        campaign.order(e, 'decommission', target='processor')
        self.assertEqual(e.state.districts['processor'], 0)
        self.assertEqual(e.state.stocks['refined_alloy'], before + 11)
        with self.assertRaises(DataValidationError): campaign.order(e, 'decommission', target='civil_district')
