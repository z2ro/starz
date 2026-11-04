import { designForHull } from '../visual/ShipDesignRegistry';
import { count, finite, text } from './planetVisualMapping';
import type { Decision, SpaceSceneDescriptor, VisualCatalogInput, VisualShipDescriptor, VisualStateInput } from './types';

export function deriveShipPresence(state: VisualStateInput, catalog: VisualCatalogInput, observedAt: number | undefined, diagnostics: Decision[]): SpaceSceneDescriptor['ships'] {
  const entities: VisualShipDescriptor[] = [];
  const x = state.system?.x, y = state.system?.y;
  const coordinatesKnown = Number.isSafeInteger(x) && Number.isSafeInteger(y);
  const coverage = state.ships !== undefined && state.fleets !== undefined ? 'KNOWN' : 'UNKNOWN';
  diagnostics.push({ field: 'ships.observedAt', sources: ['options.observedAt'], status: observedAt === undefined ? 'UNKNOWN' : 'GROUNDED', rule: 'explicit caller-supplied snapshot epoch seconds; current API exposes no snapshot time', result: observedAt ?? null });
  const groups = new Map<string, NonNullable<VisualStateInput['ships']>[number][]>();
  for (const ship of state.ships ?? []) if (text(ship.id)) groups.set(ship.id, [...(groups.get(ship.id) ?? []), ship]);
  for (const id of [...groups.keys()].sort()) {
    const records = groups.get(id)!;
    const ship = records[0];
    const signature = (item: typeof ship) => JSON.stringify([item.hull_id, item.ready_at, item.origin_planet_id, item.system_x, item.system_y]);
    const conflicting = records.some(item => signature(item) !== signature(ship));
    const fleets = (state.fleets ?? []).filter(fleet => fleet.ship_ids?.includes(id));
    const hulls = catalog.ships?.filter(hull => hull.id === ship.hull_id) ?? [];
    const hull = hulls.length === 1 ? hulls[0] : undefined;
    const design = designForHull(hull), recognized = design !== null;
    let presence: VisualShipDescriptor['presence'] = 'UNKNOWN', context: VisualShipDescriptor['context'] = 'UNKNOWN';
    let reason = 'Missing fleet inventory, coordinates, or unambiguous association';
    if (!conflicting && coverage === 'KNOWN' && coordinatesKnown && fleets.length <= 1) {
      const fleet = fleets[0];
      if (fleet?.status === 'TRANSIT' && text(fleet.id)) { presence = 'TRANSIT'; reason = 'Transit is not a parked orbital presence'; }
      else if (fleet?.status === 'ARRIVED' && text(fleet.id) && Number.isSafeInteger(fleet.x) && Number.isSafeInteger(fleet.y)) {
        presence = fleet.x === x && fleet.y === y ? 'LOCAL_SYSTEM' : 'REMOTE_SYSTEM'; context = 'SYSTEM_ONLY';
        reason = 'ARRIVED coordinates identify a system only; no current planet orbit in fleet contract';
      } else if (!fleet && Number.isSafeInteger(ship.system_x) && Number.isSafeInteger(ship.system_y)) {
        if (finite(observedAt) && finite(ship.ready_at) && ship.ready_at >= 0 && ship.ready_at <= observedAt) {
          presence = ship.system_x === x && ship.system_y === y ? 'LOCAL_SYSTEM' : 'REMOTE_SYSTEM';
          context = text(ship.origin_planet_id) && ship.origin_planet_id === state.active_planet?.id ? 'ORIGIN_PLANET' : 'SYSTEM_ONLY';
          reason = 'Unassigned ready ship at persisted system coordinates; origin is not a current orbital slot';
        } else reason = 'Readiness requires an explicit observedAt snapshot time; no wall clock inference';
      }
    }
    if (conflicting) reason = 'Conflicting duplicate ship ID; hidden';
    else if (fleets.length > 1) reason = 'Ship linked more than once; ambiguous fleet assignment';
    if (finite(observedAt) && finite(ship.ready_at) && ship.ready_at > observedAt && presence === 'LOCAL_SYSTEM') { presence = 'UNKNOWN'; context = 'UNKNOWN'; reason = 'Inconsistent snapshot: local ship is not ready at observedAt'; }
    const visible = presence === 'LOCAL_SYSTEM' && recognized && !conflicting;
    entities.push({ id, hullId: !conflicting && text(ship.hull_id) ? ship.hull_id : null, fleetId: fleets.length === 1 && text(fleets[0].id) ? fleets[0].id : null, quantity: 1, presence, context, design: recognized && !conflicting ? `${design}-prototype` as const : 'UNKNOWN_DESIGN', visible, reason });
    diagnostics.push({ field: `ships.${id}.presence`, sources: ['state.ships', 'state.fleets', 'state.system.x/y', 'observedAt'], status: presence === 'UNKNOWN' ? 'UNKNOWN' : 'GROUNDED', rule: reason, result: presence });
    diagnostics.push({ field: `ships.${id}.design`, sources: ['state.ships.hull_id', 'catalog.ships.id/classification/role'], status: recognized && !conflicting ? 'HEURISTIC' : 'UNKNOWN', rule: 'explicit hull ID + classification + role -> approved procedural design; no substitution', result: entities[entities.length - 1].design });
    diagnostics.push({ field: `ships.${id}.visible`, sources: [`ships.${id}.presence`, `ships.${id}.design`], status: visible ? 'HEURISTIC' : presence === 'UNKNOWN' || !recognized ? 'UNKNOWN' : 'GROUNDED', rule: 'eligible for system-context presentation only; no claim of a persistent planet orbit', result: visible });
  }
  const knownIds = new Set(groups.keys());
  const missing = [...new Set((state.fleets ?? []).flatMap(fleet => fleet.ship_ids ?? []).filter(id => !knownIds.has(id)))].sort();
  for (const id of missing) diagnostics.push({ field: `ships.${id}`, sources: ['state.fleets.ship_ids', 'state.ships'], status: 'UNKNOWN', rule: 'fleet references missing ship; no synthetic entity created', result: null });
  diagnostics.push({ field: 'ships.coverage', sources: ['state.ships', 'state.fleets'], status: coverage === 'KNOWN' ? 'GROUNDED' : 'UNKNOWN', rule: 'empty inventory differs from unavailable inventory', result: coverage });
  diagnostics.push({ field: 'ships.invalidEntries', sources: ['state.ships.id'], status: 'UNKNOWN', rule: 'missing IDs are not assigned invented identities', result: (state.ships ?? []).filter(ship => !text(ship.id)).length });
  return { coverage, entities, visibleCount: entities.filter(ship => ship.visible).length };
}

export function deriveOrbitalInfrastructure(state: VisualStateInput, catalog: VisualCatalogInput, scoped: boolean, diagnostics: Decision[]): SpaceSceneDescriptor['infrastructure'] {
  const level = state.districts?.orbital_shipyard;
  const evidence = scoped && count(level) && level > 0 && catalog.districts?.some(item => item.id === 'orbital_shipyard') ? [{ districtId: 'orbital_shipyard', level }] : [];
  diagnostics.push({ field: 'infrastructure.evidence', sources: ['state.districts.orbital_shipyard', 'catalog.districts'], status: evidence.length ? 'GROUNDED' : 'UNKNOWN', rule: 'explicit orbital_shipyard district is orbital infrastructure; slots alone prove no station entity', result: evidence.length ? level! : null });
  diagnostics.push({ field: 'infrastructure.station', sources: ['state.districts', 'catalog.districts'], status: 'UNKNOWN', rule: 'no entity mapping to experimental service outpost; even a real orbital shipyard is not this station', result: false });
  return { evidence, station: { presence: 'UNKNOWN', visible: false, model: null } };
}
