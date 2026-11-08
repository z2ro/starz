"""C3-D07: real PostgreSQL mission payloads, successors and ownership."""
import copy
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from starz.db import models as m
from starz.data import DataValidationError
from starz.defenses import build_defense, set_platform_mode
from starz.persistent.routes import Mission
import test_planetary_defense as fixtures


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'),'isolated PostgreSQL required')
class CombatOrders(unittest.TestCase):
    @classmethod
    def setUpClass(cls):fixtures.DefensePersistence.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):fixtures.DefensePersistence.tearDownClass.__func__(cls)

    def prepare(self):
        store,now,a,b=fixtures.DefensePersistence.prepare(self)
        target=store.run(b,lambda e:e.state.planet_id)
        ship=store.run(a,lambda e:e.build_ship('vanguard_hull',now=e.state.last_updated))
        now[0]+=100;store.tick()
        store.transaction(a,lambda session,emp,e:store.diplomacy(session,emp,e,str(b),'war'))
        request={'ship_ids':[ship['id']],'mission':'ATTACK','target_planet_id':target,'x':0,'y':0,'cargo':{},'doctrine':'rupture','weapon_profile':'anti_shield'}
        return store,now,a,b,target,request

    def test_T02_dispatch_validates_freezes_and_duplicate_cannot_spend(self):
        store,now,a,b,target,request=self.prepare()
        store.run(a,lambda e:e.state.universe['levels'].update(fire_control_doctrine=0))
        before=store.run(a,lambda e:dict(e.state.stocks))
        with self.assertRaisesRegex(DataValidationError,'Controle de Tiro'):
            store.transaction(a,lambda s,emp,e:store.dispatch(s,emp,e,request))
        self.assertEqual(store.run(a,lambda e:e.state.stocks),before)
        store.run(a,lambda e:e.state.universe['levels'].update(fire_control_doctrine=1))
        fleet=store.transaction(a,lambda s,emp,e:store.dispatch(s,emp,e,request))
        with self.assertRaises(DataValidationError):store.transaction(a,lambda s,emp,e:store.dispatch(s,emp,e,request))
        with Session(self.db) as session:
            order=session.scalar(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==a,m.UniverseOrder.kind=='mission',m.UniverseOrder.resolved==False))
            self.assertEqual(order.payload['combat'],{'version':1,'doctrine':'rupture','weapon_profile':'anti_shield','experiment':'intermediate'})
            self.assertEqual(order.payload['chain_id'],fleet['id'])
        with self.assertRaises(ValueError):Mission(**{**request,'doctrine':'invincible'})
        with self.assertRaises(DataValidationError):store.transaction(b,lambda s,emp,e:store.dispatch(s,emp,e,request))

    def interdict(self,store,now,a,b,request):
        job=store.run(b,lambda e:build_defense(e,'orbital_platform'))
        now[0]=job['complete_at'];store.tick()
        unit=store.run(b,lambda e:e.state.defenses['units'][0]['id'])
        with self.assertRaises(DataValidationError):store.run(a,lambda e:set_platform_mode(e,unit,'interdiction'))
        store.run(b,lambda e:set_platform_mode(e,unit,'interdiction'))
        fleet=store.transaction(a,lambda s,emp,e:store.dispatch(s,emp,e,request))
        before=store.run(a,lambda e:dict(e.state.stocks))
        now[0]=fleet['arrival_at'];store.tick()
        with Session(self.db) as session:
            orders=list(session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==a,m.UniverseOrder.kind=='mission')))
            predecessor=next(o for o in orders if o.resolved)
            successor=next(o for o in orders if not o.resolved)
            self.assertEqual(successor.payload['predecessor_id'],str(predecessor.id))
            self.assertTrue(successor.payload['interdiction_applied'])
            due=successor.due_at.timestamp()
            self.assertGreater(due,now[0]);self.assertLessEqual(due-now[0],1800)
            self.assertEqual(successor.payload['combat'],predecessor.payload['combat'])
        self.assertFalse(store.run(a,lambda e:e.state.universe.get('battles',[])))
        self.assertEqual(store.run(a,lambda e:e.state.fleets[0]['status']),'TRANSIT')
        store.tick()
        with Session(self.db) as session:
            self.assertEqual(len(list(session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==a,m.UniverseOrder.kind=='mission')))),2)
        return due,unit

    def test_T07_T08_T09_interdiction_once_then_peace_and_return(self):
        store,now,a,b,target,request=self.prepare()
        due,unit=self.interdict(store,now,a,b,request)
        store.transaction(a,lambda s,emp,e:store.diplomacy(s,emp,e,str(b),'neutral'))
        store.transaction(b,lambda s,emp,e:store.diplomacy(s,emp,e,str(a),'accept'))
        reserve=store.run(a,lambda e:e.state.fleets[0]['fuel_reserve'])
        now[0]=due;store.tick()
        self.assertFalse(store.run(a,lambda e:e.state.universe.get('battles',[])))
        with Session(self.db) as session:
            active=list(session.scalars(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==a,m.UniverseOrder.kind=='mission',m.UniverseOrder.resolved==False)))
            self.assertEqual(len(active),1);self.assertEqual(active[0].payload['mission'],'RETURN')
            return_at=active[0].due_at.timestamp()
        self.assertGreaterEqual(store.run(a,lambda e:e.state.fleets[0]['fuel_reserve']),0)
        self.assertGreater(reserve,0)
        now[0]=return_at;store.tick();store.tick()
        self.assertEqual(store.run(a,lambda e:e.state.fleets[0]['status']),'ARRIVED')

    def test_interdiction_disable_does_not_refund_committed_delay_and_reports_private(self):
        store,now,a,b,target,request=self.prepare()
        due,unit=self.interdict(store,now,a,b,request)
        store.run(b,lambda e:set_platform_mode(e,unit,'defense'))
        now[0]=due;store.tick();store.tick()
        attack_reports=store.run(a,lambda e:copy.deepcopy(e.state.universe.get('battles',[])))
        defense_reports=store.run(b,lambda e:copy.deepcopy(e.state.universe.get('battles',[])))
        self.assertEqual(len(attack_reports),1);self.assertEqual(len(defense_reports),1)
        self.assertEqual(set(attack_reports[0]['technology']),{'attacker'})
        self.assertEqual(set(defense_reports[0]['technology']),{'defender'})
