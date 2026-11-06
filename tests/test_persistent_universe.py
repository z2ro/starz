"""Critical shared-universe rules on an isolated PostgreSQL schema and simulated clock."""
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine,text,select
from sqlalchemy.orm import Session
from starz.data import Catalog,DataValidationError
from starz.db import models as m
from starz.db.store import load
from starz.persistent.service import PersistentStore,power
from starz.persistent.security import password_hash,verify_password
from starz.simulation import Engine
from starz.progression import research_quote,effect,building_quote,EFFECTS

class ProgressionRules(unittest.TestCase):
    def test_content_effects_and_password(self):
        c=Catalog.load('game_data','persistent_data')
        self.assertEqual(sum(t.kind=='repeatable' for t in c.items['technologies'].values()),32)
        self.assertTrue(all(set(t.effects)<=EFFECTS and (t.effects or t.kind=='breakthrough') for t in c.items['technologies'].values()))
        encoded=password_hash('twelve-good-characters')
        self.assertTrue(verify_password('twelve-good-characters',encoded))
        self.assertFalse(verify_password('wrong-password',encoded))
        self.assertNotEqual(encoded,password_hash('twelve-good-characters'))

    def test_level_effects_change_actual_engine_formulas(self):
        c=Catalog.load('game_data','persistent_data')
        a=Engine.new(c,now=1000);a.state.universe={'levels':{}}
        a.state.districts.update(processor=1,volatile_well=1)
        b=Engine(c, __import__('copy').deepcopy(a.state))
        b.state.universe['levels'].update(energy_engineering=2,extraction=2,computing=2,survey_network=2,industrial_automation=2,metallurgy=2)
        self.assertGreater(b.capacities()['energy_generation'],a.capacities()['energy_generation'])
        self.assertGreater(b.capacities()['effective_research_rate'],a.capacities()['effective_research_rate'])
        a.advance(1060);b.advance(1060)
        self.assertGreater(b.state.stocks['raw_ore'],a.state.stocks['raw_ore'])
        self.assertGreater(b.state.stocks['refined_alloy'],a.state.stocks['refined_alloy'])
        self.assertGreater(building_quote(c,b.state,'civil_district')['cost']['components'], c.get('districts','civil_district').cost['components'])
        self.assertTrue(research_quote(c,a.state,'shields')['requirements'])
        vessel={'hull_id':'scout_hull'}
        self.assertGreater(power(b,[vessel]),0)
        before=power(b,[vessel]);b.state.universe['levels']['shields']=2
        self.assertGreater(power(b,[vessel]),before)

