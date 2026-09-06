export type PlanetVisualPlanet = {
  name: string;
  temperature: number;
  atmosphere: string;
  water: number;
  geological_activity: number;
};

export type PlanetVisualStar = {
  stellar_class: string;
  luminosity: number;
};

export type PlanetVisualState = {
  seed: string;
  systemX: number;
  systemY: number;
  planetIndex: number;
  planet: PlanetVisualPlanet;
  star: PlanetVisualStar;
  districts: Array<{ id: string; category: string; level: number }>;
  capacities: { shipyard_slots: number };
  fleets: Array<{ status: string; x: number; y: number }>;
};
