export type ShipDesignEntry = {
  id: string;
  name: string;
  classification: string;
  role: string;
  assets: {
    presentation: string;
    thumbnail: string;
  };
  description: string;
  gameplayHullId?: string;
  special?: 'stargrave';
  subordinateStrikeCraft?: string[];
};

const assets = (id: string) => ({
  presentation: `/static/ships/presentation/${id}.webp`,
  thumbnail: `/static/ships/thumbnail/${id}.webp`,
});

export const SHIP_DESIGNS: ShipDesignEntry[] = [
  { id: 'horizon', name: 'Horizon', classification: 'Corvette', role: 'Exploration', assets: assets('horizon'), description: 'Exploração, reconhecimento e levantamento de sistemas.', gameplayHullId: 'scout_hull' },
  { id: 'wayfarer', name: 'Wayfarer', classification: 'Freighter', role: 'Logistics', assets: assets('wayfarer'), description: 'Transporte, logística e sustentação da expansão.' },
  { id: 'vanguard', name: 'Vanguard', classification: 'Frigate', role: 'Escort', assets: assets('vanguard'), description: 'Escolta, patrulha, proteção de rotas e combate equilibrado.' },
  { id: 'sentinel', name: 'Sentinel', classification: 'Destroyer', role: 'Defense', assets: assets('sentinel'), description: 'Patrulha pesada, defesa, escolta reforçada e sustentação da linha.' },
  { id: 'odyssey', name: 'Odyssey', classification: 'Science Cruiser', role: 'Science', assets: assets('odyssey'), description: 'Ciência de campo, exploração avançada, observação e análise.' },
  { id: 'aegis', name: 'Aegis', classification: 'Cruiser', role: 'Line Presence', assets: assets('aegis'), description: 'Presença de linha, combate sustentado, escolta pesada e projeção regional.' },
  { id: 'spearhead', name: 'Spearhead', classification: 'Battlecruiser', role: 'Offensive', assets: assets('spearhead'), description: 'Ofensiva, ruptura de linha e assalto frontal.' },
  { id: 'leviathan', name: 'Leviathan', classification: 'Battleship', role: 'Heavy Line', assets: assets('leviathan'), description: 'Combate pesado de linha, guerra sustentada, bateria pesada e engajamento de cerco.' },
  { id: 'atlas', name: 'Atlas', classification: 'Carrier', role: 'Fleet Support', assets: assets('atlas'), description: 'Suporte de frota, operações de strike craft, comando e projeção de longo alcance.', subordinateStrikeCraft: ['Interceptor', 'Fighter', 'Bomber'] },
  { id: 'dominion', name: 'Dominion', classification: 'Dreadnought', role: 'Strategic Command', assets: assets('dominion'), description: 'Domínio militar estratégico, combate de grande escala e plataforma pesada de comando.' },
  { id: 'stargrave', name: 'Stargrave-class', classification: 'Titan', role: 'Stellar Siege Titan', assets: assets('stargrave-class'), description: 'Megastructura militar móvel construída ao redor de uma estrela cativa.', special: 'stargrave' },
];

export function shipDesignFor(id: string): ShipDesignEntry | undefined {
  return SHIP_DESIGNS.find(design => design.id === id);
}