@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'),'isolated persistent DB required')
class SharedUniverse(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema='persistent_test_'+uuid4().hex
        cls.admin=create_engine(os.environ['PERSISTENT_TEST_DATABASE_URL'])
        with cls.admin.begin() as conn:conn.execute(text('CREATE SCHEMA '+cls.schema))
        cls.db=create_engine(os.environ['PERSISTENT_TEST_DATABASE_URL'],connect_args={'options':'-csearch_path='+cls.schema})
        cfg=Config('alembic.ini')
        with cls.db.begin() as conn:
            cfg.attributes['connection']=conn;command.upgrade(cfg,'head');command.check(cfg)
        cls.catalog=Catalog.load('game_data','persistent_data')

    @classmethod
    def tearDownClass(cls):
        cls.db.dispose()
        with cls.admin.begin() as conn:conn.execute(text('DROP SCHEMA '+cls.schema+' CASCADE'))
        cls.admin.dispose()

    def test_two_empires_offline_levels_missions_combat_trade_concurrency(self):
        now=[1000.0];store=PersistentStore(self.db,self.catalog,clock=lambda:now[0])
        with Session(self.db) as session,session.begin():
            a=store.create_player(session,'alpha');b=store.create_player(session,'beta');aid,bid=a.id,b.id
            self.assertEqual(a.universe_id,b.universe_id)
            self.assertNotEqual(a.home_planet_id,b.home_planet_id)
        def snapshot(id):return store.run(id,lambda e:e.state.to_dict())
        sa,sb=snapshot(aid),snapshot(bid)
        ap,bp=sa['planet_id'],sb['planet_id']
        with self.assertRaises(DataValidationError):store.run(aid,lambda e:None,planet_id=bp)
        ore=sa['stocks']['raw_ore'];now[0]+=60
        self.assertGreater(snapshot(aid)['stocks']['raw_ore'],ore)
        store.run(aid,lambda e:e.research('computing',now=e.state.last_updated))
        now[0]+=1000
        self.assertEqual(snapshot(aid)['universe']['levels']['computing'],1)
        q1=store.run(aid,lambda e:research_quote(e.catalog,e.state,'computing'))
        store.run(aid,lambda e:e.research('computing',now=e.state.last_updated));now[0]+=1000
        self.assertEqual(snapshot(aid)['universe']['levels']['computing'],2)
        self.assertEqual(store.run(aid,lambda e:effect(e.catalog,e.state,'fleet_slots')),2)
        self.assertGreater(store.run(aid,lambda e:research_quote(e.catalog,e.state,'computing'))['cost']['components'],q1['cost']['components'])
        # Explicit test preconditions for combat/late science; no HTTP cheat endpoints exist.
        def fixture(e):
            e.state.stocks.update(raw_ore=5000,refined_alloy=5000,components=3000,ion_fuel=10000)
            e.state.universe['levels'].update(naval_doctrine=1,intelligence=1,logistics=1,expedition_science=1)
            e.state.research['completed']+=['naval_doctrine','intelligence','logistics','expedition_science']
            e.state.research.setdefault('completed_at',{}).update({k:e.state.last_updated for k in e.state.research['completed']})
            e.state.districts['orbital_shipyard']=4
        store.run(aid,fixture);store.run(bid,fixture)
        ships=[store.run(aid,lambda e:e.build_ship('scout_hull','chemical_drive','ion_fuel',now=e.state.last_updated)) for _ in range(2)]
        now[0]+=200
        destination={'x':sb['system_x'],'y':sb['system_y'],'target_planet_id':bp,'planet_index':None,'cargo':{},'ship_ids':[s['id'] for s in ships]}
        prior=snapshot(aid)['stocks']['ion_fuel']
        quote=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,{**destination,'mission':'ESPIONAGE','preview':True}))
        self.assertEqual(quote['ship_count'],2)
        self.assertEqual(snapshot(aid)['stocks']['ion_fuel'],prior)
        fleet=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,{**destination,'mission':'ESPIONAGE'}))
        self.assertEqual(len(fleet['ship_ids']),2)
        now[0]=fleet['arrival_at']+.1;store.tick()
        self.assertTrue(any('Inteligência' in r['message'] for r in snapshot(aid)['universe']['reports']))
        self.assertFalse(any('Inteligência' in r['message'] for r in snapshot(bid)['universe']['reports']))
        now[0]+=1000;store.tick()
        self.assertEqual(snapshot(aid)['fleets'][0]['status'],'ARRIVED')
        # Resource transfer uses actual cargo hulls and does not duplicate on repeated settlement.
        cargo_ship=store.run(aid,lambda e:e.build_ship('wayfarer_hull','chemical_drive','ion_fuel',now=e.state.last_updated));now[0]+=500
        before=snapshot(bid)['stocks']['raw_ore']
        f=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,{**destination,'ship_ids':[cargo_ship['id']],'mission':'TRANSPORT','cargo':{'raw_ore':100}}))
        now[0]=f['arrival_at'];store.tick();after=snapshot(bid)['stocks']['raw_ore']
        self.assertGreater(after,before+99)
        store.tick();self.assertEqual(snapshot(bid)['stocks']['raw_ore'],after)
        # Real fleet combat, no UI-only scores. Losing scout is actually removed.
        store.transaction(aid,lambda session,emp,e:store.diplomacy(session,emp,e,str(bid),'war'))
        def battery(e):e.state.districts['orbital_battery']=5
        store.run(bid,battery)
        now[0]+=1000
        f=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,{**destination,'ship_ids':[ships[0]['id']],'mission':'ATTACK'}))
        now[0]=f['arrival_at'];store.tick()
        self.assertNotIn(ships[0]['id'],[s['id'] for s in snapshot(aid)['ships']])
        self.assertTrue(any('Batalha' in r['message'] for r in snapshot(bid)['universe']['reports']))
        # Atomic escrow: two competing acceptances cannot both spend/claim the offer.
        offer=store.transaction(aid,lambda session,emp,e:store.market(session,emp,e,{'action':'offer','give':'raw_ore','want':'components','give_amount':100,'want_amount':20}))
        def accept():
            try:return store.transaction(bid,lambda session,emp,e:store.market(session,emp,e,{'action':'accept','order_id':offer['id']}))
            except DataValidationError:return None
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:accept(),range(2)))
        self.assertEqual(sum(r is not None for r in results),1)
        now[0]+=2000;store.tick()
        # Two ordinary actions with only enough stock for one cannot double-spend.
        store.run(aid,lambda e:e.state.stocks.update(components=10))
        def spend():
            try:return store.run(aid,lambda e:e._pay({'components':10}) or True)
            except DataValidationError:return False
        with ThreadPoolExecutor(2) as pool:self.assertEqual(sum(pool.map(lambda _:spend(),range(2))),1)
        self.assertEqual(snapshot(aid)['stocks']['components'],0)
        def colony_fixture(e):
            from starz.universe import generate_system,colonization_viability
            e.state.universe['levels']['astrophysics']=1
            e.state.stocks.update(components=100,refined_alloy=500,volatiles=500,ion_fuel=10000)
            for x in range(e.state.system_x-2,e.state.system_x+3):
                for y in range(e.state.system_y-2,e.state.system_y+3):
                    for i,planet in enumerate(generate_system(e.state.seed,x,y,e.catalog).planets):
                        if e.planet_key(x,y,i) not in e.state.occupied_planets and colonization_viability(planet,e.colonization_rules)=='VIABLE':
                            e._survey(x,y,e.state.last_updated)
                            return x,y,i
            self.fail('No physical colonial candidate')
        x,y,index=store.run(aid,colony_fixture)
        # The four-yard combat fixture has insufficient free workers for colonists.
        with self.assertRaisesRegex(DataValidationError,'População'):
            store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,{'ship_ids':[ships[1]['id']],'mission':'COLONIZE','x':x,'y':y,'planet_index':index,'cargo':{}}))
        store.run(aid,lambda e:setattr(e.state,'population_total',180))
        f=store.transaction(aid,lambda session,emp,e:store.dispatch(session,emp,e,{'ship_ids':[ships[1]['id']],'mission':'COLONIZE','x':x,'y':y,'planet_index':index,'cargo':{}}))
        now[0]=f['arrival_at'];store.tick()
        colonies=snapshot(aid)['planets'];self.assertEqual(len(colonies),2)
        with self.assertRaises(DataValidationError):store.run(bid,lambda e:None,planet_id=next(p['id'] for p in colonies if not p['home']))
        self.assertEqual(snapshot(aid)['campaign'] if 'campaign' in snapshot(aid) else None,None)
        # A completion boundary cannot apply new mining bonuses to earlier colony output.
        colony_id=next(p['id'] for p in colonies if not p['home'])
        def clean_colony(e):
            e.state.districts.update(ore_extractor=1,solar_field=10)
            e.state.population_total=100
            e.state.stocks['raw_ore']=0
        store.run(aid,clean_colony,planet_id=colony_id)
        start_at=now[0]
        store.run(aid,lambda e:e.research('extraction',now=e.state.last_updated))
        end=store.run(aid,lambda e:e.state.universe['research_domains']['civil']['complete_at'])
        now[0]=end;store.tick()
        ore=store.run(aid,lambda e:e.state.stocks['raw_ore'],planet_id=colony_id)
        self.assertAlmostEqual(ore,12*(end-start_at)/60,places=4)


    def test_domain_concurrency_offline_and_owned_persistence(self):
        now=[20000.0];store=PersistentStore(self.db,self.catalog,clock=lambda:now[0])
        with Session(self.db) as session,session.begin():
            a=store.create_player(session,'science-a');b=store.create_player(session,'science-b');aid,bid=a.id,b.id;bp=str(b.home_planet_id)
        def start(id):
            try:store.run(aid,lambda e:e.research(id,now=e.state.last_updated));return True
            except DataValidationError:return False
        with ThreadPoolExecutor(2) as pool:results=list(pool.map(start,['energy_engineering','computing']))
        self.assertEqual(sum(results),1)
        self.assertTrue(start('extraction'));self.assertTrue(start('naval_doctrine'))
        a=store.run(aid,lambda e:e.state.to_dict());self.assertEqual(sum(bool(j['active']) for j in a['universe']['research_domains'].values()),3)
        self.assertEqual(store.run(bid,lambda e:e.state.universe['levels']),{'orbital_engineering':1})
        with self.assertRaises(DataValidationError):store.run(aid,lambda e:e.research('logistics',now=e.state.last_updated),planet_id=bp)
        now[0]+=2000;store.tick();done=store.run(aid,lambda e:e.state.to_dict());levels=done['universe']['levels'];self.assertEqual(levels['extraction'],1);self.assertEqual(levels['naval_doctrine'],1)
        store.tick();self.assertEqual(store.run(aid,lambda e:e.state.universe['levels']),levels)

    def test_legacy_relational_research_is_promoted_without_losing_paid_work(self):
        now=[50000.0];store=PersistentStore(self.db,self.catalog,clock=lambda:now[0])
        with Session(self.db) as session,session.begin():
            empire=store.create_player(session,'legacy-science');aid=empire.id
        def legacy(e):
            e.state.universe.pop('research_domains',None)
            e.state.research.update(active='energy_engineering',remaining_work=17,complete_at=now[0]+17)
        store.run(aid,legacy)
        with Session(self.db) as session:
            e=load(session,session.get(m.Empire,aid),catalog=self.catalog)
            self.assertEqual(e.universe['research_domains']['fundamental']['remaining_work'],17)
            self.assertTrue(e.universe['research_domains']['fundamental']['legacy_rate'])
        now[0]+=17;store.tick()
        self.assertEqual(store.run(aid,lambda e:e.state.universe['levels']['energy_engineering']),1)
