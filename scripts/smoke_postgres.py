"""HTTP smoke against a NEW local Compose game; keeps its final state and volume."""
import argparse
import json
import subprocess
import time
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://localhost:8000')
    args = parser.parse_args()

    def request(path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(args.url + path, data=data, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.load(response)

    def wait_until(stamp):
        # Only the smoke harness waits; the application never ticks or schedules work.
        while time.time() < stamp:
            time.sleep(min(1, stamp - time.time()))

    def restart_app():
        subprocess.run(['docker', 'compose', 'restart', 'app'], check=True)
        subprocess.run(['docker', 'compose', 'up', '-d', '--wait'], check=True)

    state = request('/api/state')
    assert not state['construction'] and not state['ships'] and not state['research']['completed'], 'Use a fresh dev game; this smoke does not erase existing progress.'
    x, y = state['system']['x'], state['system']['y']
    print('Bootstrap and GET /api/state OK', flush=True)
    job = request('/api/build', {'id': 'processor'})
    # Keep app offline across a construction boundary; database stays up.
    subprocess.run(['docker', 'compose', 'stop', 'app'], check=True)
    wait_until(job['complete_at'] + 2)
    subprocess.run(['docker', 'compose', 'up', '-d', '--wait'], check=True)
    state = request('/api/state')
    assert state['districts']['processor'] == 1
    print('Construction completed while app was stopped', flush=True)
    research = request('/api/research', {'id': 'orbital_engineering'})
    state = request('/api/state')
    assert 0 < state['research']['remaining_work'] <= research['remaining_work']
    wait_until(research['complete_at'] + 1)
    assert 'orbital_shipyard' in request('/api/state')['unlocked_content']
    print('Research remaining_work and unlock OK', flush=True)
    job = request('/api/build', {'id': 'orbital_shipyard'})
    wait_until(job['complete_at'] + 1)
    ship = request('/api/build-ship', {})
    wait_until(ship['ready_at'] + 1)
    print('Shipyard and ship OK', flush=True)
    payload = {'target_x': x+1, 'target_y': y, 'propulsion_id': 'chemical_drive', 'mode': 'FORCED', 'ship_id': ship['id']}
    preview = request('/api/travel-preview', payload)
    assert preview['FORCED']['distance'] == 1
    fleet = request('/api/travel', payload)
    restart_app()
    assert request('/api/state')['fleets'][0]['id'] == fleet['id']
    subprocess.run(['docker', 'compose', 'stop', 'app'], check=True)
    wait_until(fleet['arrival_at'] + 1)
    subprocess.run(['docker', 'compose', 'up', '-d', '--wait'], check=True)
    state = request('/api/state')
    assert state['fleets'][0]['x'] == x+1 and state['fleets'][0]['status'] == 'ARRIVED'
    print('A→B survived restart and completed while offline', flush=True)
    payload.pop('ship_id')
    payload.update(fleet_id=fleet['id'], target_x=x+2)
    preview = request('/api/travel-preview', payload)
    assert preview['FORCED']['origin'] == [x+1, y] and preview['FORCED']['distance'] == 1
    second = request('/api/travel', payload)
    assert second['id'] == fleet['id']
    wait_until(second['arrival_at'] + 1)
    restart_app()
    state = request('/api/state')
    assert state['fleets'][0]['x'] == x+2 and state['fleets'][0]['status'] == 'ARRIVED'
    print('B→C and second app restart OK', flush=True)
    before = state['stocks']['ion_fuel']
    subprocess.run(['docker', 'compose', 'down'], check=True)
    subprocess.run(['docker', 'compose', 'up', '-d', '--wait'], check=True)
    state = request('/api/state')
    assert state['fleets'][0]['id'] == fleet['id'] and state['fleets'][0]['x'] == x+2
    assert state['stocks']['ion_fuel'] == before
    print('PASS: Compose recreation kept universe, fleet at C and fuel; volume preserved.', flush=True)


if __name__ == '__main__':
    main()
