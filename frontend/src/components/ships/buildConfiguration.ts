import { meetsRequirements } from '../../app/format';
import type { Catalog, Hull, State } from '../../types/game';
export function buildConfiguration(catalog: Catalog, state: State, hull: Hull | undefined, propulsionId: string, fuelId: string) {
  const propulsions = catalog.propulsion.filter(item => hull?.compatible_propulsion.includes(item.id) && meetsRequirements(catalog, state, item));
  const propulsion = propulsions.find(item => item.id === propulsionId) ?? propulsions[0];
  const fuels = catalog.fuels.filter(item => propulsion?.compatible_fuels.includes(item.id) && meetsRequirements(catalog, state, item));
  const fuel = fuels.find(item => item.id === fuelId) ?? fuels[0];
  const missingCost = Object.entries(hull?.cost ?? {}).filter(([id, amount]) => (state.stocks[id] ?? 0) < amount).map(([id]) => id);
  const valid = !!hull && meetsRequirements(catalog, state, hull) && !!propulsion && !!fuel && (state.stocks[fuel.id] ?? 0) >= 1 && state.population.available >= hull.crew && state.capacities.shipyard_slots_available >= 1 && !missingCost.length;
  return { propulsions, propulsion, fuels, fuel, missingCost, valid };
}
