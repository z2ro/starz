"""Research 3.0 catalog and executable progression contracts; no database required."""
import unittest
from graphlib import TopologicalSorter

import test_research_domains as research_domains
from starz.data import Catalog, DataValidationError
from starz.progression import research_quote

LEGACY_IDS = {'advanced_manufacturing',
 'armor',
 'astrophysics',
 'capital_architecture',
 'carrier_operations',
 'civil_tier_2',
 'civil_tier_3',
 'civil_tier_4',
 'civil_tier_5',
 'computing',
 'construction_engineering',
 'counter_intelligence',
 'diplomatic_charter',
 'energy_engineering',
 'expedition_science',
 'extraction',
 'fuel_efficiency',
 'fundamental_tier_2',
 'fundamental_tier_3',
 'fundamental_tier_4',
 'fundamental_tier_5',
 'habitation',
 'industrial_automation',
 'infrastructure',
 'intelligence',
 'logistics',
 'maintenance',
 'metallurgy',
 'military_tier_2',
 'military_tier_3',
 'military_tier_4',
 'military_tier_5',
 'naval_doctrine',
 'navigation',
 'nuclear_propulsion',
 'orbital_engineering',
 'recruitment',
 'science_infrastructure',
 'sensor_array',
 'shields',
 'stellar_containment',
 'storage',
 'survey_network',
 'weapons'}

HULL_REQUIREMENTS = {'aegis_hull': ['orbital_shipyard', 'nuclear_propulsion', 'military_tier_3'],
 'atlas_hull': ['orbital_shipyard', 'nuclear_propulsion', 'military_tier_5'],
 'dominion_hull': ['orbital_shipyard', 'nuclear_propulsion', 'military_tier_5'],
 'leviathan_hull': ['orbital_shipyard', 'nuclear_propulsion', 'military_tier_4'],
 'odyssey_hull': ['orbital_shipyard', 'nuclear_propulsion', 'fundamental_tier_3'],
 'scout_hull': ['orbital_shipyard'],
 'sentinel_hull': ['orbital_shipyard', 'nuclear_propulsion', 'military_tier_2'],
 'spearhead_hull': ['orbital_shipyard', 'nuclear_propulsion', 'military_tier_4'],
 'vanguard_hull': ['orbital_shipyard', 'orbital_engineering', 'military_tier_2'],
 'wayfarer_hull': ['orbital_shipyard', 'orbital_engineering']}

DISCOVERIES = {
    'automated_logistics': ('Logística Automatizada', 'civil', 3, {'logistics': 3, 'industrial_automation': 1}),
    'megastructure_engineering': ('Engenharia de Megaestruturas', 'civil', 4, {'advanced_manufacturing': 2, 'orbital_engineering': 3}),
    'precision_manufacturing': ('Manufatura de Precisão Extrema', 'civil', 5, {'megastructure_engineering': 1, 'advanced_manufacturing': 3}),
    'stellar_logistics': ('Logística Estelar', 'civil', 5, {'automated_logistics': 1, 'megastructure_engineering': 1, 'logistics': 3}),
    'fire_control_doctrine': ('Doutrina de Controle de Tiro', 'military', 2, {'weapons': 2, 'naval_doctrine': 2}),
    'fleet_coordination': ('Coordenação de Frotas', 'military', 3, {'naval_doctrine': 3, 'computing': 2}),
    'electronic_warfare': ('Guerra Eletrônica', 'military', 3, {'sensor_array': 2, 'computing': 2}),
    'spatial_interdiction': ('Interdição Espacial', 'military', 4, {'electronic_warfare': 1, 'gravitational_physics': 1}),
    'shield_disruption': ('Ruptura de Escudos', 'military', 4, {'weapons': 3, 'shields': 2}),
    'containment_warfare': ('Guerra de Contenção', 'military', 4, {'shield_disruption': 1, 'gravitational_physics': 1, 'sensor_array': 3}),
    'stellar_armaments': ('Armamentos Estelares', 'military', 5, {'capital_architecture': 2, 'mobile_stellar_confinement': 1, 'weapons': 4}),
    'gravitational_physics': ('Física Gravitacional Avançada', 'fundamental', 4, {'navigation': 2, 'sensor_array': 2}),
    'extreme_materials': ('Materiais Extremos', 'fundamental', 4, {'metallurgy': 3, 'energy_engineering': 3}),
    'stellar_extraction': ('Extração Estelar', 'fundamental', 5, {'gravitational_physics': 1, 'megastructure_engineering': 1, 'science_infrastructure': 2}),
    'mobile_stellar_confinement': ('Confinamento Estelar Móvel', 'fundamental', 5, {'stellar_extraction': 1, 'extreme_materials': 1, 'stellar_containment': 3}),
    'gravitational_propulsion': ('Propulsão Gravitacional', 'fundamental', 5, {'gravitational_physics': 1, 'extreme_materials': 1, 'nuclear_propulsion': 3}),
}


