import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshPhysicalNodeMaterial, PMREMGenerator, WebGPURenderer } from 'three/webgpu';
import { positionLocal, uniform } from 'three/tsl';
import { tslExports } from 'vgpu/three';
import hullSurfaceShader from './shaders/hull-surface.wgsl';
import engineEmissiveShader from './shaders/engine-emissive.wgsl';
import { CAMERA_PRESETS, HORIZON_ASSET_PATH, type CameraPreset, type RenderLabOptions } from './renderLabTypes';

type HullInputs = { position: any; variation: any };
type EngineInputs = { position: any; intensity: any };
export type DebugStats = { bounds: [number, number, number]; meshCount: number; materialCount: number; cameraDistance: number; fps: number; frameTime: number };
type UniformValue = { value: number };

const { hullRoughness } = tslExports<{ hullRoughness: HullInputs }>(hullSurfaceShader)('hullRoughness');
const { engineEmission } = tslExports<{ engineEmission: EngineInputs }>(engineEmissiveShader)('engineEmission');

type MeshRecord = {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  experimental: MeshPhysicalNodeMaterial;
  roughness?: UniformValue;
  surfaceVariation?: UniformValue;
  emission?: UniformValue;
};

export type MaterialUniformRecord = Pick<MeshRecord, 'experimental' | 'roughness' | 'surfaceVariation' | 'emission'>;
export type RenderResources = { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material>; textures: Set<THREE.Texture> };

export function updateMaterialUniforms(records: readonly MaterialUniformRecord[], options: Pick<RenderLabOptions, 'baseRoughness' | 'surfaceVariation' | 'engineEmission' | 'metalness'>): void {
  records.forEach(record => {
    record.experimental.metalness = options.metalness;
    if (record.roughness) record.roughness.value = options.baseRoughness;
    if (record.surfaceVariation) record.surfaceVariation.value = options.surfaceVariation;
    if (record.emission) record.emission.value = options.engineEmission;
  });
}

export function countUniqueMaterials(materials: Iterable<THREE.Material | THREE.Material[]>): number {
  const unique = new Set<THREE.Material>();
  for (const material of materials) for (const item of Array.isArray(material) ? material : [material]) unique.add(item);
  return unique.size;
}

export function collectUniqueResources(root: THREE.Object3D, extraMaterials: Iterable<THREE.Material | THREE.Material[]> = []): RenderResources {
  const resources: RenderResources = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const addMaterial = (material: THREE.Material) => {
    if (resources.materials.has(material)) return;
    resources.materials.add(material);
    for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.textures.add(value);
  };
  root.traverse(child => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Points)) return;
    resources.geometries.add(child.geometry);
    for (const material of materialsOf(child)) addMaterial(material);
  });
  for (const material of extraMaterials) for (const item of Array.isArray(material) ? material : [material]) addMaterial(item);
  return resources;
}

export function disposeResources(resources: RenderResources): void {
  resources.textures.forEach(texture => texture.dispose());
  resources.materials.forEach(material => material.dispose());
  resources.geometries.forEach(geometry => geometry.dispose());
}

