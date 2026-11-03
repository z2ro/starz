import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createPrototypeShip } from './ShipGeometry';
import { shipFraming, SHIP_CAMERA_DIRECTIONS } from './shipCamera';
import { ShipPixelPipeline } from './ShipPixelPipeline';
import type { ShipCamera, ShipLabSettings, ShipLabStats } from './shipLabTypes';

export class ShipLabRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  private ship = createPrototypeShip();
  private pipeline = new ShipPixelPipeline();
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private boundsHelper: THREE.Box3Helper;
  private keyLight = new THREE.DirectionalLight('#ecf5ff', 3.2);
  private frameId = 0;
  private lastTime = 0;
  private reportTime = 0;
  private frames = 0;
  private elapsed = 0;
  private disposed = false;
  private meshCount = 0;

  constructor(private host: HTMLElement, private settings: ShipLabSettings, private onStats: (stats: ShipLabStats) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor('#030711');
    this.renderer.domElement.className = 'ship-lab-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Horizon Prototype — explorador experimental em 3D');
    this.renderer.domElement.tabIndex = 0;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 3;
    this.scene.add(this.ship.root, this.keyLight, this.keyLight.target);
    this.scene.add(new THREE.HemisphereLight('#c4e4ff', '#101b29', 0.75));
    const rim = new THREE.DirectionalLight('#78a5d5', 0.75);
    rim.position.set(5, 2, 8);
    this.scene.add(rim);
    this.boundsHelper = new THREE.Box3Helper(this.ship.bounds, '#79c5d6');
    this.scene.add(this.boundsHelper);
    this.ship.root.traverse(object => { if (object instanceof THREE.Mesh) this.meshCount += 1; });
    this.observer = new ResizeObserver(() => this.resize());
    this.setCamera('3/4 Front');
    this.setSettings(settings);
  }

  start() {
    this.host.appendChild(this.renderer.domElement);
    this.observer.observe(this.host);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  setCamera(preset: ShipCamera) {
    this.camera.zoom = 1;
    this.fit(new THREE.Vector3(...SHIP_CAMERA_DIRECTIONS[preset]));
  }

  private fit(direction: THREE.Vector3) {
    const rect = this.host.getBoundingClientRect();
    const framing = shipFraming(this.ship.bounds, Math.max(1, rect.width) / Math.max(1, rect.height), direction);
    this.camera.position.copy(framing.position);
    this.camera.top = framing.halfHeight;
    this.camera.bottom = -framing.halfHeight;
    this.camera.right = framing.halfHeight * Math.max(1, rect.width) / Math.max(1, rect.height);
    this.camera.left = -this.camera.right;
    this.camera.far = framing.distance * 3;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(framing.center);
    this.camera.lookAt(framing.center);
    this.controls.update();
  }

  setSettings(settings: ShipLabSettings) {
    const previous = this.settings;
    this.settings = settings;
    this.ship.update(settings);
    this.boundsHelper.visible = settings.boundingBox;
    const azimuth = THREE.MathUtils.degToRad(settings.azimuth), elevation = THREE.MathUtils.degToRad(settings.elevation);
    this.keyLight.position.set(Math.cos(azimuth) * Math.cos(elevation) * 15, Math.sin(elevation) * 15, Math.sin(azimuth) * Math.cos(elevation) * 15);
    this.keyLight.intensity = settings.intensity;
    if (previous.pixelSize !== settings.pixelSize || previous.raw !== settings.raw) this.resize();
  }

  private resize() {
    const rect = this.host.getBoundingClientRect();
    const direction = this.camera.position.clone().sub(this.controls.target);
    this.fit(direction);
    this.pipeline.resize(Math.max(1, rect.width), Math.max(1, rect.height), this.settings);
    this.renderer.setSize(this.pipeline.width, this.pipeline.height, false);
    this.renderer.domElement.style.imageRendering = this.settings.raw ? 'auto' : 'pixelated';
  }

  private frame = (time: number) => {
    if (this.disposed) return;
    if (!this.lastTime) this.reportTime = time;
    const dt = this.lastTime ? Math.min(0.1, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time;
    if (!this.settings.paused) this.elapsed += dt;
    this.ship.coreMaterial.emissiveIntensity = this.settings.engineEmission * (1 + Math.sin(this.elapsed * 1.6) * 0.035);
    this.controls.update();
    this.renderer.info.reset();
    this.pipeline.render(this.renderer, this.scene, this.camera, this.settings);
    this.frames += 1;
    if (time - this.reportTime > 600) {
      const interval = time - this.reportTime;
      this.onStats({ fps: Math.round(this.frames * 1000 / interval), frameTime: interval / this.frames,
        triangles: this.renderer.info.render.triangles, drawCalls: this.renderer.info.render.calls,
        meshes: this.meshCount, bounds: this.ship.bounds.getSize(new THREE.Vector3()).toArray(),
        resolution: `${this.pipeline.width} × ${this.pipeline.height}` });
      this.frames = 0;
      this.reportTime = time;
    }
    this.frameId = requestAnimationFrame(this.frame);
  };

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.controls.dispose();
    this.ship.dispose();
    this.boundsHelper.geometry.dispose();
    const materials = Array.isArray(this.boundsHelper.material) ? this.boundsHelper.material : [this.boundsHelper.material];
    materials.forEach(material => material.dispose());
    this.pipeline.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