class Research3(unittest.TestCase):
    engine = research_domains.ResearchDomains.engine

    @classmethod
    def setUpClass(cls):
        cls.catalog = Catalog.load('game_data', 'persistent_data')

    def prepared_engine(self):
        e = self.engine()
        e.state.population_total = 1000
        e.state.districts.update(research_lab=15, civil_lab=1, military_lab=1,
                                fundamental_lab=1, solar_field=100, orbital_shipyard=10, processor=2)
        return e

    def complete_available(self, e, technologies):
        goals = {t.id: 5 if t.kind == 'repeatable' else 1 for t in technologies}
        for _ in range(sum(goals.values())):
            available = [key for key, goal in goals.items()
                         if e.state.universe['levels'].get(key, 0) < goal
                         and not research_quote(self.catalog, e.state, key)['requirements']]
            if not available:
                break
            key = available[0]
            quote = research_quote(self.catalog, e.state, key)
            before = dict(e.state.stocks)
            job = e.research(key, now=e.state.last_updated)
            for resource, cost in quote['cost'].items():
                self.assertEqual(e.state.stocks[resource], before[resource] - cost)
            self.assertEqual(job['remaining_work'], quote['work'])
            self.assertGreater(job['remaining_work'], 0)
            self.assertGreater(job['complete_at'], e.state.last_updated)
            e.advance(job['complete_at'] + 0.01)

    def test_catalog_preserves_44_ids_and_10_hull_requirements(self):
        self.assertEqual(len(LEGACY_IDS), 44)
        self.assertEqual(set(self.catalog.items['technologies']), LEGACY_IDS | DISCOVERIES.keys())
        self.assertEqual(len(self.catalog.items['technologies']), 60)
        self.assertEqual(len(self.catalog.items['ships']), 10)
        self.assertEqual({h.id: h.requires for h in self.catalog.items['ships'].values()},
                         HULL_REQUIREMENTS)

    def test_exact_discoveries_and_experimental_paid_work(self):
        for key, (name, domain, tier, dependencies) in DISCOVERIES.items():
            with self.subTest(technology=key):
                t = self.catalog.get('technologies', key)
                self.assertEqual((t.name, t.domain, t.tier, t.kind),
                                 (name, domain, tier, 'breakthrough'))
                self.assertEqual(set(t.requires), set(dependencies))
                self.assertEqual(t.level_requires,
                                 {k: v for k, v in dependencies.items() if v > 1})
                self.assertIsNone(t.advances_tier)
                self.assertEqual(t.effects, {})
                self.assertEqual(t.unlocks, [])
                advancement = self.catalog.get('technologies', f'{domain}_tier_{tier}')
                self.assertEqual((t.cost, t.duration), (advancement.cost, advancement.duration))
                self.assertTrue(t.cost)
                self.assertTrue(all(value > 0 for value in t.cost.values()))
                self.assertGreater(t.duration, 0)
                self.assertIn('EXPERIMENTAIS', t.description)
                self.assertIn('valores finais não aprovados', t.description)
                self.assertIn('implementação posterior', t.description)

    def test_dependency_graph_including_implicit_tiers_has_no_cycle(self):
        graph = {}
        technologies = self.catalog.items['technologies']
        for t in technologies.values():
            dependencies = (set(t.requires) | set(t.level_requires)) & technologies.keys()
            if t.tier > 1 and not t.advances_tier:
                dependencies.add(f'{t.domain}_tier_{t.tier}')
            graph[t.id] = dependencies
        self.assertEqual(set(TopologicalSorter(graph).static_order()), set(technologies))

    def test_all_discoveries_execute_and_complete_only_once(self):
        e = self.prepared_engine()
        self.complete_available(e, self.catalog.items['technologies'].values())
        for key in DISCOVERIES:
            with self.subTest(technology=key):
                self.assertEqual(e.state.universe['levels'].get(key), 1)
                self.assertEqual(e.state.research['completed'].count(key), 1)
                before = dict(e.state.stocks)
                with self.assertRaisesRegex(DataValidationError, 'Projeto único já concluído'):
                    e.research(key, now=e.state.last_updated)
                self.assertEqual(e.state.stocks, before)
        levels = dict(e.state.universe['levels'])
        e.advance(e.state.last_updated + 1000)
        self.assertEqual(e.state.universe['levels'], levels)
        for key in DISCOVERIES:
            self.assertEqual(e.state.research['completed'].count(key), 1)

    def test_fundamental_v_and_containment_execute_without_military_research(self):
        e = self.prepared_engine()
        self.complete_available(e, [t for t in self.catalog.items['technologies'].values()
                                    if t.domain != 'military'])
        self.assertEqual(e.state.universe['levels'].get('fundamental_tier_5'), 1)
        self.assertGreaterEqual(e.state.universe['levels'].get('stellar_containment', 0), 3)
        self.assertNotIn('military_tier_4', e.state.universe['levels'])
        self.assertNotIn('carrier_operations', e.state.universe['levels'])
        gate = self.catalog.get('technologies', 'fundamental_tier_5')
        self.assertEqual(gate.requires, ['fundamental_tier_4', 'energy_engineering'])
        self.assertEqual(gate.level_requires, {'energy_engineering': 4, 'science_infrastructure': 2})
        containment = self.catalog.get('technologies', 'stellar_containment')
        self.assertEqual(containment.requires, ['science_infrastructure'])
        self.assertEqual(containment.level_requires, {'science_infrastructure': 3})

    def test_tier_iv_countermeasures_do_not_require_stellar_projects(self):
        for key in ('spatial_interdiction', 'containment_warfare'):
            t = self.catalog.get('technologies', key)
            self.assertEqual(t.tier, 4)
            pending, seen = [key], set()
            while pending:
                current = pending.pop()
                if current in seen:
                    continue
                seen.add(current)
                node = self.catalog.get('technologies', current)
                pending.extend(node.requires)
                pending.extend(node.level_requires)
                if node.tier > 1 and not node.advances_tier:
                    pending.append(f'{node.domain}_tier_{node.tier}')
            self.assertTrue(seen.isdisjoint({'stellar_extraction', 'mobile_stellar_confinement',
                                             'stellar_armaments'}))
