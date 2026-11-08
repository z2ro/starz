"""Physical module transfer contracts; manufacture identity is immutable."""
from types import SimpleNamespace
from uuid import uuid4
from unittest import TestCase
from unittest.mock import MagicMock

from starz.data import DataValidationError
from starz.db import models as m
from starz.db.store import utc
from starz.persistent import stellar_delivery as delivery


class ModuleTransport(TestCase):
    def fixture(self):
        empire=SimpleNamespace(id=uuid4(),universe_id=uuid4())
        origin,target=uuid4(),uuid4()
        module=SimpleNamespace(id=uuid4(),empire_id=empire.id,universe_id=empire.universe_id,
            current_planet_id=origin,origin_planet_id=uuid4(),status='ready',operation_id=None,project_id=None)
        planet=SimpleNamespace(id=target,empire_id=empire.id,system_id=uuid4())
        engine=SimpleNamespace(state=SimpleNamespace(planet_id=str(origin),universe={'levels':{'stellar_logistics':1}}))
        session=MagicMock();session.get.return_value=module
        return session,empire,engine,module,planet

    def test_manifest_rejects_foreign_reserved_or_duplicate_modules(self):
        session,empire,e,module,target=self.fixture()
        self.assertEqual(delivery.colony_manifest(session,empire,e,target,[str(module.id)]),[module])
        for field,value in [('empire_id',uuid4()),('current_planet_id',uuid4()),('operation_id',uuid4()),('status','committed')]:
            old=getattr(module,field);setattr(module,field,value)
            with self.assertRaises(DataValidationError):delivery.colony_manifest(session,empire,e,target,[str(module.id)])
            setattr(module,field,old)
        with self.assertRaises(DataValidationError):delivery.colony_manifest(session,empire,e,target,[str(module.id)]*2)
        target.empire_id=uuid4()
        with self.assertRaises(DataValidationError):delivery.colony_manifest(session,empire,e,target,[str(module.id)])

    def test_arrival_moves_same_module_and_recall_restores_departure_not_manufacture(self):
        session,empire,e,module,target=self.fixture()
        manufacture=module.origin_planet_id;departure=module.current_planet_id;fleet=uuid4();order_id=uuid4()
        module.status='transit';module.fleet_id=fleet;module.delivery_order_id=order_id
        order=SimpleNamespace(id=order_id,empire_id=empire.id,universe_id=empire.universe_id,
            due_at=utc(1000),payload={'fleet_id':str(fleet),'module_ids':[str(module.id)]})
        e.state.fleets=[{'id':str(fleet),'status':'ARRIVED','x':1,'y':2}]
        session.get.side_effect=lambda model,key:SimpleNamespace(x=1,y=2) if model is m.StarSystem else module
        delivery.deliver_colony(session,order,e,target)
        self.assertEqual(module.current_planet_id,target.id);self.assertEqual(module.origin_planet_id,manufacture)
        with self.assertRaises(DataValidationError):delivery.deliver_colony(session,order,e,target)
        module.status='transit';module.fleet_id=fleet;module.current_planet_id=departure
        delivery.return_modules(session,order,str(departure))
        self.assertEqual(module.current_planet_id,departure);self.assertEqual(module.origin_planet_id,manufacture)
        self.assertEqual(module.status,'ready');self.assertIsNone(module.fleet_id)
