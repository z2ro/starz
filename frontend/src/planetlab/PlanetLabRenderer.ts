import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLabPlanet, disposeLabObject } from './PlanetModel';
import type { CameraPreset, PlanetGenerationDiagnostics, PlanetLabSettings, PlanetLabStats } from './planetLabTypes';
export { disposeLabObject } from './PlanetModel';

const PALETTE = [
  '#020711', '#081425', '#102a40', '#183f55', '#0b4a63', '#14728a',
  '#214f43', '#3e7150', '#6f8b4a', '#9b874f', '#b69e62', '#6a4c34',
  '#5d5e5a', '#9ab7aa', '#c9e1e4', '#f3fbf8', '#496d95', '#78a9bf',
  '#2a7897', '#8bb8c7', '#d3d9cc', '#e5edf0', '#4e3875', '#c0a75b',
  '#061019', '#0c202c', '#123948', '#19536b', '#1c5d78', '#33899a',
  '#172f2c', '#2f5940', '#55754b', '#7c925b', '#b7a77c', '#d0bc8e',
  '#333d3d', '#788582', '#acc8ca', '#dcecef', '#304b65', '#587c95',
  '#306172', '#6699a6', '#8a938d', '#b4c2bf', '#25304a', '#e0cd9a',
];

const POST_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAGMENT = `
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform float uOutline;
uniform float uDither;
uniform vec3 uPalette[${PALETTE.length}];
varying vec2 vUv;

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float x0 = mod(q.x, 2.0), x1 = floor(q.x / 2.0);
  float y0 = mod(q.y, 2.0), y1 = floor(q.y / 2.0);
  return (abs(x0 - y0) * 8.0 + y0 * 4.0 + abs(x1 - y1) * 2.0 + y1 + 0.5) / 16.0;
}

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toOklab(vec3 c) {
  c = max(toLinear(c), 0.0);
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 0.3333333);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 0.3333333);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 0.3333333);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

void main() {
  vec4 source = texture2D(uColor, vUv);
  vec3 exposed = source.rgb * 1.08;
  vec3 mapped = clamp((exposed * (2.51 * exposed + 0.03)) / (exposed * (2.43 * exposed + 0.59) + 0.14), 0.0, 1.0);
  vec3 displayColor = mix(mapped * 12.92, 1.055 * pow(mapped, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), mapped));
  vec3 lab = toOklab(displayColor + (bayer4(floor(vUv / uTexel)) - 0.5) * uDither * 0.035);
  float centerDepth = texture2D(uDepth, vUv).r;
  float edge = 0.0;
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r));
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r));
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r));
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r));
  if (uOutline > 0.5 && edge > 0.016) lab = mix(lab, vec3(lab.x * 0.68, lab.y * 0.62, lab.z * 0.62), 0.72);
  float best = 1e6;
  vec3 outputColor = uPalette[0];
  for (int index = 0; index < ${PALETTE.length}; index++) {
    vec3 paletteLab = toOklab(uPalette[index]);
    vec3 delta = paletteLab - lab;
    float distance = delta.x * delta.x * 1.25 + delta.y * delta.y + delta.z * delta.z;
    if (distance < best) { best = distance; outputColor = uPalette[index]; }
  }
  gl_FragColor = vec4(outputColor, 1.0);
}`;

const paletteVectors = PALETTE.map(hex => {
  const color = new THREE.Color(hex).convertLinearToSRGB();
  return new THREE.Vector3(color.r, color.g, color.b);
});


