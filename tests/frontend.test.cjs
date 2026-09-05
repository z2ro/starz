const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function browser() {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: '', textContent: '', querySelectorAll: () => [] });
    return elements.get(selector);
  };
  const state = {
    system: { name: 'Home', x: 0, y: 0, star: {}, planet: {} }, stocks: {},
    capacities: { energy_generation: 8, energy_consumption: 2, industrial_capacity: 2, construction_slots: 1, construction_slots_available: 0, shipyard_slots: 1, shipyard_slots_available: 1, effective_research_rate: .5 }, population: { total: 100 },
    districts: {}, research: { active: null }, notices: [],
    ships: [{ id: 'ship', propulsion_id: 'chemical_drive', ready_at: 0 }],
    fleets: [{ id: 'fleet', name: 'Fleet', status: 'ARRIVED', x: 3, y: 0, destination_x: 3, destination_y: 0, ship_ids: ['ship'], eta: 0, propulsion: 'chemical_drive' }],
    travel_modes: [{ id: 'CUSTOM', name: 'Custom mode' }],
  };
  const calls = [];
  let response = { ok: true, json: async () => state };
  const context = vm.createContext({ document: { querySelector: element }, fetch: async (url, options) => { calls.push({ url, options }); return response; } });
  vm.runInContext(readFileSync('frontend/app.js', 'utf8'), context);
  return { context, calls, element, state, respond: value => { response = value; } };
}

test('ARRIVED fleet, catalog mode and new destination are sent to both endpoints', async () => {
  const b = browser();
  await vm.runInContext('load()', b.context);
  assert.match(b.element('#app').innerHTML, /Posição 3:0/);
  assert.match(b.element('#app').innerHTML, /Custom mode/);
  assert.match(b.element('#app').innerHTML, /Indústria nominal: 2/);
  assert.match(b.element('#app').innerHTML, /Construções livres: 0\/1/);
  assert.match(b.element('#app').innerHTML, /Estaleiro livre: 1\/1/);
  assert.match(b.element('#app').innerHTML, /Taxa efetiva: 0.5/);
  vm.runInContext('destination = {x: 4, y: 0}', b.context);
  b.respond({ ok: true, json: async () => ({ CUSTOM: { origin: [3, 0], distance: 1, eta_seconds: 180, fuel_cost: 10, heat: 1, signature: 1 } }) });
  await vm.runInContext("act('preview')", b.context);
  const preview = JSON.parse(b.calls.at(-1).options.body);
  assert.equal(preview.fleet_id, 'fleet');
  assert.equal(preview.mode, 'CUSTOM');
  assert.equal(preview.target_x, 4);
  assert.match(b.element('#route-preview').innerHTML, /origem 3:0/);
  b.respond({ ok: true, json: async () => b.state });
  await vm.runInContext("act('travel')", b.context);
  const sent = b.calls.find(call => call.url === '/api/travel');
  assert.deepEqual(JSON.parse(sent.options.body), preview);
});

test('API errors are shown without rendering an invalid preview', async () => {
  const b = browser();
  await vm.runInContext('load()', b.context);
  b.respond({ ok: false, json: async () => ({ detail: 'frota em trânsito' }) });
  await vm.runInContext("act('preview')", b.context);
  assert.equal(b.element('#action-error').textContent, 'frota em trânsito');
  assert.doesNotMatch(b.element('#route-preview').innerHTML, /NaN|undefined/);
});
