import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type VisualAssetDefinition = {
  id: string;
  type: 'ship' | 'station';
  path: string;
  scale: number;
};

export const VISUAL_ASSETS: Record<string, VisualAssetDefinition> = {
  orbital_shipyard: { id: 'orbital_shipyard', type: 'station', path: '/static/assets/models/orbital_shipyard.glb', scale: 1 },
  scout_hull: { id: 'scout_hull', type: 'ship', path: '/static/assets/models/horizon.glb', scale: 1 },
};

type AssetLoader = Pick<GLTFLoader, 'loadAsync'>;

export class AssetRegistry {
  private readonly cache = new Map<string, Promise<THREE.Object3D | null>>();

  constructor(private readonly loader: AssetLoader = new GLTFLoader()) {}

  definition(id: string): VisualAssetDefinition | undefined {
    return VISUAL_ASSETS[id];
  }

  load(id: string): Promise<THREE.Object3D | null> {
    const definition = this.definition(id);
    if (!definition) return Promise.resolve(null);
    const cached = this.cache.get(id);
    if (cached) return cached;
    const loaded = this.loader.loadAsync(definition.path)
      .then(result => result.scene)
      .catch(() => null);
    this.cache.set(id, loaded);
    return loaded;
  }

  async loadClone(id: string): Promise<THREE.Object3D | null> {
    const source = await this.load(id);
    if (!source) return null;
    const clone = source.clone(true);
    const definition = this.definition(id);
    if (definition) clone.scale.multiplyScalar(definition.scale);
    clone.userData.assetInstance = true;
    return clone;
  }
}

export const visualAssetRegistry = new AssetRegistry();
