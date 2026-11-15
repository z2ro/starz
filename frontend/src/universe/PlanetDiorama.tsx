import {createColonyBuilding} from './ColonyBuilding';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {derivePlanetFamily} from '../visual-state/planetVisualMapping';
import {ShipPixelPipeline} from '../shipgeometrylab/ShipPixelPipeline';
import {DEFAULT_SHIP_SETTINGS} from '../shipgeometrylab/shipLabTypes';
import {planetSurfaceColor,samplePlanet,seedNumber,type PlanetBiome,type PlanetGenerationSettings} from '../planetlab/planetGenerator';
import {PLANET_PRESETS} from '../planetlab/planetLabTypes';
import type {Planet} from '../types/game';
import civil from '../../assets/buildings/concepts/civil_district.webp';
import ferrite from '../../assets/buildings/concepts/ferrite_extractor.webp';
import refinery from '../../assets/buildings/concepts/fuel_refinery.webp';

const buildings = [
  {id:'civil_district', name:'Distrito civil', image:civil},
  {id:'ore_extractor', name:'Extrator de ferrita', image:ferrite},
  {id:'fuel_refinery', name:'Refinaria de combustível', image:refinery},
  {id:'processor', name:'Processador de materiais'},
  {id:'volatile_well', name:'Poço de voláteis'},
  {id:'manufacturing', name:'Manufatura avançada'},
  {id:'solar_field', name:'Campo solar'},
  {id:'orbital_shipyard', name:'Estaleiro orbital'},
  {id:'research_lab', name:'Centro de Pesquisa Planetário'},
  {id:'civil_lab', name:'Laboratório de Engenharia Civil'},
  {id:'fundamental_lab', name:'Instituto de Ciência Fundamental'},
  {id:'military_lab', name:'Complexo de Pesquisa Militar'},
] as const;
// Fixed sectors: industry along the front row, civil core, energy and the orbital terminal in the
// middle row, science on the back row. A sector stays natural ground until its installation exists.
const sites:Record<string,readonly [number,number]> = {
  civil_district:[-1.9,-1.9],ore_extractor:[-2.1,2],fuel_refinery:[2,-2.1],
  processor:[2,2],volatile_well:[-5.9,2],manufacturing:[5.8,2],solar_field:[5.8,-2],orbital_shipyard:[-5.9,-2],
  civil_lab:[-5.9,-5.7],research_lab:[-2,-5.7],fundamental_lab:[2,-5.7],military_lab:[5.8,-5.7],
};
// Service roads: a main spine, a rear lane for the science row and the link between them.
const SPINE=0,REAR=-4.6,LINK=-.78;

function hash(value:string) { let h=2166136261; for(const c of value) h=Math.imul(h^c.charCodeAt(0),16777619); return h>>>0; }
function terrainHash(value:string) { let h=hash(value);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return (h^(h>>>16))>>>0; }
// Interpolated seeded values form broad, repeatable patches rather than isolated tiles.
export function terrainSample(seed:string, x:number, z:number) {
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const smooth=(t:number)=>t*t*(3-2*t);
  const value=(a:number,b:number)=>terrainHash(`${seed}:${a}:${b}`)/4294967295;
  const a=THREE.MathUtils.lerp(value(ix,iz),value(ix+1,iz),smooth(fx));
  const b=THREE.MathUtils.lerp(value(ix,iz+1),value(ix+1,iz+1),smooth(fx));
  return THREE.MathUtils.lerp(a,b,smooth(fz));
}
export function dioramaBuildings(planetId:string, levels:Record<string,number>) {
  return buildings.map(building=>{
    const site=sites[building.id];
    const jitter=(axis:string)=>(terrainHash(`${planetId}:${building.id}:${axis}`)/4294967295-.5)*.16;
    return {...building,level:levels[building.id] ?? 0,position:[site[0]+jitter('x'),site[1]+jitter('z')] as const};
  }).filter(building=>building.level>0);
}
type Site = ReturnType<typeof dioramaBuildings>[number];
type Scene = {update:(sites:Site[], selected:string|null)=>void; reset:()=>void; dispose:()=>void};

