const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const base = { cost: {}, requires: [] };
const catalog = {
  resources: [
    { ...base, id: 'raw_ore', name: 'Ferrita do catálogo', description: 'Raw', category: 'natural' },
    { ...base, id: 'refined_alloy', name: 'Liga refinada', description: 'Alloy', category: 'material' },
    { ...base, id: 'components', name: 'Componentes', description: 'Parts', category: 'component' },
  ],
  fuels: [{ ...base, id: 'ion_fuel', name: 'Combustível iônico', description: 'Fuel', category: 'fuel', energy_density: 1, storage_factor: 1 }],
  districts: [
    { ...base, id: 'processor', name: 'Processador do catálogo', description: 'Converte recursos.', category: 'Industrial', duration: 28, workforce: 6, energy_generation: 0, energy_consumption: 4, production: { refined_alloy: 1 }, processing: { raw_ore: 1.5 }, research_rate: 0, population_capacity: 0, industrial_capacity: 2, construction_slots: 0, shipyard_slots: 0 },
    { ...base, id: 'orbital_shipyard', name: 'Estaleiro orbital', description: 'Monta naves.', category: 'Logistics', duration: 60, workforce: 10, energy_generation: 0, energy_consumption: 6, production: {}, processing: {}, research_rate: 0, population_capacity: 0, industrial_capacity: 0, construction_slots: 0, shipyard_slots: 1 },
  ],
  technologies: [
    { ...base, id: 'orbital_engineering', name: 'Engenharia orbital', description: 'Libera órbita.', category: 'orbital', duration: 45, unlocks: ['orbital_shipyard'] },
    { ...base, id: 'nuclear_propulsion', name: 'Propulsão nuclear', description: 'Motor avançado.', category: 'propulsion', duration: 75, requires: ['orbital_engineering'], unlocks: ['nuclear_drive'] },
  ],
  ships: [{ ...base, id: 'scout_hull', name: 'Horizon', description: 'Corveta leve.', category: 'hull', classification: 'corvette', role: 'exploration', mass: 10, crew: 3, duration: 30, compatible_propulsion: ['chemical_drive'] }],
  propulsion: [{ ...base, id: 'chemical_drive', name: 'Propulsor químico', description: 'Robusto.', category: 'chemical', compatible_fuels: ['ion_fuel'], speed_factor: 1, fuel_efficiency: 1, thermal_load: 1, signature: 1 }],
  travel_modes: [
    { ...base, id: 'ECONOMY', name: 'Economy', description: 'Slow', category: 'travel', travel_time_modifier: 1.5, fuel_modifier: .6, thermal_modifier: .8, signature_modifier: .8 },
    { ...base, id: 'NORMAL', name: 'Normal', description: 'Normal', category: 'travel', travel_time_modifier: 1, fuel_modifier: 1, thermal_modifier: 1, signature_modifier: 1 },
    { ...base, id: 'FORCED', name: 'Forced', description: 'Fast', category: 'travel', travel_time_modifier: .6, fuel_modifier: 2, thermal_modifier: 1.8, signature_modifier: 1.8 },
  ],
};

