"""Authoritative Stargrave operations reached through actual paid P3 construction."""
import os
import unittest
from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from sqlalchemy import select
from starz.db import models as m
from starz.data import DataValidationError
from starz.persistent import stellar
import test_stellar_delivery as construction


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'),'isolated PostgreSQL required')
class StargraveOperations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):construction.StellarDelivery.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):construction.StellarDelivery.tearDownClass.__func__(cls)
    prepare=construction.StellarDelivery.prepare

    def commission(self):
        store,now,a,b,project,request=self.prepare()
        fleet=store.transaction(a,lambda session,emp,e:store.dispatch(session,emp,e,request))
        now[0]=fleet['arrival_at'];store.tick()
        for _ in range(5):
            job=store.transaction(a,lambda session,emp,e:stellar.start_phase(session,emp,e,project['project_id'],uuid4().hex))
            now[0]=job['complete_at'];store.tick()
        with Session(self.db) as session:
            unit=session.scalar(select(m.StellarUnit).where(m.StellarUnit.project_id==UUID(project['project_id'])))
            unit_id=str(unit.id)
        now[0]+=10000;store.tick()
        return store,now,a,b,project,unit_id

    def command(self,store,actor,data):
        from starz.persistent.stargrave import command
        return store.transaction(actor,lambda session,emp,e:command(store,session,emp,e,data))

    def test_operational_move_is_owned_timed_and_idempotent(self):
        store,now,a,b,project,unit=self.commission()
        home=store.run(a,lambda e:e.state.planet_id)
        request={'unit_id':unit,'action':'move','target_planet_id':home,'idempotency_key':uuid4().hex}
        with self.assertRaises(DataValidationError):self.command(store,b,request)
        result=self.command(store,a,request)
        self.assertEqual(result,self.command(store,a,request))
        with Session(self.db) as session:
            record=session.get(m.StellarUnit,UUID(unit));self.assertEqual(record.state,'transit');self.assertIsNone(record.planet_id)
            order=session.scalar(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==a,m.UniverseOrder.kind.like('stargrave_%'),m.UniverseOrder.resolved==False))
            self.assertIsNotNone(order);arrival=order.due_at.timestamp()
        self.assertGreater(arrival,now[0]);now[0]=arrival;store.tick();store.tick()
        with Session(self.db) as session:
            record=session.get(m.StellarUnit,UUID(unit))
            self.assertEqual(str(record.planet_id),home);self.assertEqual(record.state,'operational')
            self.assertEqual(str(record.source_id),project['source_id'])
            self.assertIsNotNone(session.get(m.StellarSource,record.source_id).removed_at)

    def test_conventional_fleet_can_defeat_real_commissioned_unit_without_containment(self):
        store,now,a,b,project,unit=self.commission()
        home=store.run(a,lambda e:e.state.planet_id)
        moved=self.command(store,a,{'unit_id':unit,'action':'move','target_planet_id':home,'idempotency_key':uuid4().hex})
        with Session(self.db) as session:
            order=session.scalar(select(m.UniverseOrder).where(m.UniverseOrder.empire_id==a,m.UniverseOrder.kind.like('stargrave_%'),m.UniverseOrder.resolved==False));arrival=order.due_at.timestamp()
        now[0]=arrival;store.tick()
        def prepare_fleet(e):
            e.state.population_total=5000;e.state.districts.update(civil_district=50,solar_field=100,orbital_shipyard=48)
            e.state.stocks.update(refined_alloy=100000,components=100000,fusion_fuel=100000)
            e.state.universe['levels']['containment_warfare']=0
            return [e.build_ship('leviathan_hull','nuclear_drive','fusion_fuel',now=e.state.last_updated)['id'] for _ in range(48)]
        ships=store.run(b,prepare_fleet);now[0]+=10000;store.tick()
        store.transaction(b,lambda session,emp,e:store.diplomacy(session,emp,e,str(a),'war'))
        fleet=store.transaction(b,lambda session,emp,e:store.dispatch(session,emp,e,{'ship_ids':ships,'mission':'ATTACK','target_planet_id':home,'cargo':{},'x':0,'y':0}))
        now[0]=fleet['arrival_at'];store.tick();store.tick()
        with Session(self.db) as session:
            record=session.get(m.StellarUnit,UUID(unit))
            self.assertEqual(record.state,'sealed_wreck')
            self.assertEqual(str(record.source_id),project['source_id'])
            self.assertIsNotNone(session.get(m.StellarSource,record.source_id).removed_at)
        reports=store.run(b,lambda e:e.state.universe['battles'])
        self.assertEqual(len(reports),1);self.assertLessEqual(len(reports[0]['rounds']),6)

    def test_bombardment_is_prepared_idempotent_and_cancelled_by_peace(self):
        store,now,a,b,project,unit=self.commission()
        target=store.run(b,lambda e:e.state.planet_id)
        store.transaction(a,lambda session,emp,e:store.diplomacy(session,emp,e,str(b),'war'))
        result=self.command(store,a,{'unit_id':unit,'action':'attack','target_planet_id':target,'idempotency_key':uuid4().hex})
        now[0]=result['arrival_at'];store.tick()
        before=store.run(b,lambda e:dict(e.state.districts))
        request={'unit_id':unit,'action':'bombard','target_planet_id':target,'idempotency_key':uuid4().hex}
        prepared=self.command(store,a,request)
        self.assertGreaterEqual(prepared['arrival_at']-now[0],43200)
        self.assertEqual(self.command(store,a,request),prepared)
        self.assertEqual(store.run(b,lambda e:e.state.districts),before)
        now[0]=prepared['arrival_at'];store.tick();store.tick()
        after=store.run(b,lambda e:dict(e.state.districts))
        self.assertEqual(after['civil_district'],before['civil_district'])
        self.assertLess(sum(after.values()),sum(before.values()))
        self.assertEqual(self.command(store,a,request),prepared)
        self.assertEqual(store.run(b,lambda e:e.state.districts),after)
        pending=self.command(store,a,{'unit_id':unit,'action':'bombard','target_planet_id':target,'idempotency_key':uuid4().hex})
        store.transaction(a,lambda session,emp,e:store.diplomacy(session,emp,e,str(b),'neutral'))
        store.transaction(b,lambda session,emp,e:store.diplomacy(session,emp,e,str(a),'accept'))
        now[0]=pending['arrival_at'];store.tick();store.tick()
        self.assertEqual(store.run(b,lambda e:e.state.districts),after)
        with Session(self.db) as session:
            row=session.get(m.StellarUnit,UUID(unit));self.assertIsNone(row.payload['active_order_id'])

    def test_defender_counterattacks_foreign_unit_at_own_planet_without_homeworld_leak(self):
        from starz.defenses import build_defense
        store,now,a,b,project,unit=self.commission()
        target=store.run(b,lambda e:e.state.planet_id)
        fort=store.run(a,lambda e:build_defense(e,'point_defense'))
        now[0]=fort['complete_at'];store.tick()
        store.transaction(a,lambda session,emp,e:store.diplomacy(session,emp,e,str(b),'war'))
        result=self.command(store,a,{'unit_id':unit,'action':'attack','target_planet_id':target,'idempotency_key':uuid4().hex})
        now[0]=result['arrival_at'];store.tick()
        def navy(e):
            e.state.population_total=5000;e.state.districts.update(civil_district=50,solar_field=100,orbital_shipyard=48)
            e.state.stocks.update(refined_alloy=100000,components=100000,fusion_fuel=100000)
            e.state.universe['levels']['containment_warfare']=0
            return [e.build_ship('leviathan_hull','nuclear_drive','fusion_fuel',now=e.state.last_updated)['id'] for _ in range(48)]
        ships=store.run(b,navy);now[0]+=10000;store.tick()
        home_forts=store.run(a,lambda e:len(e.state.defenses['units']))
        attack=store.transaction(b,lambda session,emp,e:store.dispatch(session,emp,e,{'ship_ids':ships,'mission':'ATTACK','target_planet_id':target,'target_stellar_id':unit,'cargo':{},'x':0,'y':0}))
        now[0]=attack['arrival_at'];store.tick();store.tick()
        with Session(self.db) as session:
            row=session.get(m.StellarUnit,UUID(unit));self.assertEqual(row.state,'sealed_wreck')
            self.assertEqual(str(row.planet_id),target);self.assertEqual(row.empire_id,a)
        self.assertEqual(store.run(a,lambda e:len(e.state.defenses['units'])),home_forts)
        report=store.run(b,lambda e:e.state.universe['battles'][0])
        self.assertEqual(report['planet_id'],target);self.assertEqual(report['defenses_before'],[]);self.assertEqual(report['loot'],{})
