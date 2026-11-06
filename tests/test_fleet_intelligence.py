import copy,os,unittest
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from starz.data import DataValidationError
from starz.persistent.intelligence import gather_intelligence,intel_view,known_threat
from starz.persistent.combat import resolve_battle
from starz.db import models as m
import test_planetary_defense as defense_tests

class IntelligenceRules(unittest.TestCase):
    def setUp(self):
        self.fixture=defense_tests.DefenseRules();self.fixture.setUpClass();self.a=self.fixture.engine();self.b=self.fixture.engine();self.ships=[self.fixture.ship(self.a,'scout_hull')]
    def test_quality_limits_detection_expiration_and_historical_snapshot(self):
        self.a.state.universe['levels']={};self.b.state.universe['levels']={};self.fixture.unit(self.b,'point_defense')
        r=gather_intelligence(self.a,self.b,self.ships,'RECON')
        self.assertEqual(r['defenses']['status'],'ESTIMATED');self.assertEqual(r['stocks']['status'],'UNKNOWN');self.assertTrue(r['detected'])
        frozen=copy.deepcopy(r);self.b.state.defenses['units']=[];self.b.state.stocks['components']=0
        self.assertEqual(known_threat(self.a.state,self.b.state.planet_id,1000)['defenses'],frozen['defenses'])
        self.assertEqual(intel_view(self.a.state,r['expires_at'])[0]['status'],'OUTDATED');self.assertEqual(r,frozen)
        self.assertEqual(known_threat(self.a.state,'unobserved',1000)['status'],'UNKNOWN')
    def test_strong_technology_confirms_inventory_and_countermeasures_damage_weak_probe(self):
        self.a.state.universe['levels']={'intelligence':10,'sensor_array':10};self.b.state.universe['levels']={}
        r=gather_intelligence(self.a,self.b,self.ships,'ESPIONAGE');self.assertEqual(r['stocks']['status'],'CONFIRMED');self.assertFalse(r['detected'])
        self.a.state.universe['levels']={'intelligence':1};self.b.state.universe['levels']={'counter_intelligence':20}
        r=gather_intelligence(self.a,self.b,self.ships,'ESPIONAGE');self.assertEqual(r['quality'],0);self.assertGreater(r['probe_damage']['attacker'],0);self.assertLess(self.a.state.universe['ship_health']['attacker'],90)
        self.a.state.universe['ship_health']['attacker']=.5
        gather_intelligence(self.a,self.b,self.ships,'ESPIONAGE');self.assertEqual(self.a.state.universe['ship_health']['attacker'],.5)
    def test_reports_capture_applied_technology_ammunition_and_economic_losses(self):
        self.fixture.unit(self.b,'point_defense');report=resolve_battle(self.a,self.ships,self.b,self.b.state.planet_id)
        self.assertIn('attacker',report['technology']);self.assertIn('ammunition_consumed',report);self.assertTrue(report['economic_losses']['attacker']);self.assertNotIn('carrier_operations',report['technology']['attacker']);self.assertNotIn('capital_architecture',report['technology']['attacker'])

