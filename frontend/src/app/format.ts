import type { Catalog, Content, District, Hull, State } from '../types/game';

export const fmt = (value: number | undefined, digits = 0) => Number(value ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: digits });
export const duration = (seconds: number) => seconds < 60 ? `${Math.max(0, Math.ceil(seconds))}s` : seconds < 3600 ? `${Math.ceil(seconds / 60)}min` : `${Math.floor(seconds / 3600)}h ${Math.ceil(seconds % 3600 / 60)}min`;
export const remaining = (stamp: number | null, now = Date.now() / 1000) => stamp === null ? 'Pausada' : duration(stamp - now);
export const percent = (value: number) => Math.max(0, Math.min(100, value));
export const term = (id: string) => ({ corvette: 'Corveta', freighter: 'Cargueiro', frigate: 'Fragata', destroyer: 'Destróier', science_cruiser: 'Cruzador científico', cruiser: 'Cruzador', battlecruiser: 'Cruzador de batalha', battleship: 'Encouraçado', carrier: 'Porta-naves', dreadnought: 'Dreadnought', logistics: 'Logística', escort: 'Escolta', defense: 'Defesa', science: 'Ciência', line_combat: 'Combate de linha', power_projection: 'Projeção de poder', capital: 'Capital', carrier_operations: 'Operações aéreas', command: 'Comando', exploration: 'Exploração', MOVE: 'Movimento', SURVEY: 'Levantamento', COLONIZE: 'Colonização', ARRIVED: 'Estacionada', TRANSIT: 'Em trânsito', VIABLE: 'Viável', HOSTILE: 'Hostil', UNINHABITABLE: 'Inabitável' } as Record<string, string>)[id] ?? id.replaceAll('_', ' ');
export const label = (catalog: Catalog, id: string) => [...catalog.resources, ...catalog.fuels, ...catalog.districts, ...catalog.technologies, ...catalog.ships, ...catalog.propulsion, ...catalog.travel_modes].find(item => item.id === id)?.name ?? id.replaceAll('_', ' ');
export const hullRole = (hull: Hull) => `${term(hull.classification)} · ${term(hull.role)}`;
export const cost = (catalog: Catalog, values: Record<string, number>) => Object.keys(values).length ? Object.entries(values).map(([id, amount]) => `${label(catalog, id)} ${fmt(amount, 1)}`).join(' · ') : 'Sem custo';
export function strategicResources(catalog: Catalog, state: State): Content[] {
  const stocked = [...catalog.resources, ...catalog.fuels].filter(item => item.id in state.stocks);
  return ['natural', 'material', 'component', 'fuel'].map(category => stocked.find(item => item.category === category)).filter((item): item is Content => !!item);
}
export const nominalRate = (catalog: Catalog, state: State, resourceId: string) => (state.economic_districts ?? catalog.districts).reduce((total, district) => total + (state.districts[district.id] ?? 0) * (district.production[resourceId] ?? 0), 0);
export const districtImpact = (catalog: Catalog, district: District, state: State) => {
  const parts: string[] = [];
  if (district.energy_generation) parts.push(`+${fmt(district.energy_generation)} energia`);
  if (district.energy_consumption) parts.push(`−${fmt(district.energy_consumption)} energia`);
  if (district.industrial_capacity) parts.push(`+${fmt(district.industrial_capacity)} indústria`);
  if (district.research_rate) parts.push(`+${fmt(district.research_rate)} pesquisa/s`);
  if (district.construction_slots) parts.push(`+${district.construction_slots} obra`);
  if (district.shipyard_slots) parts.push(`+${district.shipyard_slots} estaleiro`);
  Object.entries(district.production).forEach(([id, value]) => parts.push(`+${fmt(value, 2)} ${label(catalog, id)}/min`));
  return parts.join(' · ') || 'Suporte civil';
};
export const isUnlocked = (catalog: Catalog, state: State, item: Content) => {
  const gated = catalog.technologies.some(technology => technology.unlocks.includes(item.id));
  return !gated || state.unlocked_content.includes(item.id);
};
export const meetsRequirements = (catalog: Catalog, state: State, item: Content) => item.requires.every(id => state.research.completed.includes(id) || (state.districts[id] ?? 0) > 0) && isUnlocked(catalog, state, item);
