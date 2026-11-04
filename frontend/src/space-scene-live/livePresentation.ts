import { modelForDescriptor } from '../visual/ShipDesignRegistry';
import type { SpaceSceneDescriptor, Decision } from '../visual-state/types';
import { DEFAULT_PLANET_LAB_SETTINGS } from '../planetlab/planetLabTypes';

export function liveGeneration(descriptor: SpaceSceneDescriptor | null) {
  if (!descriptor?.presentation.planetEnabled || !descriptor.identity.seed || !descriptor.planet.family) return null;
  return { ...DEFAULT_PLANET_LAB_SETTINGS, ...descriptor.planet.parameters, family: descriptor.planet.family, seed: descriptor.identity.seed };
}

export function geographicKey(descriptor: SpaceSceneDescriptor | null) {
  const settings = liveGeneration(descriptor);
  return settings ? JSON.stringify([settings.seed, settings.family, descriptor!.planet.parameters]) : null;
}

export function representativeShip(descriptor: SpaceSceneDescriptor | null) {
  return descriptor?.ships.entities.find(ship => ship.visible && ship.presence === 'LOCAL_SYSTEM' && modelForDescriptor(ship.design) !== null) ?? null;
}

export const LIVE_PRESENTATION_DIAGNOSTICS: Decision[] = [
  { field: 'runtime.background', sources: [], status: 'DEFAULT', rule: 'Starfield decorativo do laboratório; não representa posições de estrelas persistentes.', result: 'LAB_STARFIELD' },
  { field: 'runtime.camera', sources: [], status: 'DEFAULT', rule: 'Câmera ortográfica cinematográfica e controles de inspeção, sem posição física no domínio.', result: 'LAB_ORTHOGRAPHIC' },
  { field: 'runtime.shipPlacement', sources: [], status: 'DEFAULT', rule: 'Um representante identificado, em posição ilustrativa fixa. Presença comprovada apenas no sistema; nenhuma órbita, distância ou velocidade real é conhecida.', result: 'SYSTEM_PRESENCE_ONLY' },
  { field: 'runtime.animation', sources: [], status: 'DEFAULT', rule: 'Rotação planetária/nuvens são apresentação do laboratório, não tempo ou rotação medidos do gameplay.', result: 'LAB_PRESENTATION' },
  { field: 'runtime.engineEmission', sources: [], status: 'DEFAULT', rule: 'Propulsores sem emissão: o estado operacional do motor não está disponível.', result: 0 },
];
