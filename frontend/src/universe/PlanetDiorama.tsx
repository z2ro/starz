import {createColonyBuilding} from './ColonyBuilding';
import {useEffect, useMemo, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {derivePlanetFamily} from '../visual-state/planetVisualMapping';
import type {Planet} from '../types/game';
import civil from '../../assets/buildings/concepts/civil_district.webp';
import ferrite from '../../assets/buildings/concepts/ferrite_extractor.webp';
import refinery from '../../assets/buildings/concepts/fuel_refinery.webp';

const buildings = [
  {id:'civil_district', name:'Distrito civil', image:civil},
  {id:'ore_extractor', name:'Extrator de ferrita', image:ferrite},
  {id:'fuel_refinery', name:'Refinaria de combustível', image:refinery},
] as const;
const sites:Record<string,readonly [number,number]> = {civil_district:[-1.9,-1.9],ore_extractor:[-2.1,2],fuel_refinery:[2,-2.1]};

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

function createScene(host:HTMLDivElement, planetId:string, planet:Planet, onSelect:(id:string)=>void, onError:()=>void):Scene {
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});
  renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;
  renderer.setClearColor(0x101c28); renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
  camera.position.set(7.25,10.5,8.25); camera.lookAt(-.75,.5,-.75);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.target.set(-.75,.5,-.75);controls.enableRotate=false; controls.enableDamping=false; controls.screenSpacePanning=false; controls.minZoom=.7; controls.maxZoom=2.3;
  controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  const family=derivePlanetFamily(planet.temperature,planet.water);
  const cold=family==='frozen',dry=family==='desert';
  const palette=cold?['#7c9fab','#89a9b3','#9ab5ba','#adc5c5']:dry?['#ac8062','#b88e6a','#c69c76','#d1aa82']:['#b8a98b','#c0b294','#cabda1','#d4c9ae'];
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível');
  for(let z=0;z<256;z++)for(let x=0;x<256;x++){
    const broad=terrainSample(planetId,x/70,z/70);
    const grain=(terrainHash(`${planetId}:grain:${x}:${z}`)%11)/50;
    ctx.fillStyle=palette[Math.min(3,Math.floor((broad*.65+grain)*4))];ctx.fillRect(x,z,1,1);
  }
  const groundTexture=new THREE.CanvasTexture(canvas);groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.magFilter=THREE.NearestFilter;groundTexture.minFilter=THREE.NearestFilter;
  const groundGeometry=new THREE.PlaneGeometry(28,28,64,64);groundGeometry.rotateX(-Math.PI/2);
  const vertices=groundGeometry.attributes.position;const colors:number[]=[];
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),distance=Math.hypot(x,z);
    const edge=THREE.MathUtils.smoothstep(distance,4,12);
    vertices.setY(i,edge*terrainSample(`${planetId}:relief`,(x+14)/4,(z+14)/4)*.22);
    const tint=new THREE.Color(0xffffff).lerp(new THREE.Color(0x263e4d),edge*.85);colors.push(tint.r,tint.g,tint.b);
  }
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeometry.computeVertexNormals();
  const ground=new THREE.Mesh(groundGeometry,new THREE.MeshLambertMaterial({map:groundTexture,vertexColors:true}));scene.add(ground,new THREE.HemisphereLight(0xbadce6,0x514b59,1.3));
  // Two low geological banks frame the settlement; the foreground stays open.
  const scenery=new THREE.Group();scene.add(scenery);
  const landscapeMaterials=[0x697987,0x879193,0xb6b8a4,0x297a67,0x4d9c79,0x8fb78b,0x504b54].map(color=>new THREE.MeshLambertMaterial({color,flatShading:true}));
  const landscapeGeometries:THREE.BufferGeometry[]=[new THREE.DodecahedronGeometry(1),new THREE.CylinderGeometry(1,1.15,1,6),new THREE.CylinderGeometry(.045,.075,1,5),new THREE.IcosahedronGeometry(1)];
  const prop=(geo:number,mat:number,x:number,y:number,z:number,sx:number,sy:number,sz:number)=>{
    const m=new THREE.Mesh(landscapeGeometries[geo],landscapeMaterials[mat]);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;scenery.add(m);return m;
  };
  for(let i=0;i<12;i++){
    const r=terrainHash(`${planetId}:ridge:${i}`)/4294967295;
    const x=i<6?-5.1+i*.75:3.4+(i-6)*.32;
    const z=i<6?-3.7-r*.6:-4.5+(i-6)*.7;
    const height=.35+r*.65;
    prop(1,0,x,height/2,z,.65,height,.6).rotation.y=.25;
    prop(1,1,x,height+.08,z,.6,.16,.55).rotation.y=.25;
    prop(0,2,x+.4,.12,z+.5,.32,.18,.28);
  }
  // Small groves have distinct trunks and canopies instead of a ring of random boulders.
  for(let i=0;i<19;i++){
    const r=(key:string)=>terrainHash(`${planetId}:grove:${i}:${key}`)/4294967295;
    const bank=i%3;
    const x=bank===0?-4.9-r('x')*.6:bank===1?3.9+r('x')*1.2:-3.2+r('x')*1.8;
    const z=bank===0?-1+r('z')*4:bank===1?-2+r('z')*4.5:-5.2-r('z');
    const height=(cold||dry?.35:.65)+r('height')*.5;
    prop(2,6,x,height/2,z,1,height,1);
    for(let tier=0;tier<3;tier++){
      const width=(.48-tier*.1)*(dry?.65:1);
      prop(3,3+tier,x+(tier%2)*.14,height+tier*.12,z,width,.23,width*.8).rotation.y=r('rotation')*Math.PI;
    }
    prop(0,4,x+.2,.07,z+.25,.24,.12,.2);
  }
  // Fine mineral fragments give the ground scale without obscuring the facilities.
  for(let i=0;i<40;i++){
    const x=(terrainHash(`${planetId}:grit-x:${i}`)/4294967295-.5)*13;
    const z=(terrainHash(`${planetId}:grit-z:${i}`)/4294967295-.5)*12;
    if(Math.abs(x)<4&&Math.abs(z)<4)continue;
    prop(0,i%3,x,.04,z,.09,.07,.12);
  }
  // A decorative shallow basin is restricted to the already-known wet planet families.
  // It is scenery, never a new resource deposit or a gameplay object.
  const ripples:THREE.Mesh[]=[];
  if(family==='terran'||family==='oceanic'){
    const outline=new THREE.Shape();
    for(let i=0;i<24;i++){
      const angle=i/24*Math.PI*2,r=1+(terrainHash(`${planetId}:shore:${i}`)%100)/600;
      const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if(i===0)outline.moveTo(x,z);else outline.lineTo(x,z);
    }
    outline.closePath();const basinGeometry=new THREE.ShapeGeometry(outline);landscapeGeometries.push(basinGeometry);
    for(const [scale,color,y] of [[1.12,0x8e9b91,.012],[1.05,0xe0d5ac,.018],[1,0x3d9294,.025],[.84,0x347e8b,.03]]){
      const material=new THREE.MeshLambertMaterial({color});landscapeMaterials.push(material);
      const pool=new THREE.Mesh(basinGeometry,material);pool.rotation.x=-Math.PI/2;pool.scale.set(scale*1.65,scale*.85,1);pool.position.set(1.5,y,2.4);pool.receiveShadow=true;scenery.add(pool);
    }
    const rippleGeometry=new THREE.PlaneGeometry(.3,.018);landscapeGeometries.push(rippleGeometry);
    const rippleMaterial=new THREE.MeshLambertMaterial({color:0x9fd9ce,transparent:true,opacity:.55});landscapeMaterials.push(rippleMaterial);
    for(let i=0;i<9;i++){
      const m=new THREE.Mesh(rippleGeometry,rippleMaterial);m.rotation.x=-Math.PI/2;m.position.set(.5+(i%3)*.65,.04,2+(Math.floor(i/3))*.28);scenery.add(m);ripples.push(m);
    }
    for(let i=0;i<9;i++)prop(0,i%3,2.9-i*.27,.07,3.22+(i%2)*.08,.2,.12,.14);
  }
  const light=new THREE.DirectionalLight(0xffecce,3);light.position.set(-5,10,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-8;light.shadow.camera.right=8;light.shadow.camera.top=8;light.shadow.camera.bottom=-8;light.shadow.bias=-.002;scene.add(light);ground.receiveShadow=true;
  const objects=new THREE.Group();scene.add(objects);
  const infrastructure=new THREE.Group();scene.add(infrastructure);
  let models:ReturnType<typeof createColonyBuilding>[]=[];
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,disposed=false;
  const render=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(tick);};
  function tick(time:number){frame=0;if(disposed)return;if(!motion.matches&&!document.hidden){models.forEach(m=>m.animate(time/1000));ripples.forEach((r,i)=>{r.scale.x=.7+Math.sin(time*.0007+i)*.3;});}renderer.render(scene,camera);if(!motion.matches&&!document.hidden&&models.length)render();}
  const wake=()=>{cancelAnimationFrame(frame);frame=0;render();};
  motion.addEventListener('change',wake);document.addEventListener('visibilitychange',wake);
  const clear=()=>{models.forEach(m=>{objects.remove(m.group);m.dispose();});models=[];};
  const clearInfrastructure=()=>{for(const object of [...infrastructure.children]){infrastructure.remove(object);if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}}};
  const update=(list:Site[], selected:string|null)=>{clear();clearInfrastructure();
  // Connect only occupied sectors through an unobstructed central service junction.
  const road=(ax:number,az:number,bx:number,bz:number)=>{
    const length=Math.hypot(bx-ax,bz-az);if(length<.01)return;
    const plane=(l:number,w:number,color:number,y:number,x:number,z:number)=>{
      const m=new THREE.Mesh(new THREE.PlaneGeometry(l,w),new THREE.MeshLambertMaterial({color}));m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(bz-az,bx-ax);m.position.set(x,y,z);m.receiveShadow=true;infrastructure.add(m);
    };
    plane(length,.68,0xc3c1a5,.015,(ax+bx)/2,(az+bz)/2);
    plane(length,.5,0x596c73,.022,(ax+bx)/2,(az+bz)/2);
    for(let d=.3;d<length-.1;d+=.5)plane(.18,.035,0xd6cda5,.026,ax+(bx-ax)*d/length,az+(bz-az)*d/length);
  };
  if(list.length>1)for(const b of list){const [x,z]=b.position;const px=x-.75,pz=z-.75;road(px,pz,px,0);road(px,0,0,0);}
  for(const b of list){
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.75),new THREE.MeshBasicMaterial({color:b.id==='ore_extractor'?0x655e53:b.id==='fuel_refinery'?0x455257:0x65706a,side:THREE.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(b.position[0]-.75,.025,b.position[1]-.75);infrastructure.add(pad);
    const detail=(x:number,z:number,w:number,h:number,color:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,.06,h),new THREE.MeshLambertMaterial({color}));mesh.position.set(b.position[0]+x,.05,b.position[1]+z);infrastructure.add(mesh);};
    if(b.id==='civil_district'){detail(-1.35,-.65,.08,.08,0x73c9ce);detail(-.15,-1.2,.08,.08,0xd69c55);detail(-1.1,-1.1,1.15,.08,0x78827b);}
    if(b.id==='ore_extractor'){for(let n=0;n<5;n++)detail(-1.55+n*.18,-1.15,.12,.14,n%2?0x878271:0x6c6c60);detail(-.7,-1.45,1.1,.12,0x817568);}
    if(b.id==='fuel_refinery'){detail(-1.2,-1.25,1.35,.1,0x9b8164);detail(-.55,-.85,.1,.8,0x77918b);detail(-1.45,-.8,.1,.1,0xd69c55);}
    const model=createColonyBuilding(b.id,b.id===selected);model.group.position.set(b.position[0]-.75,.03,b.position[1]-.75);models.push(model);objects.add(model.group);
  }render();};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const aspect=w/h;const half=3.8;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(Math.ceil(w/(w>700?2:1)),Math.ceil(h/(w>700?2:1)),false);render();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const change=()=>{const x=THREE.MathUtils.clamp(controls.target.x,-2,2),z=THREE.MathUtils.clamp(controls.target.z,-2,2);camera.position.x+=x-controls.target.x;camera.position.z+=z-controls.target.z;controls.target.x=x;controls.target.z=z;render();};
  controls.addEventListener('change',change);controls.update();
  let down:{x:number;y:number}|null=null;
  const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const pointerUp=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(objects.children,true).find(item=>item.object.userData.id);if(hit)onSelect(hit.object.userData.id as string);};
  const contextLost=(event:Event)=>{event.preventDefault();onError();};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const reset=()=>{controls.target.set(-.75,.5,-.75);camera.position.set(7.25,10.5,8.25);camera.zoom=1;camera.updateProjectionMatrix();controls.update();render();};
  return {update,reset,dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',change);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);clear();clearInfrastructure();landscapeGeometries.forEach(g=>g.dispose());landscapeMaterials.forEach(m=>m.dispose());ground.geometry.dispose();(ground.material as THREE.Material).dispose();groundTexture.dispose();motion.removeEventListener('change',wake);document.removeEventListener('visibilitychange',wake);light.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();}};
}