export class ShipRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
  private readonly renderer = new WebGPURenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  private readonly controls: OrbitControls;
  private readonly star = new THREE.DirectionalLight(0xdff7ff, 3.2);
  private readonly fill = new THREE.HemisphereLight(0x9ab8d6, 0x030811, 0.16);
  private readonly starfield: THREE.Points;
  private readonly records: MeshRecord[] = [];
  private readonly options: RenderLabOptions;
  private readonly onStats?: (stats: DebugStats) => void;
  private ship: THREE.Object3D | null = null;
  private bounds = new THREE.Box3();
  private boundsHelper: THREE.Box3Helper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private environmentTarget: THREE.RenderTarget | null = null;
  private host: HTMLElement | null = null;
  private disposed = false;
  private ready = false;
  private lastFrame = 0;
  private frameTimes: number[] = [];

  constructor(options: RenderLabOptions, onStats?: (stats: DebugStats) => void) {
    this.options = { ...options };
    this.onStats = onStats;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 16;
    this.controls.target.set(0, 0, 0);
    this.starfield = this.createStarfield();
    this.scene.add(this.starfield, this.star, this.fill);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.options.exposure;
    this.scene.background = new THREE.Color(0x020711);
    this.setStarDirection();
  }

  async mount(host: HTMLElement): Promise<void> {
    this.host = host;
    this.renderer.domElement.className = 'render-lab-canvas';
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'Render Lab WebGPU da Horizon');
    host.append(this.renderer.domElement);
    await this.renderer.init();
    if (this.disposed) return;
    this.createEnvironment();
    const gltf = await new GLTFLoader().loadAsync(HORIZON_ASSET_PATH);
    if (this.disposed) {
      disposeObject(gltf.scene);
      return;
    }
    this.ship = gltf.scene;
    this.normalizeShip();
    this.scene.add(this.ship);
    this.applyMaterials();
    this.fitCamera(this.options.cameraPreset);
    this.applyDebugHelpers();
    this.ready = true;
    this.resize();
    this.renderer.setAnimationLoop(() => this.render());
  }

  setOptions(next: Partial<RenderLabOptions>): void {
    Object.assign(this.options, next);
    this.renderer.toneMappingExposure = this.options.exposure;
    this.scene.environmentIntensity = this.options.environmentIntensity;
    this.star.intensity = this.options.starIntensity;
    this.setStarDirection();
    updateMaterialUniforms(this.records, this.options);
    if (this.ship && next.cameraPreset) this.fitCamera(next.cameraPreset);
    if (next.materialMode) this.setMaterialMode(next.materialMode);
    if (next.showBounds !== undefined || next.showAxes !== undefined) this.applyDebugHelpers();
  }

  resetCamera(): void { this.fitCamera(this.options.cameraPreset); }

  resize(): void {
    if (!this.host) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
  }

  debugStats(): DebugStats {
    const size = this.bounds.getSize(new THREE.Vector3());
    return {
      bounds: [size.x, size.y, size.z],
      meshCount: this.records.length,
      materialCount: countUniqueMaterials(this.records.map(record => record.original)),
      cameraDistance: this.camera.position.distanceTo(this.controls.target),
      fps: this.frameTimes.length ? 1000 / (this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length) : 0,
      frameTime: this.frameTimes.length ? this.frameTimes.reduce((sum, value) => sum + value, 0) / this.frameTimes.length : 0,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ready = false;
    this.renderer.setAnimationLoop(null);
    this.controls.dispose();
    this.boundsHelper?.dispose();
    this.axesHelper?.dispose();
    this.environmentTarget?.dispose();
    disposeObject(this.starfield);
    if (this.ship) disposeObject(this.ship, this.records.flatMap(record => [record.original, record.experimental]));
    this.records.length = 0;
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.host = null;
  }

  private createEnvironment(): void {
    const environment = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x26384b, roughness: 0.82, metalness: 0.12 }));
    room.scale.set(18, 14, 18);
    room.material.side = THREE.BackSide;
    environment.add(room);
    const pmrem = new PMREMGenerator(this.renderer);
    this.environmentTarget = pmrem.fromScene(environment, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = this.options.environmentIntensity;
    room.geometry.dispose();
    (room.material as THREE.Material).dispose();
    pmrem.dispose();
  }

  private normalizeShip(): void {
    if (!this.ship) return;
    const sourceBounds = new THREE.Box3().setFromObject(this.ship);
    const center = sourceBounds.getCenter(new THREE.Vector3());
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    this.ship.position.sub(center);
    const scale = 2.8 / Math.max(sourceSize.x, sourceSize.y, sourceSize.z, 0.001);
    this.ship.scale.setScalar(scale);
    this.ship.updateMatrixWorld(true);
    this.bounds.setFromObject(this.ship);
  }

  private applyMaterials(): void {
    if (!this.ship) return;
    this.ship.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material;
      const material = this.createExperimentalMaterial(object);
      this.records.push({ mesh: object, original, experimental: material, roughness: material.userData.roughnessUniform, surfaceVariation: material.userData.surfaceVariationUniform, emission: material.userData.emissionUniform });
      object.material = material;
    });
  }

  private createExperimentalMaterial(mesh: THREE.Mesh): MeshPhysicalNodeMaterial {
    const isEngine = /engine[_ -]?core/i.test(mesh.name) || materialsOf(mesh).some(material => /engine emissive/i.test(material.name));
    const material = new MeshPhysicalNodeMaterial({
      color: isEngine ? 0x071522 : 0x667885,
      metalness: isEngine ? 0.3 : this.options.metalness,
      roughness: isEngine ? 0.24 : this.options.baseRoughness,
      clearcoat: isEngine ? 0.1 : 0.2,
      clearcoatRoughness: 0.35,
    });
    if (isEngine) {
      const emission = uniform(this.options.engineEmission);
      material.emissiveNode = engineEmission({ position: positionLocal, intensity: emission });
      material.userData.emissionUniform = emission;
    } else {
      const base = uniform(this.options.baseRoughness) as any;
      const variation = uniform(this.options.surfaceVariation) as any;
      material.roughnessNode = base.add(hullRoughness({ position: positionLocal, variation }) as any).clamp(0.26, 0.86);
      material.userData.roughnessUniform = base;
      material.userData.surfaceVariationUniform = variation;
    }
    return material;
  }

  private setMaterialMode(mode: RenderLabOptions['materialMode']): void {
    this.records.forEach(record => { record.mesh.material = mode === 'original' ? record.original : record.experimental; });
  }

  private fitCamera(preset: CameraPreset): void {
    const size = this.bounds.getSize(new THREE.Vector3());
    const distance = Math.max(size.x, size.y, size.z) * 1.65 + 0.35;
    const positions: Record<CameraPreset, THREE.Vector3> = {
      '3/4 FRONT': new THREE.Vector3(distance * 0.9, distance * 0.46, distance * 1.1),
      SIDE: new THREE.Vector3(distance * 1.5, distance * 0.22, 0.12),
      REAR: new THREE.Vector3(-distance * 0.78, distance * 0.38, -distance * 1.08),
      TOP: new THREE.Vector3(distance * 0.2, distance * 1.65, distance * 0.28),
    };
    this.camera.position.copy(positions[preset]);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = distance * 0.45;
    this.controls.maxDistance = distance * 5;
    this.controls.update();
  }

  private setStarDirection(): void {
    const azimuth = THREE.MathUtils.degToRad(this.options.starAzimuth);
    const elevation = THREE.MathUtils.degToRad(this.options.starElevation);
    const distance = 8;
    this.star.position.set(Math.cos(elevation) * Math.cos(azimuth) * distance, Math.sin(elevation) * distance, Math.cos(elevation) * Math.sin(azimuth) * distance);
    this.star.target.position.set(0, 0, 0);
    this.star.target.updateMatrixWorld();
  }

  private applyDebugHelpers(): void {
    if (this.options.showBounds && !this.boundsHelper) {
      this.boundsHelper = new THREE.Box3Helper(this.bounds, 0x31d4ff);
      this.scene.add(this.boundsHelper);
    } else if (!this.options.showBounds && this.boundsHelper) {
      this.scene.remove(this.boundsHelper);
      this.boundsHelper.dispose();
      this.boundsHelper = null;
    }
    if (this.options.showAxes && !this.axesHelper) {
      this.axesHelper = new THREE.AxesHelper(1.8);
      this.scene.add(this.axesHelper);
    } else if (!this.options.showAxes && this.axesHelper) {
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
      this.axesHelper = null;
    }
  }

  private createStarfield(): THREE.Points {
    let seed = 0x5eed;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 0x100000000; };
    const positions: number[] = [];
    for (let index = 0; index < 180; index += 1) {
      const radius = 12 + random() * 18;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x9ec6df, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0.52 });
    return new THREE.Points(geometry, material);
  }

  private render(): void {
    if (this.disposed || !this.ready) return;
    const now = performance.now();
    if (this.lastFrame) {
      this.frameTimes.push(now - this.lastFrame);
      if (this.frameTimes.length > 60) this.frameTimes.shift();
    }
    this.lastFrame = now;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onStats && this.frameTimes.length % 10 === 0) this.onStats(this.debugStats());
  }
}

function materialsOf(object: { material: THREE.Material | THREE.Material[] }): THREE.Material[] {
  return Array.isArray(object.material) ? object.material : [object.material];
}

function disposeObject(object: THREE.Object3D, extraMaterials: Iterable<THREE.Material | THREE.Material[]> = []): void {
  disposeResources(collectUniqueResources(object, extraMaterials));
}
