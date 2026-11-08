"""New observations use physical local EW; historical private reports are immutable."""
import copy
import unittest
from starz.data import DataValidationError
from starz.defenses import set_platform_mode, validate_defenses
from starz.persistent.intelligence import gather_intelligence
import test_planetary_defense as fixtures


class ElectronicIntelligence(unittest.TestCase):
    def setUp(self):
        self.fixture=fixtures.DefenseRules();self.fixture.setUpClass()
        self.a,self.b=self.fixture.engine(),self.fixture.engine()
        self.a.state.universe['levels']={'sensor_array':2,'computing':2,'intelligence':5}
        self.b.state.universe['levels']={'sensor_array':3,'computing':3,'electronic_warfare':1}
        self.probes=[self.fixture.ship(self.a,'scout_hull')]

    def test_B12_new_observation_degraded_only_with_local_living_odyssey(self):
        original=gather_intelligence(self.a,self.b,self.probes,'ESPIONAGE')
        snapshot=copy.deepcopy(original)
        ship=self.fixture.ship(self.b,'odyssey_hull','emitter')
        observed=gather_intelligence(self.a,self.b,self.probes,'ESPIONAGE')
        self.assertEqual(observed['quality'],max(0,original['quality']-1))
        self.assertTrue(observed['interference']);self.assertEqual(original,snapshot)
        self.assertNotIn('source_ship_id',observed)
        self.b.state.universe['ship_health']={ship['id']:0}
        no_emitter=gather_intelligence(self.a,self.b,self.probes,'ESPIONAGE')
        self.assertFalse(no_emitter['interference']);self.assertEqual(no_emitter['quality'],original['quality'])

    def test_transit_remote_or_multiple_emitters_do_not_invent_protection(self):
        ship=self.fixture.ship(self.b,'odyssey_hull','emitter')
        first=gather_intelligence(self.a,self.b,self.probes,'RECON')
        second_ship=self.fixture.ship(self.b,'odyssey_hull','redundant')
        self.assertEqual(gather_intelligence(self.a,self.b,self.probes,'RECON')['quality'],first['quality'])
        self.b.state.fleets=[{'id':'outbound','ship_ids':[ship['id'],second_ship['id']],'status':'TRANSIT'}]
        self.assertFalse(gather_intelligence(self.a,self.b,self.probes,'RECON')['interference'])
        self.b.state.fleets[0].update(status='ARRIVED',x=0,y=0)
        self.b.state.universe['fleet_planets']={'outbound':'other-planet'}
        self.assertFalse(gather_intelligence(self.a,self.b,self.probes,'RECON')['interference'])

    def test_platform_mode_requires_owned_structure_technology_and_power(self):
        unit=self.fixture.unit(self.b,'orbital_platform')
        with self.assertRaises(DataValidationError):set_platform_mode(self.a,unit['id'],'interdiction')
        with self.assertRaisesRegex(DataValidationError,'Interdição'):set_platform_mode(self.b,unit['id'],'interdiction')
        self.b.state.universe['levels']['spatial_interdiction']=1
        self.b.state.districts['solar_field']=0
        with self.assertRaisesRegex(DataValidationError,'energia'):set_platform_mode(self.b,unit['id'],'interdiction')
        self.b.state.districts['solar_field']=100
        self.assertEqual(set_platform_mode(self.b,unit['id'],'interdiction')['mode'],'interdiction')
        validate_defenses(self.b.catalog,self.b.state)
        set_platform_mode(self.b,unit['id'],'defense')
