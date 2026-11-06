import copy
import unittest
from uuid import uuid4
from starz.data import Catalog,DataValidationError
from starz.simulation import Engine
from starz.defenses import build_defense,defense_quote,ensure_defenses
from starz.persistent.combat import resolve_battle,resolve_missiles,local_defenders
from starz.persistent.research_planning import plan_research

class DefenseRules(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.catalog=Catalog.load('game_data','persistent_data')
    def engine(self):
        e=Engine.new(self.catalog,now=1000);e.state.planet_id=str(uuid4());e.state.universe={'levels':{t.id:1 if t.kind=='breakthrough' else 5 for t in self.catalog.items['technologies'].values()}}
        e.state.research['completed']=list(e.state.universe['levels']);e.state.research['completed_at']={id:1000 for id in e.state.research['completed']}
        e.state.districts.update(processor=3,manufacturing=3,solar_field=100);e.state.population_total=500;e.state.stocks.update(refined_alloy=100000,components=100000,volatiles=100000);e.advance(1000);return e
    def unit(self,e,type,hp=None,charge=0):
        d=self.catalog.get('defenses',type);u={'id':str(uuid4()),'type':type,'hp':hp or d.hull_points,'charge':charge};e.state.defenses['units'].append(u);return u
    def ship(self,e,type,id='attacker'):
        h=self.catalog.get('ships',type);s={'id':id,'hull_id':type,'crew':h.crew,'mass':h.mass,'ready_at':0,'origin_planet_id':e.state.planet_id,'system_x':e.state.system_x,'system_y':e.state.system_y,'propulsion_id':h.compatible_propulsion[0],'fuel_id':self.catalog.get('propulsion',h.compatible_propulsion[0]).compatible_fuels[0]};e.state.ships.append(s);return s
    def test_prerequisites_quantity_payment_queue_and_repair(self):
        e=self.engine();e.state.research['completed'].remove('naval_doctrine');self.assertTrue(defense_quote(e,'point_defense')['requirements']);e.state.research['completed'].append('naval_doctrine')
        before=e.state.stocks['components'];q=defense_quote(e,'point_defense',3);job=build_defense(e,'point_defense',3);self.assertEqual(e.state.stocks['components'],before-q['cost']['components']);e.advance(job['complete_at']);e.advance(job['complete_at']);self.assertEqual(len(e.state.defenses['units']),3)
        unit=e.state.defenses['units'][0];unit['hp']=20;job=build_defense(e,'point_defense',repair=unit['id']);e.advance(job['complete_at']);self.assertEqual(unit['hp'],100)
        with self.assertRaises(DataValidationError):build_defense(e,'point_defense',0)
    def test_legacy_batteries_migrate_once(self):
        e=self.engine();e.state.districts['orbital_battery']=4;ensure_defenses(self.catalog,e.state);ensure_defenses(self.catalog,e.state);self.assertEqual(len(e.state.defenses['units']),4);self.assertEqual(e.state.districts['orbital_battery'],0)
    def test_class_composition_ammunition_and_survivor_damage(self):
        a,b=self.engine(),self.engine();scouts=[self.ship(a,'scout_hull',str(i)) for i in range(4)];self.unit(b,'point_defense');report=resolve_battle(a,scouts,b,b.state.planet_id);self.assertTrue(report['rounds']);self.assertTrue(report['attacker_losses'])
        a,b=self.engine(),self.engine();capital=self.ship(a,'leviathan_hull');self.unit(b,'point_defense');report=resolve_battle(a,[capital],b,b.state.planet_id);self.assertEqual(report['outcome'],'attacker');self.assertFalse(b.state.defenses['units'])
        a,b=self.engine(),self.engine();capital=self.ship(a,'leviathan_hull');self.unit(b,'orbital_missile_battery');b.state.defenses['ammunition']['anti_ship_missile']=1;report=resolve_battle(a,[capital],b,b.state.planet_id);self.assertEqual(report['ammunition_after']['anti_ship_missile'],0)
    def test_shield_interception_persistent_damage_and_infrastructure(self):
        a,b=self.engine(),self.engine();self.unit(b,'planetary_shield',charge=350);self.unit(b,'missile_interceptor');b.state.defenses['ammunition']['interceptor_missile']=2
        report=resolve_missiles(a,b,4);self.assertEqual(report['intercepted'],2);self.assertGreater(report['shield_absorbed'],0);self.assertEqual(b.state.defenses['ammunition']['interceptor_missile'],0)
        b.state.defenses['units']=[];before=dict(b.state.districts);report=resolve_missiles(a,b,10);self.assertTrue(report['infrastructure_losses']);self.assertLess(sum(b.state.districts.values()),sum(before.values()))
        b=self.engine();u=self.unit(b,'orbital_platform');report=resolve_missiles(a,b,1);self.assertGreater(u['hp'],report['defenses_after'][0]['hp'])
    def test_ships_only_defend_their_associated_planet(self):
        e=self.engine();s=self.ship(e,'scout_hull','local');self.assertEqual(local_defenders(e,e.state.planet_id),[s]);self.assertFalse(local_defenders(e,'another-planet'))
        e.state.fleets=[{'id':'fleet','ship_ids':['local'],'status':'ARRIVED','x':e.state.system_x,'y':e.state.system_y}];e.state.universe['fleet_planets']={'fleet':'another-planet'};self.assertFalse(local_defenders(e,e.state.planet_id));self.assertEqual(local_defenders(e,'another-planet'),[s])
    def test_damaged_ships_repair_only_at_their_local_shipyard(self):
        e=self.engine();e.state.districts['orbital_shipyard']=1;s=self.ship(e,'scout_hull','damaged');e.state.universe['ship_health']={'damaged':20};e.advance(1005);self.assertAlmostEqual(e.state.universe['ship_health']['damaged'],30)
        e.state.fleets=[{'id':'remote','ship_ids':['damaged'],'status':'ARRIVED','x':0,'y':0}];e.state.universe['fleet_planets']={'remote':'another-planet'};e.advance(1010);self.assertAlmostEqual(e.state.universe['ship_health']['damaged'],30)

    def test_returned_cargo_uses_exact_origin_planet_in_a_shared_system(self):
        from types import SimpleNamespace
        from unittest.mock import patch
        from starz.persistent.service import PersistentStore
        e=self.engine();home=e.state.planet_id;e.state.planets=[{'id':home,'x':0,'y':0},{'id':'colony','x':0,'y':0}]
        e.state.stocks_by_planet={home:e.state.stocks,'colony':{'raw_ore':0}};before=e.state.stocks['raw_ore'];e.state.fleets=[{'id':'returning','ship_ids':[],'status':'ARRIVED'}]
        order=SimpleNamespace(empire_id='owner',kind='mission',payload={'fleet_id':'returning','mission':'RETURN','origin':[0,0],'origin_planet':'colony','cargo':{'raw_ore':25}})
        store=PersistentStore(None,self.catalog)
        with patch.object(store,'save'):store.resolve(None,order,{'owner':e})
        self.assertEqual(e.state.stocks['raw_ore'],before);self.assertEqual(e.state.stocks_by_planet['colony']['raw_ore'],25)

    def test_plan_is_topological_read_only_and_matches_level_tier_rules(self):
        e=self.engine();e.state.universe['levels']={};e.state.research['completed']=[];before=copy.deepcopy(e.state.to_dict());plan=plan_research(e,'carrier_operations');self.assertEqual(before,e.state.to_dict());seen={}
        for step in plan['steps']:
            t=self.catalog.get('technologies',step['id'])
            for ref,n in t.level_requires.items():self.assertGreaterEqual(seen.get(ref,0),n)
            if t.tier>1 and not t.advances_tier:self.assertGreaterEqual(seen.get(f'{t.domain}_tier_{t.tier}',0),1)
            seen[t.id]=step['level']
        self.assertEqual(plan['steps'][-1]['id'],'carrier_operations');self.assertEqual(len(plan['capacity']),3)


import os
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session
from sqlalchemy import select
from starz.db import models as m
from starz.db.store import load,utc
from starz.persistent.service import PersistentStore
import test_persistent_universe as sql_fixtures

@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'),'isolated defense PostgreSQL required')
class DefensePersistence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):sql_fixtures.SharedUniverse.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):sql_fixtures.SharedUniverse.tearDownClass.__func__(cls)
    def prepare(self):
        now=[1000.0];store=PersistentStore(self.db,self.catalog,clock=lambda:now[0])
        with Session(self.db) as session,session.begin():
            a=store.create_player(session,'defense-a-'+uuid4().hex[:6]);b=store.create_player(session,'defense-b-'+uuid4().hex[:6]);aid,bid=a.id,b.id
        def ready(e):
            e.state.universe['levels']={t.id:1 if t.kind=='breakthrough' else 5 for t in self.catalog.items['technologies'].values()}
            e.state.research['completed']=list(e.state.universe['levels']);e.state.research['completed_at']={id:now[0] for id in e.state.research['completed']}
            e.state.population_total=500;e.state.districts.update(solar_field=100,processor=3,manufacturing=3)
            e.state.stocks.update(refined_alloy=10000,components=10000,volatiles=10000,ion_fuel=100000)
        store.run(aid,ready);store.run(bid,ready);return store,now,aid,bid
    def test_concurrent_spending_owned_queues_offline_completion_and_legacy_migration(self):
        store,now,aid,bid=self.prepare();bp=store.run(bid,lambda e:e.state.planet_id)
        with self.assertRaises(DataValidationError):store.run(aid,lambda e:build_defense(e,'point_defense'),planet_id=bp)
        store.run(aid,lambda e:e.state.stocks.update(components=6))
        def spend():
            try:store.run(aid,lambda e:build_defense(e,'point_defense'));return True
            except DataValidationError:return False
        with ThreadPoolExecutor(2) as pool:self.assertEqual(sum(pool.map(lambda _:spend(),range(2))),1)
        now[0]+=100;store.tick();inventory=store.run(aid,lambda e:copy.deepcopy(e.state.defenses));self.assertEqual(len(inventory['units']),1);store.tick();self.assertEqual(store.run(aid,lambda e:e.state.defenses),inventory)
        store.run(bid,lambda e:e.state.districts.update(orbital_battery=3));store.tick();self.assertEqual(store.run(bid,lambda e:len(e.state.defenses['units'])),3);store.tick();self.assertEqual(store.run(bid,lambda e:len(e.state.defenses['units'])),3)
    def test_actual_war_fleet_and_missile_resolution_are_planet_specific_and_idempotent(self):
        store,now,aid,bid=self.prepare();b=store.run(bid,lambda e:e.state.to_dict());ap=store.run(aid,lambda e:e.state.planet_id);bp=b['planet_id']
        with Session(self.db) as session,session.begin():
            home=session.get(m.Planet, __import__('uuid').UUID(bp));colony=m.Planet(system_id=home.system_id,planet_index=1,empire_id=bid,population_total=100,created_at=utc(now[0]),last_updated=utc(now[0]));session.add(colony);session.flush();cp=str(colony.id)
            session.add(m.District(planet_id=colony.id,district_id='solar_field',level=10));session.add(m.District(planet_id=colony.id,district_id='civil_district',level=2));session.add(m.District(planet_id=colony.id,district_id='processor',level=2))
            for resource in ['raw_ore','volatiles','refined_alloy','components','ion_fuel','fusion_fuel']:session.add(m.PlanetStock(planet_id=colony.id,resource_id=resource,amount=10000))
        job=store.run(bid,lambda e:build_defense(e,'point_defense',2),planet_id=cp);store.run(bid,lambda e:build_defense(e,'orbital_platform'),planet_id=bp)
        ship=store.run(aid,lambda e:e.build_ship('leviathan_hull','nuclear_drive','fusion_fuel',now=e.state.last_updated))
        now[0]+=1000;store.tick();home_before=store.run(bid,lambda e:copy.deepcopy(e.state.defenses),planet_id=bp)
        store.transaction(aid,lambda session,emp,e:store.diplomacy(session,emp,e,str(bid),'war'))
        target={'ship_ids':[ship['id']],'mission':'ATTACK','target_planet_id':cp,'x':b['system_x'],'y':b['system_y'],'planet_index':None,'cargo':{}}
        f=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,target));now[0]=f['arrival_at'];store.tick()
        self.assertEqual(store.run(bid,lambda e:e.state.defenses,planet_id=bp),home_before)
        battle=store.run(bid,lambda e:e.state.universe['battles'][0]);self.assertEqual(battle['planet_id'],cp);self.assertTrue(battle['rounds']);self.assertLess(len(battle['defenses_after']),2)
        count=store.run(bid,lambda e:len(e.state.universe['battles']));store.tick();self.assertEqual(store.run(bid,lambda e:len(e.state.universe['battles'])),count)
        # Real ammunition manufacture, launch and delayed authoritative interception.
        launcher=store.run(aid,lambda e:build_defense(e,'orbital_missile_battery'));store.run(aid,lambda e:build_defense(e,'strategic_missile',4))
        store.run(bid,lambda e:build_defense(e,'missile_interceptor'),planet_id=cp);store.run(bid,lambda e:build_defense(e,'interceptor_missile',2),planet_id=cp)
        now[0]+=1000;store.tick();source_before=store.run(aid,lambda e:e.state.defenses['ammunition']['strategic_missile'])
        strike=store.transaction(aid,lambda session,emp,e:store.launch_missiles(session,emp,e,cp,4));self.assertEqual(store.run(aid,lambda e:e.state.defenses['ammunition']['strategic_missile']),source_before-4)
        now[0]=strike['arrival_at'];store.tick();report=store.run(bid,lambda e:e.state.universe['battles'][0]);self.assertEqual(report['kind'],'missile');self.assertEqual(report['intercepted'],2);store.tick();self.assertEqual(store.run(bid,lambda e:e.state.universe['battles'][0]),report)

    def test_remote_defense_completion_changes_global_science_at_its_timestamp(self):
        store,now,aid,bid=self.prepare()
        with Session(self.db) as session,session.begin():
            owner=session.get(m.Empire,aid);home=session.get(m.Planet,owner.home_planet_id)
            colony=m.Planet(system_id=home.system_id,planet_index=1,empire_id=aid,population_total=200,created_at=utc(now[0]),last_updated=utc(now[0]));session.add(colony);session.flush();cp=str(colony.id)
            for id,n in [('civil_district',2),('solar_field',10),('processor',2),('research_lab',2)]:session.add(m.District(planet_id=colony.id,district_id=id,level=n))
            for r in ['raw_ore','volatiles','refined_alloy','components','ion_fuel','fusion_fuel']:session.add(m.PlanetStock(planet_id=colony.id,resource_id=r,amount=10000))
        job=store.run(aid,lambda e:build_defense(e,'point_defense',20),planet_id=cp)
        store.run(aid,lambda e:e.state.districts.update(solar_field=1),planet_id=cp)
        store.run(aid,lambda e:e.state.universe['levels'].update(computing=10))
        started=store.run(aid,lambda e:e.research('computing',now=e.state.last_updated));before=store.run(aid,lambda e:e.science()['fundamental']['rate']);start=now[0]
        now[0]=job['complete_at']+10;store.tick();after=store.run(aid,lambda e:e.science()['fundamental']['rate']);remaining=store.run(aid,lambda e:e.state.universe['research_domains']['fundamental']['remaining_work'])
        self.assertLess(after,before)
        self.assertAlmostEqual(remaining,started['remaining_work']-before*(job['complete_at']-start)-after*10,places=4)
