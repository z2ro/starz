import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PLANET_RADIUS, disposeLabObject } from '../planetlab/PlanetModel';
import { ShipPixelPipeline } from '../shipgeometrylab/ShipPixelPipeline';
import { DEFAULT_SHIP_SETTINGS } from '../shipgeometrylab/shipLabTypes';
import { shipFraming } from '../shipgeometrylab/shipCamera';
import { orbitCameraSpan, shipCenterOccluded } from './orbit';
import { createSpaceSceneModel } from './SpaceSceneModel';
import type { SpaceCamera, SpaceSceneSettings, SpaceSceneStats } from './spaceSceneTypes';

export class SpaceSceneRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private model: ReturnType<typeof createSpaceSceneModel>;
  private camera = new THREE.OrthographicCamera(-3, 3, 3, -3, 0.1, 100);
  private controls: OrbitControls;
  private pipeline = new ShipPixelPipeline();
  private renderOptions = { ...DEFAULT_SHIP_SETTINGS };
  private observer: ResizeObserver;
  private sun = new THREE.DirectionalLight('#ffe8ba', 2.2);
  private background = new THREE.Group();
  private star = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 8), new THREE.MeshBasicMaterial({ color: '#ffe7a8' }));
  private mode: SpaceCamera = 'Cinematic';
  private frameId = 0;
  private lastTime = 0;
  private reportTime = 0;
  private frames = 0;
  private disposed = false;
  private oldShipPosition = new THREE.Vector3();
  private oldShipRotation = new THREE.Quaternion();
  private rotationDelta = new THREE.Quaternion();
  private cameraDirection = new THREE.Vector3();
  private sunDirection = new THREE.Vector3();

  constructor(private host: HTMLElement, private settings: SpaceSceneSettings, private onStats: (stats: SpaceSceneStats) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.info.autoReset = false;
    this.renderer.setClearColor('#030711');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'space-scene-canvas';
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute('aria-label', 'Planeta procedural e Horizon Prototype em órbita');
    this.model = createSpaceSceneModel(settings);
    this.scene.add(this.model.root, this.background, this.sun, this.sun.target);
    this.scene.add(new THREE.HemisphereLight('#9ccbdd', '#030711', 0.14));
    this.background.add(this.star);
    this.createStarfield();
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 20 });
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.015;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.minZoom = 0.6;
    this.controls.maxZoom = 3;
    this.observer = new ResizeObserver(() => this.resize());
    this.setSettings(settings);
    this.setCamera('Cinematic');
  }

  start() {
    this.host.appendChild(this.renderer.domElement);
    this.observer.observe(this.host);
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  setSettings(settings: SpaceSceneSettings) {
    const previous = this.settings;
    this.rememberShip();
    this.settings = settings;
    this.model.setSettings(settings);
    this.followShip();
    this.renderOptions.pixelSize = settings.pixelSize;
    this.renderOptions.outlines = settings.outlines;
    this.renderOptions.dither = settings.dither;
    this.renderOptions.raw = settings.raw;
    const azimuth = THREE.MathUtils.degToRad(settings.starAzimuth), elevation = THREE.MathUtils.degToRad(settings.starElevation);
    this.sunDirection.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth)).normalize();
    this.sun.position.copy(this.sunDirection).multiplyScalar(8);
    this.star.position.copy(this.sunDirection).multiplyScalar(4);
    this.sun.intensity = settings.intensity;
    this.model.setLightDirection(this.sunDirection);
    if (previous.pixelSize !== settings.pixelSize || previous.raw !== settings.raw || previous.orbitRadius !== settings.orbitRadius || previous.orbitInclination !== settings.orbitInclination || previous.shipLength !== settings.shipLength) this.resize();
  }

  setCamera(mode: SpaceCamera) {
    this.mode = mode;
    this.star.visible = mode !== 'Ship Focus';
    this.camera.up.set(0, 1, 0);
    this.camera.zoom = 1;
    this.fitCamera(true);
  }

  private fitCamera(reset: boolean) {
    const rect = this.host.getBoundingClientRect();
    const aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    let target = new THREE.Vector3(), direction = this.camera.position.clone().sub(this.controls.target);
    if (reset) {
      if (this.mode === 'Orbit Overview') direction.set(2, 6, -3);
      else if (this.mode === 'Planet Focus') direction.set(3.2, 2.2, 4.6);
      else direction.set(3.4, 3.5, 4.6);
      if (this.mode === 'Ship Focus') {
        direction.copy(this.model.shipPivot.position).normalize().multiplyScalar(0.8);
        direction.addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(this.model.shipPivot.quaternion), 0.5);
        direction.y += 0.4;
      }
    }
    direction.normalize();
    let halfHeight: number, distance = 8;
    if (this.mode === 'Ship Focus') {
      const localDirection = direction.clone().applyQuaternion(this.model.shipPivot.quaternion.clone().invert());
      const framing = shipFraming(this.model.ship.bounds, aspect, localDirection);
      const scale = this.model.shipPresentation.scale.x;
      target.copy(this.model.shipPivot.position);
      halfHeight = framing.halfHeight * scale;
      distance = framing.distance * scale;
    } else {
      halfHeight = this.mode === 'Planet Focus' ? 2.15 : orbitCameraSpan(this.model.radius, this.model.shipRadius, this.settings.orbitInclination, aspect, direction, this.mode === 'Orbit Overview');
    }
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.right = halfHeight * aspect;
    this.camera.left = -this.camera.right;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(target);
    this.camera.lookAt(target);
    this.controls.update();
  }

  private resize() {
    const rect = this.host.getBoundingClientRect();
    this.fitCamera(false);
    this.pipeline.resize(Math.max(1, rect.width), Math.max(1, rect.height), this.renderOptions);
    this.renderer.setSize(this.pipeline.width, this.pipeline.height, false);
    this.renderer.domElement.style.imageRendering = this.settings.raw ? 'auto' : 'pixelated';
  }

  private rememberShip() {
    this.oldShipPosition.copy(this.model.shipPivot.position);
    this.oldShipRotation.copy(this.model.shipPivot.quaternion);
  }

  private followShip() {
    if (this.mode !== 'Ship Focus') return;
    this.rotationDelta.copy(this.oldShipRotation).invert().premultiply(this.model.shipPivot.quaternion);
    this.camera.position.sub(this.oldShipPosition).applyQuaternion(this.rotationDelta).add(this.model.shipPivot.position);
    this.controls.target.copy(this.model.shipPivot.position);
  }

  private createStarfield() {
    const points = new Float32Array(180 * 3);
    for (let index = 0; index < 180; index++) {
      const angle = index * 2.399963, radius = 8 + (index % 17) * 0.72;
      points.set([Math.cos(angle) * radius, ((index * 37) % 100) / 100 * 7 - 3.5, Math.sin(angle) * radius], index * 3);
    }
    this.background.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.PointsMaterial({ color: '#7898ac', size: 0.025, transparent: true, opacity: 0.58 })));
  }

  private frame = (time: number) => {
    if (this.disposed) return;
    if (!this.lastTime) this.reportTime = time;
    const delta = this.lastTime ? Math.min(0.1, (time - this.lastTime) / 1000) : 0;
    this.lastTime = time;
    this.rememberShip();
    this.model.update(delta);
    this.followShip();
    this.controls.update();
    this.renderer.info.reset();
    this.pipeline.render(this.renderer, this.scene, this.camera, this.renderOptions);
    this.frames += 1;
    if (time - this.reportTime > 500) {
      const interval = time - this.reportTime;
      this.cameraDirection.copy(this.camera.position).sub(this.controls.target).normalize();
      this.onStats({ fps: Math.round(this.frames * 1000 / interval), frameTime: interval / this.frames,
        triangles: this.renderer.info.render.triangles, drawCalls: this.renderer.info.render.calls,
        resolution: `${this.pipeline.width} × ${this.pipeline.height}`, orbitPhase: this.model.phase,
        shipCenterOccluded: shipCenterOccluded(this.model.shipPivot.position, this.cameraDirection, PLANET_RADIUS),
        visualTime: this.model.visualTime, safeRadius: this.model.radius });
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
    this.model.dispose();
    disposeLabObject(this.background);
    this.sun.shadow.dispose();
    this.pipeline.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
