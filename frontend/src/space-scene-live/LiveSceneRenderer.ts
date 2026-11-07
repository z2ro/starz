import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { disposeLabObject } from '../planetlab/PlanetModel';
import { ShipPixelPipeline } from '../shipgeometrylab/ShipPixelPipeline';
import { DEFAULT_SHIP_SETTINGS } from '../shipgeometrylab/shipLabTypes';
import type { SpaceSceneDescriptor } from '../visual-state/types';
import { createLiveSceneModel } from './LiveSceneModel';
import { representativeShip } from './livePresentation';
import { PLANET_OUTER_RADIUS } from '../planetlab/PlanetModel';
import { heroFrustum, planetGuideFrame, type HeroInsets } from './heroFraming';

export type LiveRenderOptions = { raw: boolean; paused: boolean };
export type LiveSceneStats = { fps: number; frameTime: number; triangles: number; drawCalls: number; generationCount: number; renderResolution: string };

/** One persistent renderer; approved generators and pixel pipeline are reused verbatim. */
export class LiveSceneRenderer {
  private renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-3, 3, 2.2, -2.2, 0.1, 100);
  private model = createLiveSceneModel();
  private pipeline = new ShipPixelPipeline();
  private renderSettings = { ...DEFAULT_SHIP_SETTINGS, pixelSize: 3 };
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private sun = new THREE.DirectionalLight('#ffe8ba', 2.2);
  private sky = new THREE.Group();
  private frameId = 0;
  private lastTime = 0;
  private reportTime = 0;
  private frames = 0;
  private disposed = false;
  private options: LiveRenderOptions = { raw: false, paused: false };
  private heroInsets: HeroInsets | null = null;
  private shipVisible = false;
  constructor(private host: HTMLElement, private report: (stats: LiveSceneStats) => void, private onFailure?: (error: unknown) => void, private onPlanetFrame?: (frame: { left: number; top: number; size: number }) => void) {
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.info.autoReset = false; this.renderer.setClearColor('#030711');
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 20 });
    this.sun.shadow.bias = -0.00015; this.sun.shadow.normalBias = 0.015;
    this.renderer.domElement.className = 'live-scene-canvas'; this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Cena procedural baseada no estado do planeta selecionado');
    const points = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) { const angle = i * 2.399963, r = 8 + (i % 17) * 0.72; points.set([Math.cos(angle) * r, ((i * 37) % 100) / 100 * 7 - 3.5, Math.sin(angle) * r], i * 3); }
    this.sky.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(points, 3)), new THREE.PointsMaterial({ color: '#7898ac', size: 0.025, transparent: true, opacity: 0.58 })));
    this.scene.add(this.model.root, this.sky, this.sun, this.sun.target, new THREE.HemisphereLight('#9ccbdd', '#030711', 0.14));
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false; this.controls.enableDamping = true; this.controls.dampingFactor = 0.075;
    this.controls.addEventListener('change', this.reportPlanetFrame);
    this.controls.minZoom = 0.6; this.controls.maxZoom = 3;
    this.observer = new ResizeObserver(() => this.resize());
    this.resetCamera();
  }
  start() { this.host.appendChild(this.renderer.domElement); this.observer.observe(this.host); this.resize(); this.frameId = requestAnimationFrame(this.frame); }
  setDescriptor(descriptor: SpaceSceneDescriptor | null) {
    this.model.setDescriptor(descriptor);
    const shipVisible = representativeShip(descriptor) !== null;
    const shipChanged = shipVisible !== this.shipVisible; this.shipVisible = shipVisible;
    if (this.heroInsets && shipChanged) this.resize();
    if (descriptor) {
      const az = THREE.MathUtils.degToRad(descriptor.presentation.starAzimuth), el = THREE.MathUtils.degToRad(descriptor.presentation.starElevation);
      const direction = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
      this.sun.position.copy(direction).multiplyScalar(8); this.sun.intensity = descriptor.presentation.lightIntensity;
      this.model.setLightDirection(direction);
    }
    this.draw(); // Clear stale planet pixels immediately on selection/loading/error, before React paints.
  }
  setHeroInsets(insets: HeroInsets) { this.heroInsets = insets; this.resize(); this.draw(); }
  setOptions(options: LiveRenderOptions) {
    const resize = this.options.raw !== options.raw;
    this.options = options; this.renderSettings.raw = options.raw;
    if (resize) this.resize();
  }
  resetCamera() { this.camera.up.set(0, 1, 0); this.camera.position.set(3.4, 3.5, 4.6).normalize().multiplyScalar(8); this.camera.zoom = 1; this.controls.target.set(0, 0, 0); this.camera.lookAt(0, 0, 0); this.controls.update(); }
  private resize() {
    if (this.disposed) return;
    const rect = this.host.getBoundingClientRect(), width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    if (this.heroInsets) Object.assign(this.camera, heroFrustum(width, height, this.heroInsets, this.shipVisible));
    else { const span = Math.max(2.2, 2.8 * height / width); this.camera.top = span; this.camera.bottom = -span; this.camera.right = span * width / height; this.camera.left = -this.camera.right; }
    this.camera.updateProjectionMatrix();
    this.pipeline.resize(width, height, this.renderSettings); this.renderer.setSize(this.pipeline.width, this.pipeline.height, false);
    this.reportPlanetFrame();
    this.renderer.domElement.style.imageRendering = this.options.raw ? 'auto' : 'pixelated';
  }
  private reportPlanetFrame = () => {
    if (!this.onPlanetFrame) return;
    const { width, height } = this.host.getBoundingClientRect();
    this.onPlanetFrame(planetGuideFrame(width, height, this.camera, PLANET_OUTER_RADIUS * 1.08));
  };
  private draw() { this.renderer.info.reset(); this.pipeline.render(this.renderer, this.scene, this.camera, this.renderSettings); }
  private frame = (time: number) => {
    if (this.disposed) return;
    try {
    if (!this.lastTime) this.reportTime = time;
    const delta = this.lastTime ? Math.min(0.1, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time; this.model.update(delta, this.options.paused, this.pipeline.height); this.controls.update(); this.draw(); this.frames++;
    if (time - this.reportTime >= 600) {
      const interval = time - this.reportTime;
      this.report({ fps: Math.round(this.frames * 1000 / interval), frameTime: interval / this.frames, triangles: this.renderer.info.render.triangles, drawCalls: this.renderer.info.render.calls, generationCount: this.model.generationCount, renderResolution: `${this.pipeline.width} × ${this.pipeline.height}` });
      this.reportTime = time; this.frames = 0;
    }
    this.frameId = requestAnimationFrame(this.frame);
    } catch (error) { this.dispose(); if (this.onFailure) this.onFailure(error); else throw error; }
  };
  dispose() {
    if (this.disposed) return; this.disposed = true;
    cancelAnimationFrame(this.frameId); this.observer.disconnect(); this.controls.removeEventListener('change', this.reportPlanetFrame); this.controls.dispose(); this.model.dispose();
    disposeLabObject(this.sky); this.sun.shadow.dispose(); this.pipeline.dispose(); this.scene.clear(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