export class PlanetLabRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
  private controls: OrbitControls;
  private renderTarget: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private postMaterial: THREE.ShaderMaterial;
  private postQuad: THREE.Mesh;
  private root = new THREE.Group();
  private planetGroup = new THREE.Group();
  private cloudLayer?: THREE.Mesh;
  private ship = new THREE.Group();
  private starLight = new THREE.DirectionalLight(0xffe8ba, 2.2);
  private star?: THREE.Mesh;
  private settings: PlanetLabSettings;
  private animationFrame = 0;
  private lastTime = 0;
  private orbitAngle = 0.3;
  private statsTime = 0;
  private frames = 0;
  private width = 1;
  private height = 1;
  private onStats?: (stats: PlanetLabStats) => void;
  private resizeObserver: ResizeObserver;
  private generationKey = '';
  private generationDiagnostics?: PlanetGenerationDiagnostics;

  constructor(private host: HTMLElement, settings: PlanetLabSettings, onStats?: (stats: PlanetLabStats) => void) {
    this.settings = settings;
    this.onStats = onStats;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.info.autoReset = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x030711, 1);
    this.renderTarget = this.createRenderTarget(64, 64);
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERTEX,
      fragmentShader: POST_FRAGMENT,
      uniforms: {
        uColor: { value: this.renderTarget.texture },
        uDepth: { value: this.renderTarget.depthTexture },
        uTexel: { value: new THREE.Vector2(1 / 64, 1 / 64) },
        uOutline: { value: 1 },
        uDither: { value: 1 },
        uPalette: { value: paletteVectors },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postQuad.frustumCulled = false;
    this.postScene.add(this.postQuad);
    this.camera.position.set(3.2, 2.2, 4.6);
    this.scene.add(this.root, this.starLight, this.starLight.target);
    this.root.add(this.planetGroup, this.ship);
    this.createStarfield();
    this.star = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffe7a8 }));
    this.root.add(this.star);
    this.updateStarPosition(settings);
    this.createShip();
    this.createPlanet(settings);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minZoom = 0.72;
    this.controls.maxZoom = 2.2;
    this.controls.target.set(0, 0, 0);
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  start() {
    this.host.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'planet-lab-canvas';
    this.resizeObserver.observe(this.host);
    this.resize();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  setSettings(settings: PlanetLabSettings) {
    const previous = this.settings;
    this.settings = settings;
    this.planetGroup.rotation.z = THREE.MathUtils.degToRad(settings.axialTilt);
    const oldGeneration = this.generationKey;
    const nextGeneration = this.getGenerationKey(settings);
    if (oldGeneration !== nextGeneration) this.createPlanet(settings);
    this.starLight.intensity = settings.lightIntensity;
    this.updateStarPosition(settings);
    this.postMaterial.uniforms.uOutline.value = settings.outline ? 1 : 0;
    this.postMaterial.uniforms.uDither.value = settings.dither ? 1 : 0;
    if (previous.raw3d !== settings.raw3d || previous.pixelSize !== settings.pixelSize) this.resize();
  }

  setCameraPreset(preset: CameraPreset) {
    const positions: Record<CameraPreset, THREE.Vector3> = {
      cinematic: new THREE.Vector3(3.2, 2.2, 4.6),
      equatorial: new THREE.Vector3(0.2, 0.18, 5.4),
      polar: new THREE.Vector3(0.2, 5.2, 2.1),
      'full-orbit': new THREE.Vector3(-4.5, 2.9, 3.4),
    };
    this.camera.position.copy(positions[preset]);
    this.camera.zoom = preset === 'polar' ? 1.05 : 1;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resetCamera() { this.setCameraPreset('cinematic'); }

  dispose() {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    disposeLabObject(this.root);
    this.postQuad.geometry.dispose();
    this.postMaterial.dispose();
    this.renderTarget.depthTexture?.dispose();
    this.renderTarget.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private createRenderTarget(width: number, height: number) {
    const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    return new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      depthTexture,
    });
  }

  private getGenerationKey(settings: PlanetLabSettings) {
    return [settings.family, settings.seed, settings.waterCoverage, settings.temperature, settings.mountainIntensity, settings.cloudCoverage, settings.continentScale, settings.warpStrength, settings.moistureBias, settings.regeneration].join('|');
  }

  private createPlanet(settings: PlanetLabSettings) {
    this.generationKey = this.getGenerationKey(settings);
    this.root.remove(this.planetGroup);
    disposeLabObject(this.planetGroup);
    const planet = createLabPlanet(settings);
    this.planetGroup = planet.root;
    this.cloudLayer = planet.cloudLayer;
    this.generationDiagnostics = planet.diagnostics;
    this.root.add(this.planetGroup);
  }

  private createStarfield() {
    const positions = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index += 1) {
      const angle = index * 2.399963;
      const radius = 8 + (index % 17) * 0.72;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = ((index * 37) % 100) / 100 * 7 - 3.5;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.root.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x7898ac, size: 0.025, sizeAttenuation: true, transparent: true, opacity: 0.58 })));
  }

  private createShip() {
    const hullMaterial = new THREE.MeshStandardMaterial({ color: 0xb7c9cc, metalness: 0.62, roughness: 0.34 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x243a4a, metalness: 0.72, roughness: 0.3 });
    const cyanMaterial = new THREE.MeshStandardMaterial({ color: 0x70d6e6, emissive: 0x2c9db4, emissiveIntensity: 1.5, metalness: 0.25, roughness: 0.28 });
    const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 6, 12), hullMaterial);
    hull.rotation.x = Math.PI / 2;
    this.ship.add(hull);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 8), hullMaterial);
    nose.rotation.x = -Math.PI / 2;
    nose.position.z = 0.24;
    this.ship.add(nose);
    const wingGeometry = new THREE.BoxGeometry(0.27, 0.018, 0.16);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeometry, darkMaterial);
      wing.position.set(side * 0.13, -0.015, -0.02);
      wing.rotation.y = side * 0.12;
      this.ship.add(wing);
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.14, 8), cyanMaterial);
      engine.rotation.z = Math.PI / 2;
      engine.position.set(side * 0.17, -0.015, -0.14);
      this.ship.add(engine);
    }
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 6), cyanMaterial);
    sensor.position.set(0, 0.045, 0.11);
    this.ship.add(sensor);
    this.ship.scale.setScalar(0.8);
    this.ship.position.set(1.5, 0.12, 0);
    this.ship.userData.orbitRadius = 1.53;
  }

  private updateStarPosition(settings: PlanetLabSettings) {
    const azimuth = THREE.MathUtils.degToRad(settings.starAzimuth);
    const elevation = THREE.MathUtils.degToRad(settings.starElevation);
    const direction = new THREE.Vector3(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)).normalize();
    this.starLight.position.copy(direction).multiplyScalar(6);
    this.starLight.target.position.set(0, 0, 0);
    this.starLight.target.updateMatrixWorld();
    if (this.star) this.star.position.copy(direction).multiplyScalar(5.4);
    this.planetGroup.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) object.material.uniforms.uLight.value.copy(direction);
    });
  }

  private resize() {
    const rect = this.host.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    const aspect = this.width / this.height;
    const span = 2.15;
    this.camera.left = -span * aspect;
    this.camera.right = span * aspect;
    this.camera.top = span;
    this.camera.bottom = -span;
    this.camera.updateProjectionMatrix();
    const pixelSize = this.settings.raw3d ? 1 : this.settings.pixelSize;
    const targetWidth = Math.max(96, Math.floor(this.width / pixelSize));
    const targetHeight = Math.max(64, Math.floor(this.height / pixelSize));
    this.renderer.setSize(targetWidth, targetHeight, false);
    this.renderer.domElement.style.imageRendering = this.settings.raw3d ? 'auto' : 'pixelated';
    this.renderTarget.setSize(targetWidth, targetHeight);
    this.postMaterial.uniforms.uTexel.value.set(1 / targetWidth, 1 / targetHeight);
  }

  private readonly frame = (time: number) => {
    const delta = this.lastTime ? Math.min(0.1, (time - this.lastTime) / 1000) : 1 / 60;
    if (!this.lastTime) this.statsTime = time;
    this.lastTime = time;
    if (!this.settings.paused) {
      this.planetGroup.rotation.y += delta * this.settings.planetRotationSpeed;
      if (this.cloudLayer) this.cloudLayer.rotation.y += delta * this.settings.planetRotationSpeed * 1.35;
      this.orbitAngle += delta * this.settings.shipOrbitSpeed;
      const orbitRadius = this.ship.userData.orbitRadius as number;
      const angle = this.orbitAngle;
      const position = new THREE.Vector3(Math.cos(angle) * orbitRadius, Math.sin(angle) * 0.3, Math.sin(angle) * orbitRadius);
      const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle) * 0.3 / orbitRadius, Math.cos(angle)).normalize();
      this.ship.position.copy(position);
      this.ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    }
    this.controls.update();
    this.renderer.info.reset();
    if (this.settings.raw3d) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.setRenderTarget(this.renderTarget);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      this.renderer.render(this.postScene, this.postCamera);
    }
    this.frames += 1;
    if (time - this.statsTime > 500) {
      const elapsed = Math.max(1, time - this.statsTime);
      this.onStats?.({ fps: Math.round((this.frames * 1000) / elapsed), frameTime: elapsed / Math.max(1, this.frames), triangles: this.renderer.info.render.triangles, drawCalls: this.renderer.info.render.calls, seed: this.settings.seed, renderResolution: `${this.renderTarget.width} × ${this.renderTarget.height}`, generation: this.generationDiagnostics });
      this.frames = 0;
      this.statsTime = time;
    }
    this.animationFrame = requestAnimationFrame(this.frame);
  };

}

export function planetLabPaletteSize() { return PALETTE.length; }