// The colony stands on a patch of the planet's own generated surface, sampled with the same
// generator and seed as the globe. CELL is the voxel size, REACH the half-width of the patch
// and SPAN how much of the globe one scene unit covers, in radians.
const CX=-.75,CZ=-.75,CELL=.25,REACH=20,SPAN=.017;
type Ground={top:number;colour:THREE.Color;biome:PlanetBiome|'water'};
// Scenery tones taken from the generator's biome colours and the approved pixel palette.
const TONES={
  canopy:['#214f43','#2b694a','#3e7150'],trunk:'#6a4c34',bush:['#3e7150','#5b854e','#6f8b4a'],shrub:['#617471','#55754b'],
  tuft:['#9b874f','#b69e62'],rock:['#5d5e5a','#788582','#333d3d'],mineral:['#6a5740','#6a4c34','#9b874f'],ice:['#c9e1e4','#acc8ca','#f3fbf8'],
} as const;

function createScene(host:HTMLDivElement, planetId:string, planet:Planet, generation:PlanetGenerationSettings|null, onSelect:(id:string)=>void, onError:()=>void):Scene {
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});
  renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;
  host.appendChild(renderer.domElement);
  // Reuses the approved low-resolution, outline, dither and palette pipeline of the planet and ship scenes.
  const pipeline=new ShipPixelPipeline();
  const settings={...DEFAULT_SHIP_SETTINGS};
  const family=generation?.family??derivePlanetFamily(planet.temperature,planet.water)??'terran';
  const world:PlanetGenerationSettings=generation??{seed:planetId,family,...PLANET_PRESETS[family].parameters};
  const scene=new THREE.Scene();scene.background=new THREE.Color('#020711');
  // Fixed 2:1 dimetric view: azimuth 45 degrees, elevation 30 degrees.
  const home=new THREE.Vector3(CX,.4,CZ),offset=new THREE.Vector3(14.7,12,14.7);
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,2,46);
  camera.position.copy(home).add(offset);camera.lookAt(home);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.copy(home);controls.enableRotate=false;controls.enableDamping=false;controls.screenSpacePanning=false;controls.minZoom=.6;controls.maxZoom=3;
  controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;

  let state=seedNumber(`${world.seed}:colony`);
  const rnd=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
  const pick=(list:readonly string[])=>list[Math.floor(rnd()*list.length)];
  const noise=(a:number,b:number)=>{const s=Math.sin(a*127.1+b*311.7+state%977)*43758.5453;return s-Math.floor(s);};
  // The landing site is a deterministic lowland of this planet; the first candidate is the fallback.
  let site={x:1,y:0,z:0};
  for(let n=0;n<64;n++){
    const latitude=(rnd()-.5)*1.4,longitude=rnd()*Math.PI*2;
    const candidate={x:Math.cos(latitude)*Math.cos(longitude),y:Math.sin(latitude),z:Math.cos(latitude)*Math.sin(longitude)};
    const sample=samplePlanet(candidate,world);
    if(n===0)site=candidate;
    if(sample.land&&sample.elevation<.45&&(family==='frozen'||!sample.ice)){site=candidate;break;}
  }
  const eastLength=Math.hypot(site.z,site.x)||1,east={x:site.z/eastLength,y:0,z:-site.x/eastLength};
  const north={x:site.y*east.z-site.z*east.y,y:site.z*east.x-site.x*east.z,z:site.x*east.y-site.y*east.x};
  const directionAt=(x:number,z:number)=>{
    const u=(x-CX)*SPAN,v=-(z-CZ)*SPAN,px=site.x+east.x*u+north.x*v,py=site.y+east.y*u+north.y*v,pz=site.z+east.z*u+north.z*v,length=Math.hypot(px,py,pz);
    return {x:px/length,y:py/length,z:pz/length};
  };
  const centre=samplePlanet(site,world);

  // ---- terrain: voxel columns coloured by the planet generator, flat under the colony, terraced toward the horizon ----
  const N=Math.round(REACH/CELL),SIZE=2*N+1;
  const grid:Ground[]=new Array(SIZE*SIZE);
  const groundAt=(x:number,z:number):Ground|undefined=>{const i=Math.round((x-CX)/CELL),j=Math.round((z-CZ)/CELL);return Math.abs(i)>N||Math.abs(j)>N?undefined:grid[(i+N)*SIZE+j+N];};
  for(let i=-N;i<=N;i++)for(let j=-N;j<=N;j++){
    const x=CX+i*CELL,z=CZ+j*CELL,distance=Math.hypot(i,j)*CELL;
    let sample=samplePlanet(directionAt(x,z),world);
    // The settlement footprint is always dry land, with an irregular edge.
    if(!sample.land&&distance<11+terrainSample(planetId,x/2+40,z/2+40)*3)sample=centre;
    const open=THREE.MathUtils.smoothstep(distance,10.5,15.5);
    // Relief stays low between the camera and the colony so it never hides a building.
    const cap=THREE.MathUtils.lerp(3.5,.5,THREE.MathUtils.smoothstep((i+j)*CELL/Math.SQRT2,-2,3));
    const top=sample.land?Math.min(cap,Math.round(Math.max(0,sample.elevation-centre.elevation)*7*open/CELL)*CELL):sample.ice?-.1:-.25;
    const [r,g,b]=planetSurfaceColor(sample),jitter=(noise(i,j)-.5)*14,fade=(1-.65*THREE.MathUtils.smoothstep(distance,13,REACH))/255;
    const channel=(value:number)=>Math.max(0,Math.min(1,(value+jitter)*fade));
    grid[(i+N)*SIZE+j+N]={top,colour:new THREE.Color().setRGB(channel(r),channel(g),channel(b),THREE.SRGBColorSpace),biome:sample.land?sample.biome:'water'};
  }
  const positions:number[]=[],colours:number[]=[];
  const quad=(a:number[],b:number[],c:number[],d:number[],colour:THREE.Color,shade:number)=>{
    for(const p of [a,b,c,a,c,d]){positions.push(p[0],p[1],p[2]);colours.push(colour.r*shade,colour.g*shade,colour.b*shade);}
  };
  const half=CELL/2;
  for(let i=-N;i<=N;i++)for(let j=-N;j<=N;j++){
    const cell=grid[(i+N)*SIZE+j+N],x=CX+i*CELL,z=CZ+j*CELL,x0=x-half,x1=x+half,z0=z-half,z1=z+half,y=cell.top;
    quad([x0,y,z1],[x1,y,z1],[x1,y,z0],[x0,y,z0],cell.colour,1);
    for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){
      if(Math.abs(i+di)>N||Math.abs(j+dj)>N)continue;
      const low=grid[(i+di+N)*SIZE+j+dj+N].top;if(low>=y)continue;
      // Exposed soil under the surface colour, darker rock below.
      for(let hi=y;hi>low+1e-3;hi-=CELL){
        const lo=Math.max(low,hi-CELL),shade=hi===y?.62:.42;
        if(di===1)quad([x1,lo,z1],[x1,lo,z0],[x1,hi,z0],[x1,hi,z1],cell.colour,shade);
        else if(di===-1)quad([x0,lo,z0],[x0,lo,z1],[x0,hi,z1],[x0,hi,z0],cell.colour,shade);
        else if(dj===1)quad([x0,lo,z1],[x1,lo,z1],[x1,hi,z1],[x0,hi,z1],cell.colour,shade);
        else quad([x1,lo,z0],[x0,lo,z0],[x0,hi,z0],[x1,hi,z0],cell.colour,shade);
      }
    }
  }
  const terrainGeometry=new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrainGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));terrainGeometry.computeVertexNormals();
  const terrainMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const terrain=new THREE.Mesh(terrainGeometry,terrainMaterial);terrain.receiveShadow=true;terrain.frustumCulled=false;scene.add(terrain);

  // ---- scenery kit: one unit box, icosahedron and cone; one material per tone ----
  const scenery=new THREE.Group();scene.add(scenery);
  const geometries:THREE.BufferGeometry[]=[new THREE.BoxGeometry(1,1,1),new THREE.IcosahedronGeometry(1,0),new THREE.ConeGeometry(1,1,5)];
  const materials=new Map<string,THREE.Material>();
  const matte=(hex:string)=>{let m=materials.get(hex);if(!m){m=new THREE.MeshLambertMaterial({color:hex,flatShading:true});materials.set(hex,m);}return m;};
  const shape=(geometry:number,hex:string,w:number,h:number,d:number,x:number,y:number,z:number)=>{
    const m=new THREE.Mesh(geometries[geometry],matte(hex));m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scenery.add(m);return m;
  };
  // Nothing natural stands on a sector, in front of it, on a road or on the junction.
  const blocked=(x:number,z:number)=>
    Object.values(sites).some(([sx,sz])=>x-sx+.75>-1.8&&x-sx+.75<3&&z-sz+.75>-1.6&&z-sz+.75<2.8)
    ||((Math.abs(z-SPINE)<.7||Math.abs(z-REAR)<.7)&&x>-8.4&&x<6.8)||(Math.abs(x-LINK)<.7&&z>REAR-.6&&z<.6)||Math.hypot(x,z)<1.4;
  const rock=(tones:readonly string[],x:number,y:number,z:number,s:number)=>{shape(1,pick(tones),s,s*.7,s,x,y+s*.3,z).rotation.set(rnd()*3,rnd()*3,0);};
  const bush=(tones:readonly string[],x:number,y:number,z:number)=>{const w=.2+rnd()*.2,h=.12+rnd()*.12;shape(0,pick(tones),w,h,w,x,y+h/2,z);};
  const tree=(x:number,y:number,z:number)=>{
    const s=.55+rnd()*.35;shape(0,TONES.trunk,.1*s,.3*s,.1*s,x,y+.15*s,z);
    for(let k=0;k<3;k++){const w=(.6-k*.17)*s;shape(0,TONES.canopy[k],w,.24*s,w,x,y+(.4+k*.22)*s,z);}
  };
  for(let n=0;n<640;n++){
    const angle=rnd()*Math.PI*2,radius=2.5+rnd()*11.5,x=CX+Math.cos(angle)*radius,z=CZ+Math.sin(angle)*radius,roll=rnd(),size=.14+rnd()*.26;
    const ground=groundAt(x,z);if(!ground||ground.biome==='water'||blocked(x,z))continue;
    const y=ground.top;
    if(ground.biome==='forest'){if(roll<.5)tree(x,y,z);else if(roll<.75)bush(TONES.bush,x,y,z);}
    else if(ground.biome==='grassland'){if(roll<.12)tree(x,y,z);else if(roll<.45)bush(TONES.bush,x,y,z);else if(roll<.62)rock(TONES.rock,x,y,z,size);}
    else if(ground.biome==='tundra'){if(roll<.35)bush(TONES.shrub,x,y,z);else if(roll<.5)rock(TONES.rock,x,y,z,size);}
    else if(ground.biome==='desert'){if(roll<.22)rock(TONES.mineral,x,y,z,size);else if(roll<.4)bush(TONES.tuft,x,y,z);}
    else if(ground.biome==='mineral'){if(roll<.4)rock(TONES.mineral,x,y,z,size*1.3);}
    else if(ground.biome==='rock'){if(roll<.45)rock(TONES.rock,x,y,z,size*1.4);}
    else if(roll<.3)shape(2,pick(TONES.ice),size*.6,size*2.4,size*.6,x,y+size*1.2,z);
  }
  const hemisphere=new THREE.HemisphereLight(PLANET_PRESETS[family].atmosphereColor,'#333d3d',1.9);
  const light=new THREE.DirectionalLight(0xfff0cf,3);light.position.set(-5,10,7);light.castShadow=true;light.shadow.mapSize.set(2048,2048);
  light.shadow.camera.left=-17;light.shadow.camera.right=17;light.shadow.camera.top=17;light.shadow.camera.bottom=-17;light.shadow.camera.near=.5;light.shadow.camera.far=40;light.shadow.bias=-.002;
  scene.add(hemisphere,light);

  const objects=new THREE.Group();scene.add(objects);
  const infrastructure=new THREE.Group();scene.add(infrastructure);
  let models:ReturnType<typeof createColonyBuilding>[]=[];
  let beacon:THREE.Mesh|null=null;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,disposed=false;
  const render=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(tick);};
  function tick(time:number){
    frame=0;if(disposed)return;
    const animated=!motion.matches&&!document.hidden&&models.length>0;
    if(animated){models.forEach(m=>m.animate(time/1000));if(beacon)beacon.visible=time/1000%1.6<1;}
    pipeline.render(renderer,scene,camera,settings);
    if(animated)render();
  }
  const wake=()=>{cancelAnimationFrame(frame);frame=0;render();};
  motion.addEventListener('change',wake);document.addEventListener('visibilitychange',wake);
  const clear=()=>{models.forEach(m=>{objects.remove(m.group);m.dispose();});models=[];};
  const clearInfrastructure=()=>{beacon=null;for(const object of [...infrastructure.children]){infrastructure.remove(object);if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}}};
  const update=(list:Site[], selected:string|null)=>{clear();clearInfrastructure();
  const slab=(w:number,h:number,d:number,color:number,x:number,y:number,z:number,lit=true)=>{
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),lit?new THREE.MeshLambertMaterial({color}):new THREE.MeshBasicMaterial({color}));m.position.set(x,y,z);m.receiveShadow=lit;infrastructure.add(m);return m;
  };
  // Connect only occupied sectors through an unobstructed central service junction.
  const road=(ax:number,az:number,bx:number,bz:number)=>{
    const length=Math.hypot(bx-ax,bz-az);if(length<.01)return;
    const plane=(l:number,w:number,color:number,y:number,x:number,z:number)=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(l,w),new THREE.MeshLambertMaterial({color}));m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(bz-az,bx-ax);m.position.set(x,y,z);m.receiveShadow=true;infrastructure.add(m);
    };
    plane(length+.7,.7,0x788582,.015,(ax+bx)/2,(az+bz)/2);
    plane(length+.5,.5,0x333d3d,.022,(ax+bx)/2,(az+bz)/2);
    for(let d=.3;d<length-.1;d+=.5)plane(.18,.04,0xc0a75b,.028,ax+(bx-ax)*d/length,az+(bz-az)*d/length);
  };
  if(list.length>1){
    let rear=false;
    for(const b of list){const px=b.position[0]-.75,pz=b.position[1]-.75,lane=pz<REAR?REAR:SPINE;rear=rear||lane===REAR;road(px,pz,px,lane);road(px,lane,LINK,lane);}
    if(rear)road(LINK,REAR,LINK,SPINE);
    road(LINK,SPINE,0,SPINE);
    // The junction is a small plaza with a signal mast.
    const plaza=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.06,8),new THREE.MeshLambertMaterial({color:0x788582,flatShading:true}));plaza.position.set(0,.03,0);plaza.receiveShadow=true;infrastructure.add(plaza);
    slab(.5,.04,.5,0x333d3d,0,.07,0);slab(.07,1.1,.07,0x102a40,0,.6,0).castShadow=true;
    beacon=slab(.13,.13,.13,0xffc465,0,1.2,0,false);
  }
  for(const b of list){
    const x=b.position[0]-.75,z=b.position[1]-.75;
    slab(3.1,.04,2.7,0x5d5e5a,x,.02,z);slab(2.9,.02,2.5,0x788582,x,.045,z);
    if(b.id===selected)for(const [w,d,ox,oz] of [[3.3,.07,0,1.42],[3.3,.07,0,-1.42],[.07,2.9,1.62,0],[.07,2.9,-1.62,0]])slab(w,.07,d,0x83e5e5,x+ox,.06,z+oz,false);
    const model=createColonyBuilding(b.id,b.id===selected);model.group.position.set(x,.05,z);models.push(model);objects.add(model.group);
  }render();};
  const resize=()=>{
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    const aspect=w/h,extent=Math.max(4,5.6/aspect);
    camera.left=-extent*aspect;camera.right=extent*aspect;camera.top=extent;camera.bottom=-extent;camera.updateProjectionMatrix();
    // Aim for roughly 240 low-resolution rows whatever the panel size.
    settings.pixelSize=Math.max(1,Math.min(4,Math.round(h/240)));renderer.setSize(w,h,false);pipeline.resize(w,h,settings);render();
  };
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const change=()=>{const x=THREE.MathUtils.clamp(controls.target.x,CX-6,CX+6),z=THREE.MathUtils.clamp(controls.target.z,CZ-6,CZ+6);camera.position.x+=x-controls.target.x;camera.position.z+=z-controls.target.z;controls.target.x=x;controls.target.z=z;render();};
  controls.addEventListener('change',change);controls.update();
  let down:{x:number;y:number}|null=null;
  const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const pointerUp=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(objects.children,true).find(item=>item.object.userData.id);if(hit)onSelect(hit.object.userData.id as string);};
  const contextLost=(event:Event)=>{event.preventDefault();onError();};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const reset=()=>{controls.target.copy(home);camera.position.copy(home).add(offset);camera.zoom=1;camera.updateProjectionMatrix();controls.update();render();};
  return {update,reset,dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',change);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);clear();clearInfrastructure();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());terrainGeometry.dispose();terrainMaterial.dispose();pipeline.dispose();motion.removeEventListener('change',wake);document.removeEventListener('visibilitychange',wake);light.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();}};
}

