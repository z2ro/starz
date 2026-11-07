import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { GalaxyView } from '../frontend/src/views/GalaxyView';
import { authorizedSystem, fleetVisualPosition, knownLocalFleets, orbitalPlanets, orbitalPosition, systemKey, visualPosition, visibleGalaxyLabels, galaxyCenter, fleetMapMarkers, fleetComposition } from '../frontend/src/galaxy/galaxyPresentation';
import type { GalaxySystem } from '../frontend/src/types/game';
import { planetSnapshot, planetCatalog } from './fixtures/planetIntegration';
const known: GalaxySystem = { id: 'system-0-0', name: 'Asterion', x: 0, y: 0, distance: 0, home: true, knowledge_level: 'SURVEYED', star: { stellar_class: 'G', luminosity: 1, activity: .2 }, planets: [{ planet_index: 0, name: 'Aurelia', gravity: 1, temperature: 288, water: 60, radiation: .1, ownership: 'OWNED', viability: 'VIABLE', colonization: { eligible: false, reason: 'Mundo próprio', population: 20, cost: {} } }] };
const unknown: GalaxySystem = { ...known, id: '1:0', x: 1, home: false, knowledge_level: 'UNKNOWN', name: 'SECRET', planets: known.planets };
const query = vi.hoisted(() => ({ isPending: false, isError: false, data: undefined as unknown }));
vi.mock('../frontend/src/api/queries', () => ({ useGalaxyQuery: () => query }));
vi.mock('../frontend/src/universe/useUniverse', () => ({ useUniverse: () => ({ data: { players: [] } }) }));
vi.mock('../frontend/src/galaxy/OrbitalSystemScene', () => ({ OrbitalSystemScene: ({ onPlanet }: { onPlanet: (index: number) => void }) => <button onClick={() => onPlanet(0)}>Planeta na cena</button> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function mount() {
  query.data = { systems: [known, unknown], home: [0, 0], center: [0, 0], radius: 2 };
  const state = planetSnapshot(); state.persistent = true;
  render(<MemoryRouter><Routes><Route element={<Outlet context={{ state, catalog: planetCatalog, execute: vi.fn() }}/> }><Route path="/" element={<GalaxyView/>}/></Route></Routes></MemoryRouter>);
}
it('keeps a system fixed across discovery, query order and different viewers', () => {
  const original = visualPosition(unknown);
  expect(original).toEqual(visualPosition({ ...known, x: 1 }));
  expect(original).toEqual(visualPosition(unknown)); expect(systemKey(unknown)).toBe('1:0');
  expect(original).not.toEqual(visualPosition(known));
});
it('separates adjacent hit targets with finite non-grid positions, including negative coordinates', () => {
  const nodes = [];
  for (let x = -6; x <= 6; x++) for (let y = -6; y <= 6; y++) nodes.push(visualPosition({ x, y }));
  for (let i = 0; i < nodes.length; i++) {
    expect(Number.isFinite(nodes[i].x + nodes[i].y)).toBe(true);
    for (let j = i + 1; j < nodes.length; j++) expect(Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) * .45).toBeGreaterThan(46);
  }
});
it('fails closed even if an unknown API item contains private properties', () => {
  const sanitized = authorizedSystem(unknown);
  expect(sanitized.name).toBeUndefined(); expect(sanitized.planets).toBeUndefined(); expect(sanitized.star).toBeUndefined();
  expect(orbitalPlanets(unknown)).toEqual([]);
});
it('uses only timestamps for transit progress and distinguishes actual local fleets', () => {
  const state = planetSnapshot(), fleet = { ...state.fleets[0], x: 0, y: 0, destination_x: 1, destination_y: 0, departure_at: 100, arrival_at: 200, status: 'TRANSIT' as const };
  const start = visualPosition(fleet), end = visualPosition({ x: 1, y: 0 });
  const point = fleetVisualPosition(fleet, 150)!;
  expect(point.x).toBeCloseTo((start.x + end.x) / 2); expect(point.y).toBeCloseTo((start.y + end.y) / 2);
  expect(fleetVisualPosition(fleet, undefined)).toBeNull();
  expect(knownLocalFleets(known, [fleet])).toEqual([]);
  expect(knownLocalFleets(known, [{ ...fleet, status: 'ARRIVED' }])).toHaveLength(1);
});
it('keeps orbital phases deterministic and safely separated from the star', () => {
  const a = orbitalPosition(known, 0, 1234, 0), b = orbitalPosition(known, 0, 1234, 0);
  expect(a).toEqual(b); expect(Math.hypot(a.x, a.z)).toBeCloseTo(a.radius); expect(a.radius).toBeGreaterThan(2);
  expect(orbitalPosition(known, 0, 1235, 0)).not.toEqual(a);
});
it('derives a stable planetary preview only from authorized system data, independently of the active snapshot', () => {
  const a = orbitalPlanets(known), b = orbitalPlanets(structuredClone(known));
  expect(a).toEqual(b); expect(a[0].settings.seed).toBe('starz:orbital-planet:v1:0:0:0');
  expect(a[0].settings.family).toBe('terran'); expect(a[0].settings.waterCoverage).toBe(.6);
  expect(a[0].atmosphere.visible).toBe(false);
});
it('opens mapped systems, inspects planets and preserves the real mission destination', () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: 'Abrir sistema', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Planeta na cena' }));
  expect(screen.getByRole('link', { name: 'Planejar missão para 0:0' })).toHaveAttribute('href', '#/fleets?plan=1&x=0&y=0&mission=MOVE&planet_index=0');
  fireEvent.click(screen.getByRole('button', { name: '← Galáxia', exact: true }));
  expect(screen.queryByRole('button', { name: 'Planeta na cena' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Localização não identificada, coordenadas 1:0/ }));
  expect(screen.queryByText('SECRET')).toBeNull(); expect(screen.queryByRole('button', { name: 'Abrir sistema' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Planejar missão para 1:0' })).toHaveAttribute('href', '#/fleets?plan=1&x=1&y=0&mission=SURVEY');
});

it('prioritizes selected labels and prevents overlapping names at all zoom levels', () => {
  const nodes = [0,1,2].map((x,i) => ({ system: { ...known, x, home: i === 0 }, x: [300,380,700][i], y: 200 }));
  const visible = visibleGalaxyLabels(nodes, { x: 0, y: 0, zoom: 1, width: 1000, height: 600 }, '0:0');
  expect([...visible]).toEqual(['0:0','2:0']);
  expect(visibleGalaxyLabels(nodes, { x: 0, y: 0, zoom: .5, width: 1000, height: 600 }, '0:0').has('1:0')).toBe(false);
});

it('uses home coordinates from any selected colony and rejects centers without an arrived fleet', () => {
  const state = planetSnapshot();
  state.planets = [{id:'home',name:'Home',x:2,y:3,home:true,planet_index:0,population_total:10}];
  state.system = {...state.system,x:9,y:9}; state.fleets = [];
  expect(galaxyCenter(state)).toEqual([2,3]); expect(galaxyCenter(state,[9,9])).toEqual([2,3]);
  state.fleets = [{...planetSnapshot().fleets[0],x:9,y:9,status:'ARRIVED'}];
  expect(galaxyCenter(state,[9,9])).toEqual([9,9]);
  state.fleets[0].status='TRANSIT'; expect(galaxyCenter(state,[9,9])).toEqual([2,3]);
});

it('groups coincident own fleets and deduplicates IDs instead of overlapping hit targets', () => {
  const fleet = {...planetSnapshot().fleets[0],id:'one',status:'ARRIVED' as const,x:0,y:0};
  const markers = fleetMapMarkers([fleet,fleet,{...fleet,id:'two'}],100);
  expect(markers).toHaveLength(1); expect(markers[0].fleets.map(f => f.id)).toEqual(['one','two']);
});

it('counts only actual unique ship IDs in a fleet and preserves unknown hull identities', () => {
  const state=planetSnapshot(),base=state.ships[0],hull=planetCatalog.ships[0];
  state.ships=[{...base,id:'a',hull_id:hull.id},{...base,id:'b',hull_id:hull.id},{...base,id:'c',hull_id:'not-implemented'}];
  const fleet={...state.fleets[0],ship_ids:['a','b','a','c','missing']};
  expect(fleetComposition(fleet,state,planetCatalog)).toEqual([{id:hull.id,name:hull.name,count:2},{id:'not-implemented',name:'Design não identificado',count:1}]);
  expect(fleet.ship_ids).toEqual(['a','b','a','c','missing']);
});
