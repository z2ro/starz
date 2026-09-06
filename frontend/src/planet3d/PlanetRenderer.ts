import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  districtPlacement,
  autoRotationEnabled,
  fleetIsInSystem,
  hasShipyard,
  latLonToVector3,
  planetVisualConfig,
  seededRandom,
  starfieldPositions,
  starVisualConfig,
} from './planetVisual';
import type { PlanetVisualState } from './types';

function disposeObject(object: THREE.Object3D): void {
  object.traverse(child => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach(material => {
      Object.values(material as unknown as Record<string, unknown>).forEach(value => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}

function clearGroup(group: THREE.Group): void {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject(child);
  }
}

function canvasTexture(draw: (context: CanvasRenderingContext2D, width: number, height: number) => void, width = 512, height = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function surfaceTexture(input: PlanetVisualState): THREE.CanvasTexture {
  const config = planetVisualConfig(input.planet);
  return canvasTexture((context, width, height) => {
    context.fillStyle = config.oceanColor;
    context.fillRect(0, 0, width, height);
    const water = Math.max(0, Math.min(1, input.planet.water / 100));
    const landCount = Math.round(3 + (1 - water) * 6);
    for (let land = 0; land < landCount; land += 1) {
      const cx = seededRandom(input.seed, 'land-x', land) * width;
      const cy = (0.16 + seededRandom(input.seed, 'land-y', land) * 0.68) * height;
      const rx = (0.08 + seededRandom(input.seed, 'land-rx', land) * 0.14) * width;
      const ry = (0.06 + seededRandom(input.seed, 'land-ry', land) * 0.1) * height;
      context.beginPath();
      for (let point = 0; point < 12; point += 1) {
        const angle = point / 12 * Math.PI * 2;
        const wobble = 0.72 + seededRandom(input.seed, `land-wobble-${land}`, point) * 0.45;
        const x = cx + Math.cos(angle) * rx * wobble;
        const y = cy + Math.sin(angle) * ry * wobble;
        if (point === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fillStyle = land % 2 ? config.landAccent : config.landColor;
      context.fill();
    }
    const cold = Math.max(0, Math.min(1, (250 - input.planet.temperature) / 80));
    if (cold > 0.08) {
      context.fillStyle = `${config.iceColor}${Math.round(cold * 110).toString(16).padStart(2, '0')}`;
      context.fillRect(0, 0, width, height * (0.08 + cold * 0.16));
      context.fillRect(0, height * (0.92 - cold * 0.16), width, height * (0.08 + cold * 0.16));
    }
    context.globalAlpha = 0.15 + input.planet.geological_activity * 0.18;
    context.strokeStyle = config.landAccent;
    context.lineWidth = 2;
    for (let line = 0; line < 7; line += 1) {
      const y = (0.12 + seededRandom(input.seed, 'geo-line', line) * 0.76) * height;
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(width * 0.3, y - 12, width * 0.68, y + 14, width, y - 4);
      context.stroke();
    }
  });
}

function cloudTexture(input: PlanetVisualState): THREE.CanvasTexture {
  const config = planetVisualConfig(input.planet);
  return canvasTexture((context, width, height) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgba(235, 250, 248, ${config.cloudOpacity})`;
    for (let cloud = 0; cloud < 18; cloud += 1) {
      context.beginPath();
      context.ellipse(
        seededRandom(input.seed, 'cloud-x', cloud) * width,
        seededRandom(input.seed, 'cloud-y', cloud) * height,
        18 + seededRandom(input.seed, 'cloud-rx', cloud) * 50,
        3 + seededRandom(input.seed, 'cloud-ry', cloud) * 9,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  });
}

export class PlanetRenderer {
  private readonly container: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly reducedMotion: boolean;
  private readonly resizeObserver?: ResizeObserver;
  private readonly resizeListener: () => void;
  private planetGroup?: THREE.Group;
  private stationOrbit?: THREE.Group;
  private frame: number | undefined;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070b12');
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.camera.position.set(0, 0.15, 3.15);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'planet-3d-canvas';
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'Visualização 3D do planeta');
    this.container.replaceChildren(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.65;
    this.controls.maxDistance = 5;
    this.controls.target.set(0, 0, 0);
    this.scene.add(this.content);
    this.resizeListener = () => this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.resizeListener);
    }
    this.resize();
    this.animate();
  }

  update(input: PlanetVisualState): void {
    if (this.disposed) return;
    clearGroup(this.content);
    const planetGroup = new THREE.Group();
    this.planetGroup = planetGroup;
    const config = planetVisualConfig(input.planet);
    const star = starVisualConfig(input.star);
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 48),
      new THREE.MeshStandardMaterial({ map: surfaceTexture(input), roughness: 0.92, metalness: 0.02 }),
    );
    planetGroup.add(planet);
    planetGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.018, 48, 32),
      new THREE.MeshBasicMaterial({ map: cloudTexture(input), transparent: true, opacity: 0.65, depthWrite: false }),
    ));
    planetGroup.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.08, 48, 32),
      new THREE.MeshBasicMaterial({ color: config.atmosphereColor, transparent: true, opacity: config.atmosphereOpacity, side: THREE.BackSide, depthWrite: false }),
    ));
    input.districts.forEach((district, index) => {
      const placement = districtPlacement(input.seed, district.id, index, district.level);
      const position = latLonToVector3(placement.latitude, placement.longitude, 1.03);
      const color = this.districtColor(district.category);
      const marker = new THREE.Group();
      marker.position.set(position.x, position.y, position.z);
      marker.lookAt(0, 0, 0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.1, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25 }));
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.045, 0.11), new THREE.MeshStandardMaterial({ color }));
      cap.position.y = 0.065;
      marker.add(base, cap);
      marker.scale.setScalar(positionScale(district.level));
      planetGroup.add(marker);
    });
    this.content.add(planetGroup);
    this.addLights(star);
    this.addStarfield(input.seed);
    if (hasShipyard(input.capacities.shipyard_slots)) this.addShipyard();
    input.fleets.filter(fleet => fleetIsInSystem(fleet, input.systemX, input.systemY)).forEach((_, index) => this.addFleetMarker(index));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.resizeListener);
    this.controls.dispose();
    clearGroup(this.content);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.planetGroup = undefined;
    this.stationOrbit = undefined;
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (autoRotationEnabled(this.reducedMotion)) {
      if (this.planetGroup) this.planetGroup.rotation.y += 0.00045;
      if (this.stationOrbit) this.stationOrbit.rotation.y += 0.0012;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private resize(): void {
    const box = this.container.getBoundingClientRect();
    const width = Math.max(1, box.width || this.container.clientWidth);
    const height = Math.max(1, box.height || this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private addLights(star: { color: string; intensity: number }): void {
    this.content.add(new THREE.HemisphereLight('#8aaac4', '#05070c', 0.16));
    const key = new THREE.DirectionalLight(star.color, star.intensity);
    key.position.set(4, 2, 4);
    this.content.add(key);
  }

  private addStarfield(seed: string): void {
    const positions = starfieldPositions(seed);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions.flatMap(position => [position.x, position.y, position.z]), 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#a9c0d4', size: 0.035, sizeAttenuation: true }));
    this.content.add(points);
  }

  private addShipyard(): void {
    this.stationOrbit = new THREE.Group();
    this.stationOrbit.rotation.z = -0.34;
    this.stationOrbit.position.set(0, 0.1, 0);
    const station = new THREE.Group();
    station.position.set(1.55, 0, 0);
    const metal = new THREE.MeshStandardMaterial({ color: '#7190a2', metalness: 0.72, roughness: 0.42 });
    const glow = new THREE.MeshBasicMaterial({ color: '#6db7ca' });
    station.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24), metal));
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.36, 8), glow);
    core.rotation.z = Math.PI / 2;
    station.add(core);
    station.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.018, 0.08), metal));
    this.stationOrbit.add(station);
    this.content.add(this.stationOrbit);
  }

  private addFleetMarker(index: number): void {
    const orbit = new THREE.Group();
    orbit.rotation.y = index * 1.8;
    const marker = new THREE.Group();
    marker.position.set(1.32, 0.18 + index * 0.06, 0);
    marker.rotation.z = -0.45;
    marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), new THREE.MeshStandardMaterial({ color: '#9ed9e6', emissive: '#2e7e99', emissiveIntensity: 0.4 })));
    orbit.add(marker);
    this.content.add(orbit);
  }

  private districtColor(category: string): string {
    const colors: Record<string, string> = { mining: '#c99b5d', energy: '#8ec5d5', industrial: '#d18a6d', research: '#a99bc7', civil: '#8ebf9c', military: '#c77d7d', logistics: '#9db2c6' };
    return colors[category.toLowerCase()] ?? '#a8bbc9';
  }
}

function positionScale(level: number): number {
  return 0.72 + Math.max(1, Math.min(3, level)) * 0.14;
}
