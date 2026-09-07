export type PlanetArtwork = {
  id: string;
  path: string;
};

// HERO ART V1 is a fixed composition. Future visual profiles can select
// temperate, arid, frozen, volcanic, oceanic or barren layered artwork.
export const PLANET_ARTWORK: Record<string, PlanetArtwork> = {
  temperate_default: { id: 'temperate_default', path: '/static/assets/planet-command-hero.png' },
};

export function planetArtworkFor(_planet: { temperature?: number; atmosphere?: string; water?: number }): PlanetArtwork {
  return PLANET_ARTWORK.temperate_default;
}
