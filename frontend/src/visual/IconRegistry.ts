export const ICONS = {
  overview: '/static/assets/icons/stellar-atlas/icon-overview.svg',
  planet: '/static/assets/icons/stellar-atlas/icon-planet.svg',
  economy: '/static/assets/icons/stellar-atlas/icon-economy.svg',
  research: '/static/assets/icons/stellar-atlas/icon-research.svg',
  shipyard: '/static/assets/icons/stellar-atlas/icon-shipyard.svg',
  fleets: '/static/assets/icons/stellar-atlas/icon-fleets.svg',
  galaxy: '/static/assets/icons/stellar-atlas/icon-galaxy.svg',
  energy: '/static/assets/icons/stellar-atlas/icon-energy.svg',
  population: '/static/assets/icons/stellar-atlas/icon-population.svg',
  operations: '/static/assets/icons/stellar-atlas/icon-operations.svg',
  system: '/static/assets/icons/stellar-atlas/icon-system.svg',
  notifications: '/static/assets/icons/stellar-atlas/icon-notifications.svg',
  settings: '/static/assets/icons/stellar-atlas/icon-settings.svg',
  rawOre: '/static/assets/icons/stellar-atlas/resource-raw-ore.svg',
  refinedAlloy: '/static/assets/icons/stellar-atlas/resource-refined-alloy.svg',
  components: '/static/assets/icons/stellar-atlas/resource-components.svg',
  fusionFuel: '/static/assets/icons/stellar-atlas/resource-fusion-fuel.svg',
} as const;

export type IconName = keyof typeof ICONS;

export function icon(name: IconName, className = 'ui-icon'): string {
  return `<span class="${className}" aria-hidden="true" style="--icon:url('${ICONS[name]}')"></span>`;
}

export function resourceIcon(resourceId: string): IconName | undefined {
  const byId: Record<string, IconName> = {
    raw_ore: 'rawOre',
    refined_alloy: 'refinedAlloy',
    components: 'components',
    fusion_fuel: 'fusionFuel',
    ion_fuel: 'fusionFuel',
  };
  return byId[resourceId] ?? (resourceId.endsWith('_fuel') ? 'fusionFuel' : undefined);
}