@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'),'isolated warfare database required')
class IntelligencePersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):defense_tests.DefensePersistence.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):defense_tests.DefensePersistence.tearDownClass.__func__(cls)
    def test_real_recon_is_private_expires_and_duplicate_dispatch_cannot_spend(self):
        store,now,aid,bid=defense_tests.DefensePersistence.prepare(self);ap=store.run(aid,lambda e:e.state.planet_id);bp=store.run(bid,lambda e:e.state.planet_id)
        ship=store.run(aid,lambda e:e.build_ship('scout_hull','chemical_drive','ion_fuel',now=e.state.last_updated));now[0]+=100;store.tick()
        request={'ship_ids':[ship['id']],'mission':'RECON','target_planet_id':bp,'x':0,'y':0,'cargo':{}}
        def dispatch_once():
            try:return store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,request))
            except DataValidationError:return None
        with ThreadPoolExecutor(2) as pool:replies=list(pool.map(lambda _:dispatch_once(),range(2)))
        self.assertEqual(sum(r is not None for r in replies),1);fleet=next(r for r in replies if r is not None);stocks=store.run(aid,lambda e:dict(e.state.stocks))
        with self.assertRaises(DataValidationError):store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,request))
        self.assertEqual(store.run(aid,lambda e:e.state.stocks),stocks)
        now[0]=fleet['arrival_at'];store.tick();r=store.run(aid,lambda e:intel_view(e.state,now[0]))[0]
        self.assertEqual(r['planet_id'],bp);self.assertFalse(store.run(bid,lambda e:e.state.universe.get('intelligence',[])))
        store.tick();self.assertEqual(len(store.run(aid,lambda e:e.state.universe['intelligence'])),1)
        now[0]=r['expires_at']+1;store.tick();self.assertEqual(store.run(aid,lambda e:intel_view(e.state,now[0]))[0]['status'],'OUTDATED')
        with self.assertRaises(DataValidationError):store.run(bid,lambda e:e.state.stocks,planet_id=ap)
        request['mission']='ESPIONAGE';spy=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,request));now[0]=spy['arrival_at'];store.tick()
        self.assertEqual(store.run(aid,lambda e:e.state.universe['intelligence'][0]['mission']),'ESPIONAGE')
    def test_recall_preserves_cargo_and_cancels_the_original_order_once(self):
        store,now,aid,bid=defense_tests.DefensePersistence.prepare(self);bp=store.run(bid,lambda e:e.state.planet_id);ap=store.run(aid,lambda e:e.state.planet_id)
        ship=store.run(aid,lambda e:e.build_ship('wayfarer_hull','chemical_drive','ion_fuel',now=e.state.last_updated));now[0]+=100;store.tick()
        store.run(aid,lambda e:e.state.districts.update(manufacturing=0,processor=0));store.run(bid,lambda e:e.state.districts.update(manufacturing=0,processor=0))
        before=store.run(aid,lambda e:e.state.stocks['components']);targetbefore=store.run(bid,lambda e:e.state.stocks['components'])
        request={'ship_ids':[ship['id']],'mission':'TRANSPORT','target_planet_id':bp,'x':0,'y':0,'cargo':{'components':20}}
        fleet=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,request));now[0]+=1
        with self.assertRaises(DataValidationError):store.transaction(bid,lambda session,emp,e:store.recall(session,emp,e,fleet['id']))
        recalled=store.transaction(aid,lambda session,emp,e:store.recall(session,emp,e,fleet['id']))
        with self.assertRaises(DataValidationError):store.transaction(aid,lambda session,emp,e:store.recall(session,emp,e,fleet['id']))
        now[0]=recalled['arrival_at'];store.tick()
        self.assertAlmostEqual(store.run(aid,lambda e:e.state.stocks['components']),before);self.assertEqual(store.run(bid,lambda e:e.state.stocks['components']),targetbefore)
        with Session(self.db) as session:self.assertEqual(len([o for o in session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==aid,m.UniverseOrder.kind=='mission',m.UniverseOrder.resolved==False))]),0)

    def test_reinforcement_assigns_defenders_to_exact_owned_planet(self):
        from starz.db.store import utc
        from starz.persistent.combat import local_defenders
        store,now,aid,bid=defense_tests.DefensePersistence.prepare(self);ap=store.run(aid,lambda e:e.state.planet_id);bp=store.run(bid,lambda e:e.state.planet_id)
        with Session(self.db) as session,session.begin():
            home=session.get(m.Planet,__import__('uuid').UUID(ap));colony=m.Planet(system_id=home.system_id,planet_index=1,empire_id=aid,population_total=0,created_at=utc(now[0]),last_updated=utc(now[0]));session.add(colony);session.flush();cp=str(colony.id)
        ship=store.run(aid,lambda e:e.build_ship('scout_hull','chemical_drive','ion_fuel',now=e.state.last_updated));now[0]+=100;store.tick()
        request={'ship_ids':[ship['id']],'mission':'REINFORCE','target_planet_id':bp,'x':0,'y':0,'cargo':{}}
        with self.assertRaises(DataValidationError):store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,request))
        request['target_planet_id']=cp;fleet=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,request));now[0]=fleet['arrival_at'];store.tick()
        self.assertEqual(store.run(aid,lambda e:len(local_defenders(e,cp)),planet_id=cp),1)
        self.assertEqual(store.run(aid,lambda e:len(local_defenders(e,ap))),0)
