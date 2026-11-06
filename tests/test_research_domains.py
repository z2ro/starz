"""Critical research progression without GPU or simulated UI bonuses."""
import copy
import unittest
from starz.data import Catalog, DataValidationError
from starz.simulation import Engine
from starz.progression import research_quote, effect, migrate_research, DOMAINS

class ResearchDomains(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.catalog=Catalog.load('game_data','persistent_data')
    def engine(self):
        e=Engine.new(self.catalog,now=1000);e.state.universe={'levels':{'orbital_engineering':1}};e.state.research['completed']=['orbital_engineering'];e.state.research['completed_at']={'orbital_engineering':1000}
        e.state.stocks.update(refined_alloy=1000000,components=1000000,ion_fuel=1000000,fusion_fuel=1000000);return e
    def finish(self,e,id):
        e.research(id,now=e.state.last_updated);end=e.state.universe['research_domains'][self.catalog.get('technologies',id).domain]['complete_at'];e.advance(end+0.01)
    def test_parallel_domains_spend_once_and_complete_idempotently(self):
        e=self.engine();before=e.state.stocks['components'];e.research('energy_engineering',now=1000);e.research('extraction',now=1000);e.research('naval_doctrine',now=1000)
        self.assertEqual(sum(bool(j['active']) for j in e.research_jobs()),3)
        spent=e.state.stocks['components'];self.assertLess(spent,before)
        with self.assertRaises(DataValidationError):e.research('computing',now=1000)
        self.assertEqual(e.state.stocks['components'],spent);e.advance(5000);levels=copy.deepcopy(e.state.universe['levels']);e.advance(5000);self.assertEqual(e.state.universe['levels'],levels)
        for key in ['energy_engineering','extraction','naval_doctrine']:self.assertEqual(levels[key],1)
    def test_tier_capacity_project_and_building_unlocks(self):
        e=self.engine();self.assertTrue(research_quote(self.catalog,e.state,'industrial_automation')['requirements'])
        self.finish(e,'construction_engineering')
        with self.assertRaisesRegex(DataValidationError,'Capacidade'):e.research('civil_tier_2',now=e.state.last_updated)
        # Build the real specialized facility; general levels are test preconditions.
        e.state.population_total=500;e.state.districts.update(solar_field=20,research_lab=2)
        job=e.build('civil_lab',now=e.state.last_updated);e.advance(job['complete_at'])
        self.finish(e,'civil_tier_2');self.assertFalse(research_quote(self.catalog,e.state,'civil_tier_2')['level']==0)
        with self.assertRaises(DataValidationError):e.research('civil_tier_2',now=e.state.last_updated)
        self.finish(e,'extraction');self.finish(e,'extraction');self.finish(e,'industrial_automation')
        self.assertIn('manufacturing',__import__('starz.effects',fromlist=['unlocked_content']).unlocked_content(self.catalog,e.state.research['completed']))
        e.build('manufacturing',now=e.state.last_updated)
    def test_milestones_and_transparent_quote_use_same_effects(self):
        e=self.engine();e.state.universe['levels']['extraction']=2
        q=research_quote(self.catalog,e.state,'extraction');e.state.universe['levels']['extraction']=3
        self.assertAlmostEqual(q['effects']['mining']['next'],effect(self.catalog,e.state,'mining'))
    def test_legacy_work_and_levels_migrate_without_reset(self):
        e=self.engine();e.state.universe['levels']['carrier_operations']=4;e.state.research.update(active='energy_engineering',remaining_work=17,complete_at=1017)
        migrate_research(self.catalog,e.state);job=e.state.universe['research_domains']['fundamental'];self.assertEqual(job['remaining_work'],17);self.assertTrue(job['legacy_rate']);self.assertEqual(e.state.universe['levels']['military_tier_5'],1)
        before=copy.deepcopy(e.state.universe);migrate_research(self.catalog,e.state);self.assertEqual(before,e.state.universe);e.advance(1017);self.assertEqual(e.state.universe['levels']['energy_engineering'],1)
    def test_paid_legacy_advanced_project_keeps_its_tier_unlock_when_finished(self):
        e=self.engine();e.state.research.update(active='carrier_operations',remaining_work=17,complete_at=1017)
        e.advance(1017)
        self.assertEqual(e.state.universe['levels']['carrier_operations'],1)
        self.assertEqual(e.state.universe['levels']['military_tier_5'],1)
        self.assertIn('military_tier_5',e.state.research['completed'])

    def test_all_tiers_reachable_without_cycles_and_ship_unlocks_real(self):
        e=self.engine();e.state.population_total=1000;e.state.districts.update(research_lab=15,civil_lab=1,military_lab=1,fundamental_lab=1,solar_field=100,orbital_shipyard=10)
        pending={t.id:5 if t.kind=='repeatable' else 1 for t in self.catalog.items['technologies'].values()}
        for _ in range(300):
            available=[key for key,goal in pending.items() if e.state.universe['levels'].get(key,0)<goal and not research_quote(self.catalog,e.state,key)['requirements']]
            if not available:break
            self.finish(e,available[0])
        for domain in DOMAINS:self.assertEqual(e.state.universe['levels'].get(f'{domain}_tier_5'),1)
        for hull in self.catalog.items['ships'].values():e.build_ship(hull.id,hull.compatible_propulsion[0],self.catalog.get('propulsion',hull.compatible_propulsion[0]).compatible_fuels[0],now=e.state.last_updated);e.advance(e.state.last_updated+10000)
        self.assertEqual(len(e.state.ships),10)
