import {OrbitalCameraDirector,orbitalLabelRect} from './OrbitalCameraDirector';
import {decorativeStars,orbitalFrame} from './galaxyVisuals';
import {createOrbitalStar,ORBITAL_PALETTE} from './OrbitalStar';
import {planetIdentity} from './planetIdentity';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createLabPlanet, disposeLabObject, PLANET_OUTER_RADIUS } from '../planetlab/PlanetModel';
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
  private director:OrbitalCameraDirector;
  private cameraManual=false;
  private motionMedia=window.matchMedia('(prefers-reduced-motion: reduce)');
  private pipeline = new ShipPixelPipeline(ORBITAL_PALETTE);
  private settings = { ...DEFAULT_SHIP_SETTINGS, pixelSize: 2 };
  private observer: ResizeObserver;
  private selectedOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:80},(_,i)=>new THREE.Vector3(Math.cos(i/80*Math.PI*2),Math.sin(i/80*Math.PI*2),0))),new THREE.LineBasicMaterial({color:'#83e5e5',depthTest:true,depthWrite:false}));
  private stellar=createOrbitalStar('starz:stellar:initial','G');
  private star=this.stellar.mesh;
  private stellarKey='';
  private light=new THREE.PointLight('#ffe2b6',3.1,0,0);
  private sky=new THREE.Group();
  private orbitGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * Math.PI * 2), 0, Math.sin(i / 160 * Math.PI * 2))));
  private orbitMaterial = new THREE.LineBasicMaterial({ color: '#33546b', transparent: true, opacity: .34 });
  private selectedOrbitMaterial=new THREE.LineBasicMaterial({color:'#6cabb4',transparent:true,opacity:.68});
  private leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');
  private orbits = new THREE.Group();
  private ships = new THREE.Group();
  private shipCache = new Map<ShipDesignId, ReturnType<typeof FLEET_DESIGNS[number]['create']>>();
  private planets: { model: PlanetModel; index: number; slot: number; label: HTMLButtonElement; leader: SVGPolylineElement; labelWidth: number; labelHeight: number }[] = [];
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
  constructor(private host: HTMLElement, private selectPlanet: (index: number) => void, private selectFleet: (id: string) => void, private fail: (error: unknown) => void,private visualStarScale=1) {
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor('#030711'); this.renderer.info.autoReset = false;
    const canvas = this.renderer.domElement; canvas.className = 'orbital-canvas'; canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Vista orbital interativa: arraste para girar e use roda ou pinça para zoom');
    this.camera.position.set(0,12,16); // Keep controls valid while a mobile workspace is hidden.
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true; this.controls.enablePan = false; this.controls.zoomToCursor = true;
    this.director=new OrbitalCameraDirector(this.camera,this.controls);this.controls.addEventListener('start',this.manualCamera);
    this.controls.minZoom = .65; this.controls.maxZoom = 5; this.controls.maxPolarAngle = Math.PI * .82;
    this.labels.className = 'orbital-labels';this.leaders.classList.add('orbital-leaders');this.leaders.setAttribute('aria-hidden','true');this.labels.append(this.leaders);this.host.append(canvas,this.labels);
    this.camera.add(this.sky);this.sky.position.z=-100;this.scene.add(this.camera);
    this.selectedOutline.visible=false;
    this.scene.add(this.selectedOutline,this.star, this.orbits, this.ships, this.light, new THREE.HemisphereLight('#9ab9cc', '#030711', .15));
    canvas.addEventListener('pointerdown', this.pointerDown); canvas.addEventListener('pointerup', this.pointerUp); canvas.addEventListener('webglcontextlost', this.contextLost);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host); this.resetCamera(); this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }
  private manualCamera=()=>{this.cameraManual=true;this.director.cancel();};
  private pointerDown = (event: PointerEvent) => { this.down = { x: event.clientX, y: event.clientY }; };
  private pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 6) return;
    const box = this.host.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2((event.clientX - box.left) / box.width * 2 - 1, -(event.clientY - box.top) / box.height * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects([...(this.star.visible?[this.star]:[]), ...this.planets.map(p => p.model.root), this.ships], true)[0];
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
    this.star.visible=system.star?.present!==false;this.light.intensity=this.star.visible?3.1:0;
    const stellarKey=`${systemKey(system)}:${system.star?.stellar_class??'G'}`;
    const changedStar=stellarKey!==this.stellarKey;
    if(changedStar){
      this.scene.remove(this.star);this.stellar.dispose();this.stellar=createOrbitalStar(`starz:stellar:v1:${systemKey(system)}`,system.star?.stellar_class??'G',this.visualStarScale);this.star=this.stellar.mesh;this.scene.add(this.star);
      this.light.color.copy(this.star.material.uniforms.color.value);this.host.dataset.starClass=system.star?.stellar_class??'UNKNOWN';
      disposeLabObject(this.sky);this.sky.clear();
      const stars=decorativeStars(`starz:orbital-sky:v2:${systemKey(system)}`,190);
      for(const brightness of [.3,.52,.8]){
        const points=stars.filter(p=>p.brightness===brightness),geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x*2-1,p.y*2-1,0)));
        const material=new THREE.PointsMaterial({color:brightness===.8?'#788582':'#304b65',size:brightness===.8?2:1,sizeAttenuation:false,transparent:true,opacity:brightness,depthWrite:false,toneMapped:false});
        const layer=new THREE.Points(geometry,material);layer.frustumCulled=false;this.sky.add(layer);
      }
      this.star.visible=system.star?.present!==false;
      this.stellarKey=stellarKey;
    }
    if (Number.isFinite(state.observed_at) && (this.lastObserved === undefined || state.observed_at! > this.lastObserved)) { this.lastObserved = state.observed_at; this.epoch = state.observed_at!; this.received = performance.now(); }
    if (key !== this.geographyKey) {
      this.planets.forEach(p => { this.scene.remove(p.model.root); disposeLabObject(p.model.root); p.label.remove();p.leader.remove(); }); this.planets = []; this.orbits.clear();
      models.forEach(({ planet, settings, atmosphere }, slot) => {
        const model = createLabPlanet(settings); model.root.scale.setScalar(.46 + (planet.planet_index % 3) * .035);
        model.root.userData.planetIndex = planet.planet_index; model.atmosphere.visible = atmosphere.visible;
        const label = document.createElement('button'); label.type = 'button'; label.textContent = planet.name; label.dataset.planetIndex = String(planet.planet_index);
        label.setAttribute('aria-label', `Inspecionar planeta ${planet.name}`); label.onclick = () => this.selectPlanet(planet.planet_index); this.labels.append(label);
        const leader=document.createElementNS('http://www.w3.org/2000/svg','polyline');this.leaders.append(leader);
        this.planets.push({ model, index: planet.planet_index, slot, label, leader, labelWidth: label.offsetWidth || 170, labelHeight: label.offsetHeight || 44 }); this.scene.add(model.root);
        const orbit = new THREE.LineLoop(this.orbitGeometry, this.orbitMaterial); const radius = orbitalPosition(system, planet.planet_index, 0, slot,this.stellar.radius).radius; orbit.scale.set(radius, 1, radius);orbit.userData.planetIndex=planet.planet_index; this.orbits.add(orbit);
      });
      this.host.dataset.generationCount = String(++this.generationCount);
      this.geographyKey=key;
    }
    this.orbits.children.forEach((orbit,i)=>{const planet=this.planets[i],radius=orbitalPosition(system,planet.index,0,planet.slot,this.stellar.radius).radius;orbit.scale.set(radius,1,radius);});
    this.span=this.planets.length?orbitalPosition(system,this.planets[this.planets.length-1].index,0,this.planets.length-1,this.stellar.radius).radius:this.stellar.radius;
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
    const fleetKey = systemKey(system)+':'+this.span+JSON.stringify(fleets.map(f => [f.id, f.ship_ids, f.ship_ids.map(id => state.ships.find(s => s.id === id)?.hull_id)]));
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
    if(changedSystem||(changedStar&&!this.cameraManual))this.resetCamera();
    this.host.dataset.systemKey = systemKey(system);
  }
  select(index: number | undefined) {
    const changed=index!==this.selectedIndex;this.dirty=true;this.selectedIndex=index;
    this.planets.forEach(p=>p.label.setAttribute('aria-pressed',String(p.index===index)));
    this.orbits.children.forEach(orbit=>(orbit as THREE.LineLoop).material=orbit.userData.planetIndex===index?this.selectedOrbitMaterial:this.orbitMaterial);
    const planet=this.planets.find(p=>p.index===index);
    if(changed&&planet&&this.width>1&&this.height>1){this.cameraManual=true;const bodies=this.cameraBodies();this.director.focus(bodies[this.planets.indexOf(planet)],{bodies,starRadius:this.stellar.radius,width:this.width,height:this.height},this.motionMedia.matches,performance.now());}
  }
  setPaused(paused: boolean) {
    this.dirty = true;
    if (paused && !this.paused) this.frozenTime = this.simulationTime();
    if (!paused && this.paused) { this.epoch = this.frozenTime; this.received = performance.now(); }
    this.paused = paused;
  }
  private simulationTime() { return this.paused ? this.frozenTime : this.epoch + (performance.now() - this.received) / 1000; }
  private cameraBodies(){return this.planets.map(p=>({position:p.model.root.position,radius:PLANET_OUTER_RADIUS*p.model.root.scale.x,labelWidth:p.labelWidth,labelHeight:p.labelHeight}));}
  private positionPlanets(){
    const time=this.simulationTime();
    this.planets.forEach(p=>{const orbit=orbitalPosition(this.system!,p.index,time,p.slot,this.stellar.radius);p.model.root.position.set(orbit.x,orbit.y,orbit.z);});
  }
  resetCamera(){this.cameraManual=false;this.positionPlanets();this.resize();}
  zoom(factor:number){this.manualCamera();this.dirty=true;this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,.65,5);this.camera.updateProjectionMatrix();}
  private resize() {
    this.dirty = true;
    this.planets.forEach(p => { const hidden = p.label.hidden; p.label.hidden = false; p.labelWidth = p.label.offsetWidth || 170; p.labelHeight = p.label.offsetHeight || 44; p.label.hidden = hidden; });
    const box = this.host.getBoundingClientRect();if(box.width<1||box.height<1)return; this.width=box.width;this.height=box.height;
    let frame;
    if(!this.cameraManual){
      this.positionPlanets();frame=this.director.reset(this.cameraBodies(),this.planets.length?this.span:0,this.stellar.radius,this.width,this.height);
    }else{
      this.camera.updateMatrixWorld(true);const m=this.camera.matrixWorld.elements;
      frame=orbitalFrame(this.planets.length?this.span:0,this.planets.length?Math.max(...this.planets.map(p=>PLANET_OUTER_RADIUS*p.model.root.scale.x)):0,this.width,this.height,{x:m[0],z:m[2]},{x:m[4],z:m[6]},this.stellar.radius);
      Object.assign(this.camera,{left:-frame.halfWidth,right:frame.halfWidth,top:frame.halfHeight,bottom:-frame.halfHeight});this.camera.updateProjectionMatrix();
    }
    this.host.dataset.orbitalFrame=JSON.stringify(frame);this.host.dataset.starRadius=String(this.stellar.radius);
    if(!this.cameraManual){
      this.camera.updateMatrixWorld(true);const scale=this.height/(2*this.camera.top);
      this.host.dataset.cameraLayout=JSON.stringify([{position:this.star.position,radius:this.stellar.radius},...this.planets.map(p=>({position:p.model.root.position,radius:PLANET_OUTER_RADIUS*p.model.root.scale.x}))].map(body=>{const point=body.position.clone().project(this.camera);return{x:(point.x+1)*this.width/2,y:(1-point.y)*this.height/2,r:body.radius*scale};}));
    }
    this.pipeline.resize(this.width, this.height, this.settings); this.renderer.setSize(this.pipeline.width, this.pipeline.height, false);
  }
  private frame = () => {
    if (this.disposed) return;
    try {
      const directing=this.director.update(performance.now());
      const cameraChanged=this.controls.update()||directing;
      if(this.paused && !cameraChanged && !this.dirty){this.frameId=requestAnimationFrame(this.frame);return;}
      this.dirty = false;
      const time = this.simulationTime();
      this.star.rotation.y=time*.006;
      this.sky.scale.set(this.camera.right/this.camera.zoom,this.camera.top/this.camera.zoom,1);
      this.planets.forEach(p => {
        const orbit = orbitalPosition(this.system!, p.index, time,p.slot,this.stellar.radius); p.model.root.position.set(orbit.x, orbit.y, orbit.z);
        p.model.root.rotation.y = time * .015; p.model.cloudLayer.rotation.y = time * .019;
        p.model.atmosphere.material.uniforms.uLight.value.copy(p.model.root.position).negate().normalize();
      });
      const selected=this.planets.find(p=>p.index===this.selectedIndex);
      this.selectedOutline.visible=!!selected;
      if(selected){this.selectedOutline.position.copy(selected.model.root.position);this.selectedOutline.quaternion.copy(this.camera.quaternion);this.selectedOutline.scale.setScalar(1.28*selected.model.root.scale.x*1.16);}
      this.host.dataset.selectedPlanet=this.selectedIndex===undefined?'':String(this.selectedIndex);
      this.host.dataset.cameraTarget=this.controls.target.toArray().join(',');this.host.dataset.cameraZoom=String(this.camera.zoom);this.host.dataset.cameraMoving=String(this.director.moving);
      this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld(true);
      const scale=this.height/(this.camera.top-this.camera.bottom)*this.camera.zoom;
      const obstacles=[{position:this.star.position,radius:this.stellar.radius},...this.planets.map(p=>({position:p.model.root.position,radius:1.36*p.model.root.scale.x}))].map(body=>{const point=body.position.clone().project(this.camera);return{x:(point.x+1)/2*this.width,y:(1-point.y)/2*this.height,r:body.radius*scale};});
      const placed: { left: number; right: number; top: number; bottom: number }[] = [];
      [...this.planets].sort((a,b) => Number(b.index === this.selectedIndex) - Number(a.index === this.selectedIndex)).forEach(p => {
        this.projection.copy(p.model.root.position).project(this.camera);
        const x = (this.projection.x + 1) / 2 * this.width, y = (1 - this.projection.y) / 2 * this.height;
        p.label.dataset.screenX=String(x);p.label.dataset.screenY=String(y);
        p.label.hidden = true;p.leader.style.display='none';
        if (this.projection.z < -1 || this.projection.z > 1 || x < 0 || x > this.width || y < 0 || y > this.height || p.labelWidth + 8 > this.width) return;
        const radius=PLANET_OUTER_RADIUS*p.model.root.scale.x*scale;
        const box=orbitalLabelRect({x,y,r:radius},p.labelWidth,p.labelHeight,this.width,this.height,obstacles,placed);
        if(box){
          p.label.style.left=`${box.left+p.labelWidth/2}px`;p.label.style.top=`${box.bottom}px`;p.label.hidden=false;placed.push(box);
          const endX=Math.max(box.left,Math.min(box.right,x)),endY=Math.max(box.top,Math.min(box.bottom,y)),dx=endX-x,dy=endY-y,length=Math.hypot(dx,dy)||1;
          p.leader.setAttribute('points',`${x+dx/length*(radius+2)},${y+dy/length*(radius+2)} ${endX},${endY}`);p.leader.dataset.selected=String(p.index===this.selectedIndex);p.leader.style.display='';
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
    this.director.cancel();this.controls.removeEventListener('start',this.manualCamera);this.controls.dispose(); const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.pointerDown); canvas.removeEventListener('pointerup', this.pointerUp); canvas.removeEventListener('webglcontextlost', this.contextLost);
    this.planets.forEach(p => disposeLabObject(p.model.root)); this.planets = []; this.shipCache.forEach(s => s.dispose()); this.shipCache.clear();
    this.selectedOutline.geometry.dispose();this.selectedOutline.material.dispose();
    this.stellar.dispose(); disposeLabObject(this.sky); this.orbitGeometry.dispose(); this.orbitMaterial.dispose();this.selectedOrbitMaterial.dispose(); this.pipeline.dispose();
    this.scene.clear(); this.renderer.dispose(); canvas.remove(); this.labels.remove();
  }
}
