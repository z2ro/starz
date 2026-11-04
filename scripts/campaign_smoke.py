"""One real HTTP campaign: no stock injection, instant research or objective overrides.
Run only against compose.experiment.yaml. Creates new saves; never deletes one.
"""
import argparse
import json
from pathlib import Path
import httpx


class CampaignPilot:
    def __init__(self, url, output):
        self.client = httpx.Client(base_url=url, timeout=30)
        self.output = Path(output); self.output.mkdir(parents=True, exist_ok=True)
        self.history = []
        self.catalog = self.client.get('/api/catalog').raise_for_status().json()

    def state(self):
        return self.client.get('/api/state').raise_for_status().json()

    def post(self, endpoint, payload):
        response = self.client.post('/api/' + endpoint, json=payload)
        if response.status_code != 200:
            s = self.state()
            raise AssertionError(f"T{s['campaign']['turn']} {endpoint} {payload}: {response.text}\nstocks={s['stocks']} capacities={s['capacities']}")
        self.history.append({'endpoint': endpoint, 'payload': payload, 'result': response.json()})
        return response.json()

    def act(self, action, **payload):
        return self.post('campaign/order', dict(action=action, **payload))

    def end(self):
        s = self.state(); c = s['campaign']
        assert c['phase'] == 'PLAYING', c
        if c['event']:
            choice = {'relic': 'preserve', 'refugees': 'welcome', 'flare': 'harden', 'embargo': 'pay'}[c['event']['id']]
            self.act('event', choice=choice)
        self.act('end_turn')
        assert self.state()['campaign']['phase'] != 'DEFEAT', self.state()['campaign']

    def budget(self):
        if not self.state()['campaign']['orders']: self.end()

    def afford(self, cost):
        for _ in range(15):
            s = self.state()
            if all(s['stocks'].get(k, 0) >= v for k, v in cost.items()): return
            self.end()
        raise AssertionError(f'Unaffordable {cost}')

    def build(self, id, desired=1):
        item = next(d for d in self.catalog['districts'] if d['id'] == id)
        for _ in range(15):
            s = self.state()
            if s['districts'].get(id, 0) >= desired: return
            if any(j['id'] == id for j in s['construction']): self.end(); continue
            if not s['capacities']['construction_slots_available']: self.end(); continue
            if s['capacities']['energy_generation'] - s['capacities']['energy_consumption'] < item['energy_consumption']:
                self.build('solar_field', s['districts'].get('solar_field', 0) + 1); continue
            if s['population']['available'] < item['workforce']:
                if id == 'civil_district':
                    self.end(); continue
                self.build('civil_district', s['districts'].get('civil_district', 0) + 1); continue
            self.afford(item['cost']); self.budget(); self.post('build', {'id': id}); self.end()
        raise AssertionError(f'Could not build {id}')

    def research(self, id):
        if id in self.state()['research']['completed']: return
        item = next(t for t in self.catalog['technologies'] if t['id'] == id)
        for req in item['requires']:
            if any(t['id'] == req for t in self.catalog['technologies']): self.research(req)
        self.afford(item['cost']); self.budget(); self.post('research', {'id': id})
        for _ in range(8):
            if id in self.state()['research']['completed']: return
            self.end()
        raise AssertionError('Stalled research ' + id)

    def ship(self, id):
        old = next((s for s in self.state()['ships'] if s['hull_id'] == id), None)
        if old: return old
        item = next(h for h in self.catalog['ships'] if h['id'] == id)
        self.afford(item['cost']); self.budget()
        propulsion = item['compatible_propulsion'][0]
        fuel = next(p for p in self.catalog['propulsion'] if p['id'] == propulsion)['compatible_fuels'][0]
        result = self.post('build-ship', {'hull_id': id, 'propulsion_id': propulsion, 'fuel_id': fuel})
        while self.state()['observed_at'] < result['ready_at']: self.end()
        return result

    def move(self, ship, x, y, survey=False, index=None):
        self.budget()
        self.act('colonize' if index is not None else 'survey' if survey else 'dispatch', ship_id=ship['id'], x=x, y=y, planet_index=index)
        for _ in range(8):
            s = self.state(); fleet = next(f for f in s['fleets'] if ship['id'] in f['ship_ids'])
            if fleet['status'] == 'ARRIVED': return
            self.end()
        raise AssertionError('Fleet did not arrive')

    def checkpoint(self, name):
        s = self.state(); self.output.joinpath(name + '.json').write_text(json.dumps(s, indent=2, ensure_ascii=False))
        print(name, 'turn', s['campaign']['turn'], s['campaign']['phase'], flush=True)

    def run(self):
        self.post('campaign/new', {'seed': 'STARZ-CONCORDAT'})
        self.checkpoint('opening')
        self.build('processor'); self.build('volatile_well'); self.build('fuel_refinery')
        self.research('orbital_engineering'); self.build('orbital_shipyard')
        scout = self.ship('scout_hull'); s = self.state(); home = next(p for p in s['planets'] if p['home'])
        self.research('industrial_automation'); self.build('manufacturing'); self.research('diplomatic_charter')
        for rival in self.state()['campaign']['rivals']:
            self.move(scout, rival['x'], rival['y'], survey=True)
            while next(r for r in self.state()['campaign']['rivals'] if r['id'] == rival['id'])['relation'] < 60:
                self.afford({'components': 15}); self.budget(); self.act('envoy', target=rival['id'])
            self.afford({'components': 40}); self.budget(); self.act('alliance', target=rival['id'])
            self.move(scout, home['x'], home['y'])
        self.build('civil_district', 2); self.build('ore_extractor', 2); self.build('processor', 2)
        self.build('manufacturing', 2); self.build('research_lab', 2)
        for target in self.state()['campaign']['sector'][:2]:
            self.move(scout, target['x'], target['y'], survey=True)
            index = next(t['planet_index'] for t in self.state()['campaign']['sector'] if t['x'] == target['x'] and t['y'] == target['y'])
            self.move(scout, home['x'], home['y'])
            self.move(scout, target['x'], target['y'], index=index)
            self.move(scout, home['x'], home['y'])
        self.checkpoint('colonies')
        cargo = self.ship('wayfarer_hull'); dest = next(p for p in self.state()['planets'] if not p['home'])
        self.budget(); self.act('cargo', ship_id=cargo['id'], target=dest['id'], resource='refined_alloy', amount=30)
        while not self.state()['campaign']['deliveries']: self.end()
        self.move(cargo, home['x'], home['y'])
        self.budget(); self.act('trade', target='helion')
        for tech in ['nuclear_propulsion', 'naval_doctrine', 'survey_network', 'capital_architecture', 'carrier_operations', 'stellar_containment']: self.research(tech)
        science = self.ship('odyssey_hull'); self.budget(); self.act('analyze', ship_id=science['id'])
        self.checkpoint('endgame')
        self.afford({'refined_alloy': 500, 'components': 190}); self.budget(); self.act('project')
        while self.state()['campaign']['phase'] == 'PLAYING': self.end()
        assert self.state()['campaign']['phase'] == 'VICTORY'
        self.checkpoint('victory')
        winning_save = next(s['id'] for s in self.client.get('/api/campaign/saves').json() if s['active'])
        self.post('campaign/new', {'seed': 'STARZ-CONCORDAT-DEFEAT'})
        while self.state()['campaign']['phase'] == 'PLAYING':
            s = self.state()
            if s['campaign']['event']: self.act('event', choice=s['campaign']['event']['choices'][-1])
            self.act('end_turn')
        assert self.state()['campaign']['phase'] == 'DEFEAT'
        self.checkpoint('defeat')
        self.post('campaign/load', {'empire_id': winning_save})
        assert self.state()['campaign']['phase'] == 'VICTORY'
        self.output.joinpath('commands.json').write_text(json.dumps(self.history, indent=2, ensure_ascii=False))
        print('PASS: new game → real victory; new game → real defeat; persisted victory reload', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8020')
    parser.add_argument('--output', default='tmp/complete-game-qa')
    args = parser.parse_args()
    CampaignPilot(args.url, args.output).run()