export function PlanetDiorama({planetId,planet,levels,onFallback}:{planetId:string;planet:Planet;levels:Record<string,number>;onFallback:()=>void}) {
  const host=useRef<HTMLDivElement>(null);const scene=useRef<Scene|null>(null);const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState(false);
  const list=useMemo(()=>dioramaBuildings(planetId,levels),[planetId,levels]);
  useEffect(()=>{setSelected(null);setError(false);if(!host.current)return;try{scene.current=createScene(host.current,planetId,planet,setSelected,()=>setError(true));}catch{setError(true);return;}return()=>{scene.current?.dispose();scene.current=null;};},[planetId]);
  useEffect(()=>{scene.current?.update(list,selected);if(selected&&!list.some(item=>item.id===selected))setSelected(null);},[list,selected]);
  return <section className="planet-diorama" aria-label="Superfície planetária"><div ref={host} className="planet-diorama-canvas"/>{error?<div role="alert">Não foi possível iniciar o WebGL. <button onClick={onFallback}>Voltar às instalações</button></div>:<div className="planet-diorama-controls"><button onClick={()=>scene.current?.reset()}>Restaurar visão</button><span>Arraste para mover · roda ou pinça para aproximar</span><div aria-label="Selecionar construção">{list.map(b=><button key={b.id} aria-pressed={selected===b.id} onClick={()=>setSelected(b.id)}>{b.name} · Nv {b.level}</button>)}</div>{!list.length&&<span>Nenhuma das instalações representadas foi construída neste planeta.</span>}</div>}</section>;
}
