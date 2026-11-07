import {planetIdentity} from './planetIdentity';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLabPlanet, disposeLabObject } from '../planetlab/PlanetModel';
import { ShipPixelPipeline } from '../shipgeometrylab/ShipPixelPipeline';
import { DEFAULT_SHIP_SETTINGS } from '../shipgeometrylab/shipLabTypes';
import { FLEET_DESIGNS } from '../shipgeometrylab/FleetStudy';
import { designForHull, type ShipDesignId } from '../visual/ShipDesignRegistry';
import type { Catalog, GalaxySystem, State } from '../types/game';
import { knownLocalFleets, orbitalPlanets, orbitalPosition, systemKey } from './galaxyPresentation';

type PlanetModel = ReturnType<typeof createLabPlanet>;
/** One context only while the orbital workspace is open. All distances are display units. */
export class OrbitalSystemRenderer {
  private renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-8, 8, 6, -6, .1, 150);
  private controls: OrbitControls;
  private pipeline = new ShipPixelPipeline();
  private settings = { ...DEFAULT_SHIP_SETTINGS, pixelSize: 2 };
  private observer: ResizeObserver;
  private selectedOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:80},(_,i)=>new THREE.Vector3(Math.cos(i/80*Math.PI*2),Math.sin(i/80*Math.PI*2),0))),new THREE.LineBasicMaterial({color:'#83e5e5',depthTest:true,depthWrite:false}));
  private star = new THREE.Mesh(new THREE.SphereGeometry(.85, 20, 12), new THREE.MeshBasicMaterial({ color: '#ffe1a0', toneMapped: false }));
  private sky = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 450 }, (_, i) => ((i * 137.507 % 1) - .5) * 50), 3)), new THREE.PointsMaterial({ color: '#64788b', size: .027, sizeAttenuation: true }));
  private orbitGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * Math.PI * 2), 0, Math.sin(i / 160 * Math.PI * 2))));
  private orbitMaterial = new THREE.LineBasicMaterial({ color: '#42677d', transparent: true, opacity: .55 });
  private orbits = new THREE.Group();
  private ships = new THREE.Group();
  private shipCache = new Map<ShipDesignId, ReturnType<typeof FLEET_DESIGNS[number]['create']>>();
  private planets: { model: PlanetModel; index: number; slot: number; label: HTMLButtonElement; labelWidth: number; labelHeight: number }[] = [];
  private labels = document.createElement('div');
  private projection = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private down = { x: 0, y: 0 };
  private width = 1;
  private height = 1;
  private span = 6;
  private frameId = 0;
  private disposed = false;
  private dirty = true;
  private geographyKey = '';
  private generationCount = 0;
  private fleetKey = '';
  private system: GalaxySystem | null = null;
  private epoch = 0;
  private lastObserved: number | undefined;
  private received = performance.now();
  private paused = false;
  private frozenTime = 0;
  private selectedIndex: number | undefined;
  constructor(private host: HTMLElement, private selectPlanet: (index: number) => void, private selectFleet: (id: string) => void, private fail: (error: unknown) => void) {
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor('#030711'); this.renderer.info.autoReset = false;
    const canvas = this.renderer.domElement; canvas.className = 'orbital-canvas'; canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Vista orbital interativa: arraste para girar e use roda ou pinça para zoom');
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.enablePan = false; this.controls.zoomToCursor = true;
    this.controls.minZoom = .65; this.controls.maxZoom = 5; this.controls.maxPolarAngle = Math.PI * .82;
    this.labels.className = 'orbital-labels'; this.host.append(canvas, this.labels);
    this.selectedOutline.visible=false;
    this.scene.add(this.selectedOutline,this.star, this.sky, this.orbits, this.ships, new THREE.PointLight('#ffe2b6', 3.1, 0, 0), new THREE.HemisphereLight('#9ab9cc', '#030711', .15));
    canvas.addEventListener('pointerdown', this.pointerDown); canvas.addEventListener('pointerup', this.pointerUp); canvas.addEventListener('webglcontextlost', this.contextLost);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resetCamera(); this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }
  private pointerDown = (event: PointerEvent) => { this.down = { x: event.clientX, y: event.clientY }; };
  private pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 6) return;
    const box = this.host.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects([this.star, ...this.planets.map(p => p.model.root), this.ships], true)[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object) {
      if (typeof object.userData.planetIndex === 'number') { this.selectPlanet(object.userData.planetIndex); return; }
      if (typeof object.userData.fleetId === 'string') { this.selectFleet(object.userData.fleetId); return; }
      object = object.parent;
    }
  };
  private contextLost = (event: Event) => { event.preventDefault(); this.fail(new Error('Conexão WebGL interrompida. Volte ao mapa para tentar novamente.')); };
  setSystem(system: GalaxySystem, state: State, catalog: Catalog) {
    if (system.knowledge_level !== 'SURVEYED') throw new Error('Sistema não mapeado.');
    const changedSystem = !this.system || systemKey(system) !== systemKey(this.system);
    const models = orbitalPlanets(system), key = JSON.stringify(models.map(p => [p.planet.planet_index, p.settings, p.atmosphere]));
    this.system = system; this.dirty = true;
    if (Number.isFinite(state.observed_at) && (this.lastObserved === undefined || state.observed_at! > this.lastObserved)) { this.lastObserved = state.observed_at; this.epoch = state.observed_at!; this.received = performance.now(); }
    if (key !== this.geographyKey) {
      this.planets.forEach(p => { this.scene.remove(p.model.root); disposeLabObject(p.model.root); p.label.remove(); }); this.planets = []; this.orbits.clear();
      models.forEach(({ planet, settings, atmosphere }, slot) => {
        const model = createLabPlanet(settings); model.root.scale.setScalar(.37 + (planet.planet_index % 3) * .035);
        model.root.userData.planetIndex = planet.planet_index; model.atmosphere.visible = atmosphere.visible;
        const label = document.createElement('button'); label.type = 'button'; label.textContent = planet.name; label.dataset.planetIndex = String(planet.planet_index);
        label.setAttribute('aria-label', `Inspecionar planeta ${planet.name}`); label.onclick = () => this.selectPlanet(planet.planet_index); this.labels.append(label);
        this.planets.push({ model, index: planet.planet_index, slot, label, labelWidth: label.offsetWidth || 170, labelHeight: label.offsetHeight || 44 }); this.scene.add(model.root);
        const orbit = new THREE.LineLoop(this.orbitGeometry, this.orbitMaterial); const radius = orbitalPosition(system, planet.planet_index, 0, slot).radius; orbit.scale.set(radius, 1, radius); this.orbits.add(orbit);
      });
      this.host.dataset.generationCount = String(++this.generationCount);
      this.geographyKey = key; this.span = Math.max(4.5, 2.25 + Math.max(0, models.length - 1) * 1.65 + 1.2);
    }
    this.planets.forEach(p => {
      const planet = system.planets?.find(item => item.planet_index === p.index); if(!planet)return;
      const identity = planetIdentity(system,planet,state.planets), text=`P${identity.ordinal} · ${planet.name} · ${identity.label}`;
      if(p.label.getAttribute('aria-label') !== `Inspecionar planeta ${text}`){
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS('http://www.w3.org/2000/svg','path');
        icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('class',`planet-mark planet-mark-${identity.kind}`);icon.setAttribute('aria-hidden','true');path.setAttribute('d',identity.path);path.setAttribute('fill','currentColor');path.setAttribute('fill-rule','evenodd');icon.append(path);
        const name=document.createElement('strong'),status=document.createElement('span');name.textContent=`P${identity.ordinal} · ${planet.name}`;status.textContent=identity.label;
        p.label.replaceChildren(icon,name,status);p.label.dataset.ownership=identity.kind;p.label.setAttribute('aria-label',`Inspecionar planeta ${text}`);
        const hidden=p.label.hidden;p.label.hidden=false;p.labelWidth=p.label.offsetWidth||200;p.labelHeight=p.label.offsetHeight||44;p.label.hidden=hidden;
      }
    });
    const fleets = knownLocalFleets(system, state.fleets);
    const fleetKey = JSON.stringify(fleets.map(f => [f.id, f.ship_ids, f.ship_ids.map(id => state.ships.find(s => s.id === id)?.hull_id)]));
    if (fleetKey !== this.fleetKey) {
      this.ships.clear();
      fleets.forEach((fleet, i) => {
        const designs = [...new Set(fleet.ship_ids.map(id => {
          const ship = state.ships.find(s => s.id === id); return designForHull(catalog.ships.find(h => h.id === ship?.hull_id));
        }).filter((id): id is ShipDesignId => id !== null))];
        designs.forEach((design, j) => {
          let source = this.shipCache.get(design);
          if (!source) { source = FLEET_DESIGNS.find(d => d.id === design)!.create(); this.shipCache.set(design, source); }
          const display = new THREE.Group(), clone = source.root.clone(true), size = source.bounds.getSize(new THREE.Vector3());
          clone.position.copy(source.bounds.getCenter(new THREE.Vector3())).negate(); display.add(clone); display.scale.setScalar(.75 / Math.max(size.x, size.y, size.z));
          display.position.set(-this.span + .6 + i * 1.1, .7, this.span - .5 - j * .85); display.rotation.y = .9; display.userData.fleetId = fleet.id; this.ships.add(display);
        });
      }); this.fleetKey = fleetKey;
    }
    if (changedSystem) this.resetCamera();
    this.host.dataset.systemKey = systemKey(system);
  }
  select(index: number | undefined) { this.dirty = true; this.selectedIndex = index; this.planets.forEach(p => p.label.setAttribute('aria-pressed', String(p.index === index))); }
  setPaused(paused: boolean) {
    this.dirty = true;
    if (paused && !this.paused) this.frozenTime = this.simulationTime();
    if (!paused && this.paused) { this.epoch = this.frozenTime; this.received = performance.now(); }
    this.paused = paused;
  }
  private simulationTime() { return this.paused ? this.frozenTime : this.epoch + (performance.now() - this.received) / 1000; }
  resetCamera() { this.camera.position.set(5, 8, 7).normalize().multiplyScalar(20); this.camera.zoom = 1.2; this.camera.up.set(0, 1, 0); this.controls.target.set(0, 0, 0); this.controls.update(); this.resize(); }
  zoom(factor: number) { this.dirty = true; this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * factor, .65, 5); this.camera.updateProjectionMatrix(); }
  private resize() {
    this.dirty = true;
    this.planets.forEach(p => { const hidden = p.label.hidden; p.label.hidden = false; p.labelWidth = p.label.offsetWidth || 170; p.labelHeight = p.label.offsetHeight || 44; p.label.hidden = hidden; });
    const box = this.host.getBoundingClientRect(); this.width = Math.max(1, box.width); this.height = Math.max(1, box.height);
    const span = Math.max(this.span, this.span * this.height / this.width);
    Object.assign(this.camera, { left: -span * this.width / this.height, right: span * this.width / this.height, top: span, bottom: -span }); this.camera.updateProjectionMatrix();
    this.pipeline.resize(this.width, this.height, this.settings); this.renderer.setSize(this.pipeline.width, this.pipeline.height, false);
  }
  private frame = () => {
    if (this.disposed) return;
    try {
      const cameraChanged = this.controls.update();
      if(this.paused && !cameraChanged && !this.dirty){this.frameId=requestAnimationFrame(this.frame);return;}
      this.dirty = false;
      const time = this.simulationTime();
      this.planets.forEach(p => {
        const orbit = orbitalPosition(this.system!, p.index, time, p.slot); p.model.root.position.set(orbit.x, orbit.y, orbit.z);
        p.model.root.rotation.y = time * .015; p.model.cloudLayer.rotation.y = time * .019;
        p.model.atmosphere.material.uniforms.uLight.value.copy(p.model.root.position).negate().normalize();
      });
      const selected=this.planets.find(p=>p.index===this.selectedIndex);
      this.selectedOutline.visible=!!selected;
      if(selected){this.selectedOutline.position.copy(selected.model.root.position);this.selectedOutline.quaternion.copy(this.camera.quaternion);this.selectedOutline.scale.setScalar(1.28*selected.model.root.scale.x*1.16);}
      this.host.dataset.selectedPlanet=this.selectedIndex===undefined?'':String(this.selectedIndex);
      this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
      const scale=this.height/(this.camera.top-this.camera.bottom)*this.camera.zoom;
      const obstacles=[{position:this.star.position,radius:.85},...this.planets.map(p=>({position:p.model.root.position,radius:1.36*p.model.root.scale.x}))].map(body=>{const point=body.position.clone().project(this.camera);return{x:(point.x+1)/2*this.width,y:(1-point.y)/2*this.height,r:body.radius*scale+4};});
      const placed: { left: number; right: number; top: number; bottom: number }[] = [];
      [...this.planets].sort((a,b) => Number(b.index === this.selectedIndex) - Number(a.index === this.selectedIndex)).forEach(p => {
        this.projection.copy(p.model.root.position).project(this.camera);
        const x = (this.projection.x + 1) / 2 * this.width, y = (1 - this.projection.y) / 2 * this.height;
        p.label.dataset.screenX=String(x);p.label.dataset.screenY=String(y);
        p.label.hidden = true;
        if (this.projection.z < -1 || this.projection.z > 1 || x < 0 || x > this.width || y < 0 || y > this.height || p.labelWidth + 8 > this.width) return;
        const left = Math.max(4, Math.min(this.width - p.labelWidth - 4, x - p.labelWidth / 2)), radius=1.36*p.model.root.scale.x*scale;
        const candidates=[{left,top:y-radius-8-p.labelHeight},{left,top:y+radius+8},{left:x-radius-8-p.labelWidth,top:y-p.labelHeight/2},{left:x+radius+8,top:y-p.labelHeight/2}];
        for(const candidate of candidates){
          const left=Math.max(4,Math.min(this.width-p.labelWidth-4,candidate.left)),top=Math.max(4,Math.min(this.height-p.labelHeight-4,candidate.top));
          const box={left,right:left+p.labelWidth,top,bottom:top+p.labelHeight};
          if(box.left<4||box.right>this.width-4||box.top<4||box.bottom>this.height-4||obstacles.some(b=>box.left<b.x+b.r&&box.right>b.x-b.r&&box.top<b.y+b.r&&box.bottom>b.y-b.r)||placed.some(b=>box.left<b.right+4&&box.right>b.left-4&&box.top<b.bottom+4&&box.bottom>b.top-4))continue;
          p.label.style.left=`${box.left+p.labelWidth/2}px`;p.label.style.top=`${box.bottom}px`;p.label.hidden=false;placed.push(box);break;
        }
        p.label.dataset.selected = String(p.index === this.selectedIndex);
      });
      this.renderer.info.reset(); this.pipeline.render(this.renderer, this.scene, this.camera, this.settings);
      this.host.dataset.drawCalls = String(this.renderer.info.render.calls); this.host.dataset.triangles = String(this.renderer.info.render.triangles);
      this.frameId = requestAnimationFrame(this.frame);
    } catch (error) { this.dispose(); this.fail(error); }
  };
  dispose() {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frameId); this.observer.disconnect();
    this.controls.dispose(); const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.planets.forEach(p => disposeLabObject(p.model.root)); this.planets = []; this.shipCache.forEach(s => s.dispose()); this.shipCache.clear();
    this.selectedOutline.geometry.dispose();this.selectedOutline.material.dispose();
    this.star.geometry.dispose(); this.star.material.dispose(); disposeLabObject(this.sky); this.orbitGeometry.dispose(); this.orbitMaterial.dispose(); this.pipeline.dispose();
    this.scene.clear(); this.renderer.dispose(); canvas.remove(); this.labels.remove();
  }
}
