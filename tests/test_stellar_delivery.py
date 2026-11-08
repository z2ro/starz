"""End-to-end P3: paid manufacturing, real fleet manifests, five timed phases."""
import os
import unittest
from uuid import UUID, uuid4
from sqlalchemy import select
from sqlalchemy.orm import Session
from starz.db import models as m
from starz.data import DataValidationError
from starz.persistent import stellar
import test_planetary_defense as fixtures


@unittest.skipUnless(os.getenv('PERSISTENT_TEST_DATABASE_URL'),'isolated stellar PostgreSQL required')
class StellarDelivery(unittest.TestCase):
    @classmethod
    def setUpClass(cls):fixtures.DefensePersistence.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):fixtures.DefensePersistence.tearDownClass.__func__(cls)

    def prepare(self):
        store,now,a,b=fixtures.DefensePersistence.prepare(self)
        state=store.run(a,lambda e:e.state.to_dict())
        with Session(self.db) as session:occupied={(s.x,s.y) for s in session.scalars(select(m.StarSystem))}
        x,y=next((state['system_x']+dx,state['system_y']+dy) for dx in range(-2,3) for dy in range(-2,3) if (state['system_x']+dx,state['system_y']+dy) not in occupied)
        store.run(a,lambda e:e.state.system_knowledge.update({f'{x}:{y}':now[0]}))
        project=store.transaction(a,lambda session,emp,e:stellar.reserve(session,emp,e,x,y,uuid4().hex))
        store.run(a,lambda e:e.state.districts.update(orbital_shipyard=2))
        ships=[store.run(a,lambda e:e.build_ship('wayfarer_hull',now=e.state.last_updated)) for _ in range(2)]
        modules=[store.transaction(a,lambda session,emp,e,kind=kind:stellar.manufacture(session,emp,e,kind,uuid4().hex)) for kind in stellar.MODULE_KINDS]
        now[0]+=1000;store.tick()
        request={'ship_ids':[s['id'] for s in ships],'mission':'STELLAR_DELIVERY','stellar_project_id':project['project_id'],'module_ids':[mod['module_id'] for mod in modules],'cargo':{'fusion_fuel':100},'x':x,'y':y}
        store.run(a,lambda e:e.state.stocks.update(fusion_fuel=1000))
        return store,now,a,b,project,request

    def test_T12_all_phases_real_delivery_and_removal_at_stabilization(self):
        store,now,a,b,project,request=self.prepare()
        with self.assertRaises(DataValidationError):store.transaction(a,lambda session,emp,e:stellar.start_phase(session,emp,e,project['project_id'],uuid4().hex))
        before=store.run(a,lambda e:e.state.stocks['fusion_fuel'])
        fleet=store.transaction(a,lambda session,emp,e:store.dispatch(session,emp,e,request))
        with Session(self.db) as session:
            modules=list(session.scalars(select(m.StellarModule).where(m.StellarModule.project_id==UUID(project['project_id']))))
            self.assertEqual(len(modules),5);self.assertTrue(all(u.status=='transit' and str(u.fleet_id)==fleet['id'] for u in modules))
        now[0]=fleet['arrival_at'];store.tick();store.tick()
        with Session(self.db) as session:
            p=session.get(m.StellarProject,UUID(project['project_id']))
            self.assertEqual(p.stocks['fusion_fuel'],100)
            self.assertTrue(all(u.status=='delivered' for u in session.scalars(select(m.StellarModule).where(m.StellarModule.project_id==p.id))))
        for phase in range(1,6):
            key=uuid4().hex
            job=store.transaction(a,lambda session,emp,e:stellar.start_phase(session,emp,e,project['project_id'],key))
            self.assertEqual(job,store.transaction(a,lambda session,emp,e:stellar.start_phase(session,emp,e,project['project_id'],key)))
            now[0]=job['complete_at'];store.tick();store.tick()
            with Session(self.db) as session:
                p=session.get(m.StellarProject,UUID(project['project_id']));source=session.get(m.StellarSource,p.source_id)
                self.assertEqual(p.completed_phases,phase)
                self.assertEqual(source.removed_at is not None,phase>=2)
            if phase==2:
                from starz.api import galaxy_snapshot
                sky=store.run(a,lambda e:galaxy_snapshot(e,(e.state.system_x,e.state.system_y),3))
                target=next(s for s in sky['systems'] if (s['x'],s['y'])==(request['x'],request['y']))
                self.assertFalse(target['star']['present']);self.assertEqual(target['star']['canonical_star_id'],project['source_id'])
                self.assertTrue(target['planets']);self.assertFalse(target['planets'][0]['colonization']['eligible'])
        with Session(self.db) as session:
            units=list(session.scalars(select(m.StellarUnit).where(m.StellarUnit.source_id==UUID(project['source_id']))))
            self.assertEqual(len(units),1);unit=units[0]
            self.assertEqual(unit.state,'operational');self.assertEqual(unit.stocks['fusion_fuel'],100)
            self.assertEqual(set(unit.payload['subsystems']),set(stellar.MODULE_KINDS))
        with self.assertRaises(DataValidationError):store.transaction(a,lambda session,emp,e:stellar.start_phase(session,emp,e,project['project_id'],uuid4().hex))

    def test_recall_returns_same_modules_and_cargo_without_delivering(self):
        store,now,a,b,project,request=self.prepare()
        fleet=store.transaction(a,lambda session,emp,e:store.dispatch(session,emp,e,request))
        now[0]+=1
        returned=store.transaction(a,lambda session,emp,e:store.recall(session,emp,e,fleet['id']))
        now[0]=returned['arrival_at'];store.tick();store.tick()
        with Session(self.db) as session:
            modules=[session.get(m.StellarModule,UUID(id)) for id in request['module_ids']]
            self.assertTrue(all(u.status=='ready' and u.project_id is None and u.fleet_id is None for u in modules))
            self.assertEqual(session.get(m.StellarProject,UUID(project['project_id'])).stocks,{})
