import { meetsRequirements } from '../app/format';
import type { Catalog, Fuel, Hull, Propulsion, State } from '../types/game';

export function compatiblePropulsions(catalog: Catalog, state: State, hull?: Hull): Propulsion[] {
  return hull ? hull.compatible_propulsion.map(id => catalog.propulsion.find(item => item.id === id)).filter((item): item is Propulsion => !!item && meetsRequirements(catalog, state, item)) : [];
}

export function compatibleFuels(catalog: Catalog, state: State, propulsion?: Propulsion): Fuel[] {
  return propulsion ? propulsion.compatible_fuels.map(id => catalog.fuels.find(item => item.id === id)).filter((item): item is Fuel => !!item && meetsRequirements(catalog, state, item)) : [];
}

export function firstBuildableHull(catalog: Catalog, state: State): Hull | undefined {
  return catalog.ships.find(hull => meetsRequirements(catalog, state, hull) && state.capacities.shipyard_slots_available > 0) ?? catalog.ships.find(hull => meetsRequirements(catalog, state, hull)) ?? catalog.ships[0];
}

export function hasLocalCost(state: State, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([id, amount]) => (state.stocks[id] ?? 0) >= amount);
}
