import asyncio
import copy
import unittest
from unittest.mock import patch

import httpx

from starz import api
from starz.simulation import Engine


class ApiTests(unittest.TestCase):
    def test_http_action_contract_without_database(self):
        async def smoke():
            clock = 1000
            engine = Engine.new(api.catalog, now=clock)
            class MemoryService:
                def run(self, empire_id, call):
                    candidate = Engine(api.catalog, copy.deepcopy(engine.state))
                    candidate.advance(clock)
                    result = call(candidate)
                    engine.state = candidate.state
                    return result
            with patch.object(api.app.state, 'store', MemoryService(), create=True):
                api.app.state.default_empire_id = 'local'
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=api.app), base_url='http://test') as client:
                    async def post(endpoint, payload=None):
                        response = await client.post(endpoint, json=payload or {})
                        self.assertEqual(response.status_code, 200, response.text)
                        return response.json()
                    response = await client.get('/api/state')
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(len(response.json()['travel_modes']), 3)
                    self.assertEqual(response.json()['capacities']['industrial_capacity'], 0)
                    self.assertEqual(response.json()['capacities']['construction_slots'], 1)
                    no_ship = await client.post('/api/travel-preview', json={'target_x': 1, 'target_y': 0, 'propulsion_id': 'chemical_drive', 'mode': 'NORMAL'})
                    self.assertEqual(no_ship.status_code, 400)
                    clock += 60
                    job = await post('/api/build', {'id': 'processor'})
                    blocked = await client.post('/api/build', json={'id': 'solar_field'})
                    self.assertEqual(blocked.status_code, 400)
                    clock = job['complete_at']
                    await client.get('/api/state')
                    job = await post('/api/research', {'id': 'orbital_engineering'})
                    clock = job['complete_at']
                    response = await client.get('/api/state')
                    self.assertIn('orbital_shipyard', response.json()['unlocked_content'])
                    job = await post('/api/build', {'id': 'orbital_shipyard'})
                    clock = job['complete_at']
                    ship = await post('/api/build-ship')
                    blocked = await client.post('/api/build-ship', json={})
                    self.assertEqual(blocked.status_code, 400)
                    clock = ship['ready_at']
                    x, y = engine.state.system_x, engine.state.system_y
                    payload = {'target_x': x + 2, 'target_y': y, 'propulsion_id': 'chemical_drive', 'mode': 'NORMAL', 'ship_id': ship['id']}
                    previews = await post('/api/travel-preview', payload)
                    self.assertEqual(previews['NORMAL']['distance'], 2)
                    self.assertLess(previews['ECONOMY']['fuel_cost'], previews['FORCED']['fuel_cost'])
                    fuel_before = engine.state.stocks['ion_fuel']
                    first = await post('/api/travel', payload)
                    clock = first['arrival_at']
                    response = await client.get('/api/state')
                    self.assertEqual(response.json()['fleets'][0]['x'], x + 2)
                    self.assertEqual(response.json()['fleets'][0]['status'], 'ARRIVED')
                    payload.pop('ship_id')
                    payload.update(fleet_id=first['id'], target_x=x + 3)
                    previews = await post('/api/travel-preview', payload)
                    self.assertEqual(previews['NORMAL']['distance'], 1)
                    self.assertEqual(previews['NORMAL']['eta_seconds'], 180)
                    second = await post('/api/travel', payload)
                    self.assertEqual(first['id'], second['id'])
                    clock = second['arrival_at']
                    response = await client.get('/api/state')
                    self.assertEqual(response.json()['fleets'][0]['x'], x + 3)
                    self.assertEqual(response.json()['fleets'][0]['eta'], 0)
                    self.assertEqual(engine.state.stocks['ion_fuel'], fuel_before - 30)
                    self.assertTrue(all(value >= 0 for value in engine.state.stocks.values()))
                    invalid = await client.post('/api/travel', json={**payload, 'target_x': 200})
                    self.assertEqual(invalid.status_code, 422)
        asyncio.run(smoke())