const state = {
  system: { name: 'Asterion 0:0', x: 0, y: 0, star: { stellar_class: 'G', mass: 1, luminosity: 1.1, age: 4, activity: .3 }, planet: { name: 'Gaia', mass: 1, radius: 1, gravity: 1, orbital_distance: 1, temperature: 288, atmosphere: 'nitrogen', radiation: .2, magnetic_field: 1.1, water: 66, geological_activity: .4, mineral_profile: { raw_ore: 1.2 }, usable_surface: 72 } },
  stocks: { raw_ore: 220, refined_alloy: 140, components: 55, ion_fuel: 80 },
  capacities: { energy_generation: 24, energy_consumption: 10, energy_coverage: 1, industrial_capacity: 2, construction_slots: 1, construction_slots_available: 1, shipyard_slots: 1, shipyard_slots_available: 1, effective_research_rate: 1, workforce_supply: 97, workforce_demand: 20, workforce_coverage: 1, crew_committed: 3 },
  population: { total: 100, available: 77, capacity: 180 }, districts: { processor: 1, orbital_shipyard: 1 }, construction: [],
  research: { active: null, complete_at: null, completed: ['orbital_engineering'], remaining_work: 0 }, notices: ['Estaleiro concluído.'], unlocked_content: ['orbital_shipyard'],
  ships: [{ id: 'ship', hull_id: 'scout_hull', propulsion_id: 'chemical_drive', fuel_id: 'ion_fuel', crew: 3, mass: 10, ready_at: 0 }],
  fleets: [{ id: 'fleet', name: 'Fleet 01', status: 'ARRIVED', mission: 'MOVE', x: 0, y: 0, destination_x: 0, destination_y: 0, ship_ids: ['ship'], eta: 0, propulsion: 'chemical_drive', mode: 'NORMAL', fuel_cost: 10, departure_at: 0, arrival_at: 0 }],
  travel_modes: catalog.travel_modes,
  active_planet: { id: 'home-planet', planet_index: 0, home: true },
  planets: [{ id: 'home-planet', name: 'Gaia', x: 0, y: 0, planet_index: 0, population_total: 100, home: true }],
};
const galaxy = { center: [0, 0], home: [0, 0], radius: 1, systems: [
  { id: 'home', name: 'Home', x: 0, y: 0, distance: 0, home: true, knowledge_level: 'SURVEYED', star: { stellar_class: 'G', luminosity: 1, activity: .2 }, planet: { name: 'Gaia', gravity: 1, temperature: 288, water: 66, radiation: .2 } },
  { id: '1:0', x: 1, y: 0, distance: 1, home: false, knowledge_level: 'UNKNOWN' },
] };

async function browser() {
  const app = { innerHTML: '', textContent: '', onclick: null, onchange: null, setAttribute() {} };
  const location = { hash: '#/overview' };
  const calls = [];
  let next;
  const context = vm.createContext({
    document: { querySelector: () => app }, location,
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (next) { const response = next; next = undefined; return response; }
      const value = url === '/api/catalog' ? catalog : url.startsWith('/api/galaxy') ? galaxy : state;
      return { ok: true, json: async () => value };
    },
    Request: class {}, Date, Intl,
  });
  vm.runInContext(readFileSync('frontend/app.js', 'utf8'), context);
  await vm.runInContext('boot()', context);
  return { app, context, location, calls, respond: response => { next = response; } };
}