export function PlanetDiorama({planetId,planet,generation=null,levels,onFallback}:{planetId:string;planet:Planet;generation?:PlanetGenerationSettings|null;levels:Record<string,number>;onFallback:()=>void}) {
  const host=useRef<HTMLDivElement>(null);const scene=useRef<Scene|null>(null);const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState(false);
  const list=useMemo(()=>dioramaBuildings(planetId,levels),[planetId,levels]);
  useEffect(()=>{setSelected(null);setError(false);if(!host.current)return;try{scene.current=createScene(host.current,planetId,planet,generation,setSelected,()=>setError(true));}catch{setError(true);return;}return()=>{scene.current?.dispose();scene.current=null;};},[planetId,generation?.seed,generation?.family]);
  useEffect(()=>{scene.current?.update(list,selected);if(selected&&!list.some(item=>item.id===selected))setSelected(null);},[list,selected]);
  return <section className="planet-diorama" aria-label="Superfície planetária"><div ref={host} className="planet-diorama-canvas"/>{error?<div role="alert">Não foi possível iniciar o WebGL. <button onClick={onFallback}>Voltar às instalações</button></div>:<div className="planet-diorama-controls"><button onClick={()=>scene.current?.reset()}>Restaurar visão</button><span>Arraste para mover · roda ou pinça para aproximar</span>{list.length>4?<select aria-label="Selecionar construção" value={selected??''} onChange={e=>setSelected(e.target.value||null)}><option value="">Selecionar construção…</option>{list.map(b=><option key={b.id} value={b.id}>{b.name} · Nv {b.level}</option>)}</select>:<div aria-label="Selecionar construção">{list.map(b=><button key={b.id} aria-pressed={selected===b.id} onClick={()=>setSelected(b.id)}>{b.name} · Nv {b.level}</button>)}</div>}{!list.length&&<span>Nenhuma das instalações representadas foi construída neste planeta.</span>}</div>}</section>;
}
