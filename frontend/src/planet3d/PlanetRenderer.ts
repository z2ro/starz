import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  autoRotationEnabled,
  districtPlacement,
  fbmNoise2D,
  fleetIsInSystem,
  hasShipyard,
  latLonToVector3,
  parseSrgbHex,
  planetVisualConfig,
  planetSurfaceSample,
  seededRandom,
  starfieldLayers,
  starVisualConfig,
} from './planetVisual';
import type { PlanetVisualState } from './types';
import { visualAssetRegistry } from '../visual/AssetRegistry';

const STAR_POSITION = new THREE.Vector3(3.55, 1.38, -2.65);

function disposeObject(object: THREE.Object3D): void {
  object.traverse(child => {
    if (child.userData.assetInstance) return;
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach(material => {
      Object.values(material as unknown as Record<string, unknown>).forEach(value => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      const shaderUniforms = (material as THREE.ShaderMaterial).uniforms;
      Object.values(shaderUniforms ?? {}).forEach(uniform => {
        if (uniform.value instanceof THREE.Texture) uniform.value.dispose();
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
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function radialTexture(): THREE.CanvasTexture {
  return canvasTexture((context, width, height) => {
    const gradient = context.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,.8)');
    gradient.addColorStop(.22, 'rgba(255,240,190,.42)');
    gradient.addColorStop(.62, 'rgba(255,188,102,.12)');
    gradient.addColorStop(1, 'rgba(255,150,80,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }, 128, 128);
}

function blend(from: [number, number, number], to: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

function surfaceTexture(input: PlanetVisualState): THREE.CanvasTexture {
  const config = planetVisualConfig(input.planet);
  const ocean = parseSrgbHex(config.oceanColor);
  const oceanDeep = blend(ocean, [5, 20, 40], 0.55);
  const land = parseSrgbHex(config.landColor);
  const landAccent = parseSrgbHex(config.landAccent);
  const ice = parseSrgbHex(config.iceColor);
  const hot = Math.max(0, Math.min(1, (input.planet.temperature - 300) / 150));
  const geology = Math.max(0, Math.min(1, input.planet.geological_activity));
  return canvasTexture((context, width, height) => {
    const pixels = context.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const u = x / width;
        const v = y / height;
        const sample = planetSurfaceSample(input.seed, u, v, input.planet);
        const detail = sample.elevation;
        let color: [number, number, number];
        if (sample.ocean) {
          color = blend(oceanDeep, ocean, 0.3 + sample.moisture * 0.42);
        } else if (sample.ice) {
          color = blend(land, ice, 0.72 + (1 - sample.temperature) * 0.2);
        } else {
          const relief = Math.max(0, Math.min(1, (detail - 0.34) * 1.25));
          color = blend(land, landAccent, relief * (0.55 + geology * 0.38));
          if (hot > 0.2) color = blend(color, [166, 111, 70], hot * 0.28);
          if (geology > 0.65 && detail > 0.69) color = blend(color, [105, 54, 46], (geology - 0.6) * 0.45);
        }
        if (sample.coast) color = blend(color, [190, 169, 117], 0.36);
        const index = (y * width + x) * 4;
        pixels.data[index] = color[0];
        pixels.data[index + 1] = color[1];
        pixels.data[index + 2] = color[2];
        pixels.data[index + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
  }, 1024, 512);
}

function bumpTexture(input: PlanetVisualState): THREE.CanvasTexture {
  return canvasTexture((context, width, height) => {
    const pixels = context.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sample = planetSurfaceSample(input.seed, x / width, y / height, input.planet);
        const value = Math.round(sample.elevation * 255);
        const index = (y * width + x) * 4;
        pixels.data[index] = value;
        pixels.data[index + 1] = value;
        pixels.data[index + 2] = value;
        pixels.data[index + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
  }, 256, 128);
}

function cloudTexture(input: PlanetVisualState): THREE.CanvasTexture {
  const config = planetVisualConfig(input.planet);
  return canvasTexture((context, width, height) => {
    const pixels = context.createImageData(width, height);
    const coverage = 0.51 - config.cloudOpacity * 0.18;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const density = fbmNoise2D(input.seed, x / width * 3.6, y / height * 2.2, 4, 'cloud');
        const alpha = Math.max(0, Math.min(0.82, (density - coverage) * 3.2)) * config.cloudOpacity * 3.2;
        const index = (y * width + x) * 4;
        pixels.data[index] = 224;
        pixels.data[index + 1] = 242;
        pixels.data[index + 2] = 240;
        pixels.data[index + 3] = Math.round(alpha * 255);
      }
    }
    context.putImageData(pixels, 0, 0);
  }, 512, 256);
}

function atmosphereMaterial(color: string, opacity: number, starDirection: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) }, glowOpacity: { value: opacity }, lightDirection: { value: starDirection.clone().normalize() } },
    vertexShader: 'varying vec3 viewNormal; varying vec3 viewDirection; varying vec3 worldNormal; void main() { vec4 viewPosition = modelViewMatrix * vec4(position, 1.0); viewNormal = normalize(normalMatrix * normal); worldNormal = normalize(mat3(modelMatrix) * normal); viewDirection = normalize(-viewPosition.xyz); gl_Position = projectionMatrix * viewPosition; }',
    fragmentShader: 'uniform vec3 glowColor; uniform float glowOpacity; uniform vec3 lightDirection; varying vec3 viewNormal; varying vec3 viewDirection; varying vec3 worldNormal; void main() { float rim = pow(1.0 - max(dot(viewNormal, viewDirection), 0.0), 2.9); float sun = 0.45 + 0.55 * max(dot(worldNormal, normalize(lightDirection)), 0.0); gl_FragColor = vec4(glowColor, rim * glowOpacity * sun); }',
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
}

function cityLightMaterial(starDirection: THREE.Vector3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { lightDirection: { value: starDirection.clone().normalize() } },
    vertexShader: 'attribute vec3 markerNormal; uniform vec3 lightDirection; varying float night; void main() { night = smoothstep(0.02, 0.58, -dot(normalize(markerNormal), lightDirection)); vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 2.8 * (12.0 / max(1.0, -mvPosition.z)); gl_Position = projectionMatrix * mvPosition; }',
    fragmentShader: 'varying float night; void main() { float disc = 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - 0.5)); if (disc <= 0.0) discard; gl_FragColor = vec4(1.0, 0.68, 0.28, disc * night * 0.62); }',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class PlanetRenderer {
  private readonly container: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvasHost: HTMLDivElement;
  private readonly controls: OrbitControls;
  private readonly content = new THREE.Group();
  private readonly reducedMotion: boolean;
  private readonly resizeObserver?: ResizeObserver;
  private readonly resizeListener: () => void;
  private planetGroup?: THREE.Group;
  private cloudLayer?: THREE.Object3D;
  private stationOrbit?: THREE.Group;
  private frame: number | undefined;
  private disposed = false;
  private visualRevision = 0;
  private starMaterial?: THREE.ShaderMaterial;

  constructor(container: HTMLElement) {
    this.container = container;
    this.reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#04070d');
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0.34, 0.04, 3.55);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.domElement.className = 'planet-3d-canvas';
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'Visualização 3D do planeta');
    this.container.querySelector('.planet-fallback-visual')?.remove();
    this.canvasHost = document.createElement('div');
    this.canvasHost.className = 'planet-3d-canvas-host';
    this.canvasHost.append(this.renderer.domElement);
    this.container.append(this.canvasHost);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 5.8;
    this.controls.target.set(-0.24, -0.16, 0);
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
    const revision = ++this.visualRevision;
    clearGroup(this.content);
    this.planetGroup = undefined;
    this.cloudLayer = undefined;
    this.stationOrbit = undefined;
    this.starMaterial = undefined;
    const planetGroup = new THREE.Group();
    this.planetGroup = planetGroup;
    const config = planetVisualConfig(input.planet);
    const star = starVisualConfig(input.star);
    const surface = new THREE.MeshStandardMaterial({ map: surfaceTexture(input), bumpMap: bumpTexture(input), bumpScale: 0.024, roughness: 0.8, metalness: 0 });
    planetGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1, 72, 56), surface));
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(1.01, 56, 40), new THREE.MeshStandardMaterial({ map: cloudTexture(input), color: '#e0edf0', transparent: true, opacity: 0.82, depthWrite: false, roughness: 1, metalness: 0 }));
    this.cloudLayer = cloud;
    planetGroup.add(cloud);
    const starDirection = STAR_POSITION.clone().normalize();
    planetGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.024, 56, 40), atmosphereMaterial(config.atmosphereColor, config.atmosphereOpacity * 1.2, starDirection)));
    planetGroup.scale.setScalar(1.06);
    input.districts.forEach((district, index) => this.addDistrict(planetGroup, input, district, index));
    this.addCityLights(planetGroup, input, starDirection);
    this.content.add(planetGroup);
    this.addLights(star);
    this.addNebula(input.seed);
    this.addStarVisual(star);
    this.addStarfield(input.seed);
    this.addOrbitLines(input.seed);
    if (hasShipyard(input.capacities.shipyard_slots)) this.addShipyard(revision);
    input.fleets.filter(fleet => fleetIsInSystem(fleet, input.systemX, input.systemY)).forEach((fleet, index) => this.addFleetMarker(index, revision, fleet.hullId));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.visualRevision += 1;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.resizeListener);
    this.controls.dispose();
    clearGroup(this.content);
    this.renderer.dispose();
    this.canvasHost.remove();
    this.planetGroup = undefined;
    this.cloudLayer = undefined;
    this.stationOrbit = undefined;
  }

  private animate = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    if (autoRotationEnabled(this.reducedMotion)) {
      if (this.planetGroup) this.planetGroup.rotation.y += 0.00034;
      if (this.cloudLayer) this.cloudLayer.rotation.y += 0.00062;
      if (this.stationOrbit) this.stationOrbit.rotation.y += 0.0009;
    }
    if (this.starMaterial) this.starMaterial.uniforms.time.value += 0.002;
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
    this.content.add(new THREE.HemisphereLight('#7899b8', '#02040a', 0.1));
    const key = new THREE.DirectionalLight(star.color, Math.min(2.4, star.intensity * 1.35));
    key.position.copy(STAR_POSITION);
    this.content.add(key);
  }

  private addNebula(seed: string): void {
    const texture = canvasTexture((context, width, height) => {
      context.clearRect(0, 0, width, height);
      for (let blob = 0; blob < 4; blob += 1) {
        const x = (0.2 + seededRandom(seed, 'nebula-x', blob) * 0.65) * width;
        const y = (0.2 + seededRandom(seed, 'nebula-y', blob) * 0.6) * height;
        const radius = width * (0.16 + seededRandom(seed, 'nebula-radius', blob) * 0.14);
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, blob % 2 ? 'rgba(62,108,143,.16)' : 'rgba(112,83,103,.11)');
        gradient.addColorStop(1, 'rgba(6,12,24,0)');
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    });
    const nebula = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    nebula.position.set(-1, 0.5, -12);
    nebula.scale.set(14, 8, 1);
    this.content.add(nebula);
  }

  private addStarVisual(star: { color: string; intensity: number; radius: number; haloOpacity: number }): void {
    const starGroup = new THREE.Group();
    starGroup.position.copy(STAR_POSITION);
    const material = new THREE.ShaderMaterial({
      uniforms: { starColor: { value: new THREE.Color(star.color) }, intensity: { value: star.intensity }, time: { value: 0 } },
      vertexShader: 'varying vec3 localPosition; void main() { localPosition = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 starColor; uniform float intensity; uniform float time; varying vec3 localPosition; float hash(vec3 p) { p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); } float noise(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f); float n = mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y), mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); return n; } float fbm(vec3 p) { float value = 0.0; float amplitude = .5; for (int octave = 0; octave < 3; octave++) { value += noise(p) * amplitude; p *= 2.0; amplitude *= .5; } return value; } void main() { float edge = pow(max(0.0, 1.0 - length(localPosition.xy) * .72), .22); float grain = fbm(localPosition * 7.0 + time * .02); float granulation = mix(.78, 1.08, grain); vec3 color = starColor * intensity * granulation; gl_FragColor = vec4(color * edge, 1.0); }',
      toneMapped: false,
    });
    this.starMaterial = material;
    starGroup.add(new THREE.Mesh(new THREE.SphereGeometry(star.radius, 40, 28), material));
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: star.color, transparent: true, opacity: star.haloOpacity * 2.2, depthWrite: false, blending: THREE.AdditiveBlending }));
    corona.scale.setScalar(star.radius * 3.2);
    starGroup.add(corona);
    this.content.add(starGroup);
  }

  private addStarfield(seed: string): void {
    starfieldLayers(seed).forEach(layer => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(layer.positions.flatMap(position => [position.x, position.y, position.z]), 3));
      this.content.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: layer.color, size: layer.size, sizeAttenuation: true, transparent: true, opacity: layer.opacity, depthWrite: false })));
    });
  }

  private addOrbitLines(seed: string): void {
    [[2.2, 0.72, -0.22], [2.65, 0.95, 0.36], [3.05, 1.16, -0.08]].forEach(([radiusX, radiusY, tilt], index) => {
      const points = new THREE.EllipseCurve(0, 0, radiusX, radiusY, 0, Math.PI * 2, false, seededRandom(seed, 'orbit-start', index) * Math.PI).getPoints(96);
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(point.x, point.y, 0)));
      const line = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: index === 1 ? '#7898ad' : '#526e84', transparent: true, opacity: index === 1 ? 0.18 : 0.1, depthWrite: false }));
      line.rotation.x = Math.PI / 2.2;
      line.rotation.z = tilt;
      this.content.add(line);
    });
  }

  private addDistrict(planetGroup: THREE.Group, input: PlanetVisualState, district: { id: string; category: string; level: number }, index: number): void {
    const placement = districtPlacement(input.seed, district.id, index, district.level);
    const position = latLonToVector3(placement.latitude, placement.longitude, 1.345);
    const color = this.districtColor(district.category);
    const marker = new THREE.Group();
    marker.position.set(position.x, position.y, position.z);
    marker.lookAt(0, 0, 0);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.72, emissive: color, emissiveIntensity: 0.16 });
    marker.add(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.022, 8), material));
    const clusterCount = Math.min(4, 1 + district.level);
    for (let unit = 0; unit < clusterCount; unit += 1) {
      const building = new THREE.Mesh(new THREE.BoxGeometry(0.025 + unit * 0.008, 0.018, 0.025), material);
      building.position.set((unit - 1) * 0.05, 0.022, (unit % 2 ? 1 : -1) * 0.035);
      marker.add(building);
    }
    marker.scale.setScalar(0.72 + Math.max(1, Math.min(3, district.level)) * 0.12);
    planetGroup.add(marker);
  }

  private addCityLights(planetGroup: THREE.Group, input: PlanetVisualState, starDirection: THREE.Vector3): void {
    const active = input.districts.filter(district => ['Civil', 'Industrial', 'Research'].includes(district.category));
    if (!active.length) return;
    const positions: number[] = [];
    const normals: number[] = [];
    active.forEach((district, districtIndex) => {
      const count = Math.min(10, 3 + district.level * 2);
      for (let index = 0; index < count; index += 1) {
        const placement = districtPlacement(input.seed, `night-${district.id}`, districtIndex + index, district.level);
        const position = latLonToVector3(placement.latitude, placement.longitude, 1.365);
        positions.push(position.x, position.y, position.z);
        const length = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
        normals.push(position.x / length, position.y / length, position.z / length);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('markerNormal', new THREE.Float32BufferAttribute(normals, 3));
    planetGroup.add(new THREE.Points(geometry, cityLightMaterial(starDirection)));
  }

  private addShipyard(revision: number): void {
    this.stationOrbit = new THREE.Group();
    this.stationOrbit.rotation.z = -0.28;
    this.stationOrbit.position.set(0, 0.1, 0.58);
    const station = new THREE.Group();
    station.position.set(1.24, 0.22, 0.34);
    station.name = 'procedural-fallback';
    station.scale.setScalar(1.74);
    const metal = new THREE.MeshStandardMaterial({ color: '#7f99a7', metalness: 0.68, roughness: 0.38 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: '#243b4a', metalness: 0.62, roughness: 0.46 });
    const glow = new THREE.MeshBasicMaterial({ color: '#71c2d0' });
    station.add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.026, 8, 32), metal));
    station.add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.014, 6, 24), darkMetal));
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), darkMetal);
    spine.rotation.z = Math.PI / 2;
    station.add(spine);
    station.add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.026, 0.1), metal));
    [-0.3, 0.3].forEach(x => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), darkMetal);
      arm.position.x = x;
      station.add(arm);
    });
    [-0.36, 0.36].forEach(x => {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.06, 0.16), metal);
      dock.position.set(x, 0, 0.02);
      station.add(dock);
    });
    [-0.12, 0.04, 0.2].forEach(x => {
      const window = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), glow);
      window.position.set(x, 0.03, 0.075);
      station.add(window);
    });
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 5), glow);
    antenna.position.set(0.04, 0.16, 0);
    station.add(antenna);
    this.stationOrbit.add(station);
    this.content.add(this.stationOrbit);
    void visualAssetRegistry.loadClone('orbital_shipyard').then(asset => {
      if (!asset || this.disposed || revision !== this.visualRevision || !this.stationOrbit) return;
      asset.position.copy(station.position);
      asset.rotation.copy(station.rotation);
      asset.scale.multiply(station.scale);
      this.stationOrbit.remove(station);
      disposeObject(station);
      this.stationOrbit.add(asset);
    });
  }

  private addFleetMarker(index: number, revision: number, hullId?: string): void {
    const orbit = new THREE.Group();
    orbit.rotation.y = index * 1.7;
    const marker = new THREE.Group();
    marker.position.set(1.75, -0.16 + index * 0.14, 0.95);
    marker.rotation.z = -0.45;
    marker.scale.setScalar(1.35);
    marker.add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 6), new THREE.MeshStandardMaterial({ color: '#b7dbe2', metalness: 0.3, roughness: 0.5, emissive: '#2e7e99', emissiveIntensity: 0.32 })));
    [-1, 1].forEach(side => {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.022, 0.06), new THREE.MeshStandardMaterial({ color: '#648a9b', metalness: 0.5, roughness: 0.5 }));
      wing.position.z = side * 0.09;
      wing.rotation.y = side * 0.25;
      marker.add(wing);
    });
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.034, 8, 6), new THREE.MeshBasicMaterial({ color: '#dcecf0' }));
    cockpit.position.y = 0.07;
    marker.add(cockpit);
    const engine = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: '#66cfe0' }));
    engine.position.y = -0.15;
    marker.add(engine);
    orbit.add(marker);
    this.content.add(orbit);
    const assetId = hullId === 'scout_hull' ? 'scout_hull' : undefined;
    if (!assetId) return;
    void visualAssetRegistry.loadClone(assetId).then(asset => {
      if (!asset || this.disposed || revision !== this.visualRevision) return;
      asset.position.copy(marker.position);
      asset.rotation.copy(marker.rotation);
      asset.scale.multiply(marker.scale);
      orbit.remove(marker);
      disposeObject(marker);
      orbit.add(asset);
    });
  }

  private districtColor(category: string): string {
    const colors: Record<string, string> = { mining: '#c99b5d', energy: '#8ec5d5', industrial: '#d18a6d', research: '#a99bc7', civil: '#8ebf9c', military: '#c77d7d', logistics: '#9db2c6' };
    return colors[category.toLowerCase()] ?? '#a8bbc9';
  }
}