test('Overview renders a game shell and catalog-driven planet summary', async () => {
  const b = await browser();
  assert.match(b.app.innerHTML, /CENTRO DE COMANDO/);
  assert.match(b.app.innerHTML, /Ferrita do catálogo/);
  assert.match(b.app.innerHTML, /planet-sphere/);
  assert.match(b.app.innerHTML, /Visão geral/);
  assert.doesNotMatch(b.app.innerHTML, /\{&quot;|\[object Object\]/);
});

test('hash navigation renders Economy, Research, Shipyard and Fleets states', async () => {
  const b = await browser();
  for (const [route, text] of [['economy', 'Capacidade nominal'], ['research', 'CONCLUÍDA'], ['shipyard', 'Slots totais'], ['fleets', 'PRONTA']]) {
    b.location.hash = `#/${route}`;
    vm.runInContext('render()', b.context);
    assert.match(b.app.innerHTML, new RegExp(text));
  }
  assert.match(b.app.innerHTML, /Fleet 01/);
  b.location.hash = '#/shipyard';
  vm.runInContext('render()', b.context);
  assert.match(b.app.innerHTML, /Horizon/);
  assert.match(b.app.innerHTML, /Corveta · Exploração/);
});

test('Galaxy separates UNKNOWN from SURVEYED details', async () => {
  const b = await browser();
  b.location.hash = '#/galaxy';
  vm.runInContext('render()', b.context);
  assert.match(b.app.innerHTML, /SURVEYED/);
  assert.match(b.app.innerHTML, /Gaia/);
  vm.runInContext("selectedSystem = galaxyData.systems.find(s => s.id === '1:0'); render()", b.context);
  assert.match(b.app.innerHTML, /UNKNOWN/);
  assert.match(b.app.innerHTML, /Sistema não mapeado/);
  assert.doesNotMatch(b.app.innerHTML, /Kara/);
});

test('Galaxy selection sends SURVEY and supports operational recentering', async () => {
  const b = await browser();
  b.location.hash = '#/galaxy';
  vm.runInContext("selectedSystem = galaxyData.systems.find(s => s.id === '1:0'); selectedSubject = 'fleet:fleet'; render()", b.context);
  assert.match(b.app.innerHTML, /Sistema 1:0/);
  const preview = Object.fromEntries(catalog.travel_modes.map(mode => [mode.id, { origin: [0, 0], destination: [1, 0], distance: 1, eta_seconds: mode.id === 'FORCED' ? 60 : 120, fuel_cost: mode.id === 'ECONOMY' ? 6 : 10, heat: mode.thermal_modifier, signature: mode.signature_modifier }]));
  b.respond({ ok: true, json: async () => preview });
  await vm.runInContext("perform('preview')", b.context);
  const payload = JSON.parse(b.calls.at(-1).options.body);
  assert.equal(payload.target_x, 1);
  assert.equal(payload.fleet_id, 'fleet');
  assert.equal(payload.mission, 'SURVEY');
  assert.match(b.app.innerHTML, /Combustível/);
  assert.match(b.app.innerHTML, /Assinatura/);
  assert.match(b.app.innerHTML, /Explorar sistema/);
  await vm.runInContext('recenter(0, 0)', b.context);
  assert.match(b.calls.at(-1).url, /center_x=0&center_y=0/);
});

test('API errors become readable in-game feedback', async () => {
  const b = await browser();
  b.respond({ ok: false, json: async () => ({ detail: 'slots de construção ocupados' }) });
  await vm.runInContext("perform('build', 'processor')", b.context);
  assert.match(b.app.innerHTML, /toast error/);
  assert.match(b.app.innerHTML, /slots de construção ocupados/);
  assert.doesNotMatch(b.app.innerHTML, /\[object Object\]/);
});

test('planet selector and colonization order use explicit targets', async () => {
  const b = await browser();
  b.location.hash = '#/planet';
  vm.runInContext('render()', b.context);
  assert.match(b.app.innerHTML, /PLANETA ATIVO/);
  assert.match(b.app.innerHTML, /planet-3d-stage/);
  assert.match(b.app.innerHTML, /planet-sphere/);
  b.location.hash = '#/galaxy';
  vm.runInContext("selectedSystem = {...galaxyData.systems[0], home: false, planets: [{planet_index: 1, name: 'Aurelia II', gravity: 1, temperature: 290, water: 40, radiation: .2, viability: 'VIABLE', ownership: 'UNCLAIMED', colonization: {eligible: true, reason: null, population: 20, cost: {components: 10}}}]}; selectedPlanetIndex = 1; selectedSubject = 'fleet:fleet'; render()", b.context);
  assert.match(b.app.innerHTML, /Aurelia II/);
  b.respond({ ok: true, json: async () => Object.fromEntries(catalog.travel_modes.map(mode => [mode.id, { origin: [0, 0], destination: [0, 0], distance: 1, eta_seconds: 60, fuel_cost: 10, heat: 1, signature: 1 }])) });
  await vm.runInContext("perform('preview')", b.context);
  assert.match(b.app.innerHTML, /Colonizar planeta/);
  const payload = JSON.parse(b.calls.at(-1).options.body);
  assert.equal(payload.mission, 'COLONIZE');
  assert.equal(payload.target_planet_index, 1);
  assert.equal(payload.fleet_id, 'fleet');
  b.respond({ ok: true, json: async () => ({ id: 'fleet' }) });
  await vm.runInContext("perform('travel')", b.context);
  const sent = b.calls.findLast(call => call.url === '/api/travel');
  assert.equal(JSON.parse(sent.options.body).mission, 'COLONIZE');
});
