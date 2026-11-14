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
  const palette=family==='frozen'?['#738f91','#91a9a4','#b2c1b0','#d0d3bb']:family==='desert'?['#6c6049','#887454','#a38a60','#b19a6f']:family==='oceanic'?['#435f59','#526f62','#6a826b','#82917b']:family==='terran'?['#906c7a','#9b7580','#a68087','#b08a8e']:['#555e58','#68716a','#7c8275','#95968a'];
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível');
  for(let z=0;z<128;z++)for(let x=0;x<128;x++){
    const patch=terrainSample(planetId,x/23,z/23)*.8+terrainSample(`${planetId}:detail`,x/7,z/7)*.2;
    ctx.fillStyle=palette[Math.min(3,Math.floor(patch*4))];ctx.fillRect(x,z,1,1);
  }
  const groundTexture=new THREE.CanvasTexture(canvas);groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.magFilter=THREE.NearestFilter;groundTexture.minFilter=THREE.NearestFilter;
  // Extend the ground beyond the camera and darken its perimeter into the scene background.
  const groundGeometry=new THREE.PlaneGeometry(28,28,48,48);groundGeometry.rotateX(-Math.PI/2);
  const vertices=groundGeometry.attributes.position;const colors:number[]=[];
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),distance=Math.hypot(x,z);
    const edge=THREE.MathUtils.smoothstep(distance,4,12);
    vertices.setY(i,edge*terrainSample(`${planetId}:relief`,(x+14)/4,(z+14)/4)*.12);
    const tint=new THREE.Color(0xffffff).lerp(new THREE.Color(0x182d36),edge*.87);colors.push(tint.r,tint.g,tint.b);
  }
  groundGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeometry.computeVertexNormals();
  groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(2,2);
  const ground=new THREE.Mesh(groundGeometry,new THREE.MeshLambertMaterial({map:groundTexture,vertexColors:true,side:THREE.DoubleSide}));scene.add(ground,new THREE.HemisphereLight(0xa9dce8,0x493653,1.5));
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:family==='frozen'?0x8da1a0:0x655374,flatShading:true}),36);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<36;i++){
    const cluster=i%5;const angle=cluster*Math.PI*2/5+(terrainHash(`${planetId}:rock-angle:${i}`)/4294967295-.5)*.65;
    const radius=4.4+terrainHash(`${planetId}:rock-radius:${i}`)/4294967295*1.1;
    const size=.3+terrainHash(`${planetId}:rock-size:${i}`)/4294967295*.7;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const edge=THREE.MathUtils.smoothstep(Math.hypot(x,z),4,12);
    position.set(x,edge*terrainSample(`${planetId}:relief`,(x+14)/4,(z+14)/4)*.12+size*.18,z);scale.set(size,size*1.3,size*.8);matrix.compose(position,rotation,scale);rocks.setMatrixAt(i,matrix);
  }
  scene.add(rocks);
  // Peripheral outcrops and low alien ground cover frame the occupied sectors.
  const scenery=new THREE.Group();scene.add(scenery);
  const rockMaterial=new THREE.MeshLambertMaterial({color:0x766080,flatShading:true});
  const foliageMaterial=new THREE.MeshLambertMaterial({color:family==='frozen'?0x8dc9cd:0x378e92,flatShading:true});
  const crystalMaterial=new THREE.MeshLambertMaterial({color:0x85cecf,emissive:0x14353c,flatShading:true});
  const rockGeometry=new THREE.DodecahedronGeometry(1);
  const leafGeometry=new THREE.IcosahedronGeometry(1);
  const crystalGeometry=new THREE.ConeGeometry(.13,.65,5);
  for(let i=0;i<54;i++){
    const r=(key:string)=>terrainHash(`${planetId}:environment:${i}:${key}`)/4294967295;
    const angle=r('angle')*Math.PI*2;
    const radius=4.3+r('radius')*2.5;
    const x=Math.cos(angle)*radius-.7,z=Math.sin(angle)*radius-.7;
    const rear=x+z<-5;
    const stone=i%5===0||rear;
    const m=new THREE.Mesh(stone?rockGeometry:leafGeometry,stone?rockMaterial:foliageMaterial);
    const size=stone?.45+r('size')*.8:.14+r('size')*.28;
    m.scale.set(size,stone?size*(rear?1.35:.8):size*.65,size*.8);
    m.position.set(x,m.scale.y*.55,z);m.rotation.y=r('rotation')*Math.PI;m.castShadow=true;m.receiveShadow=true;scenery.add(m);
    if(i%7===0){const crystal=new THREE.Mesh(crystalGeometry,crystalMaterial);crystal.position.set(x+.35,.3,z);crystal.rotation.z=.2;scenery.add(crystal);}
  }
  const light=new THREE.DirectionalLight(0xffd8ad,3);light.position.set(-5,10,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-8;light.shadow.camera.right=8;light.shadow.camera.top=8;light.shadow.camera.bottom=-8;light.shadow.bias=-.002;scene.add(light);ground.receiveShadow=true;rocks.castShadow=true;
  const objects=new THREE.Group();scene.add(objects);
  const infrastructure=new THREE.Group();scene.add(infrastructure);
  let models:ReturnType<typeof createColonyBuilding>[]=[];
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,disposed=false;
  const render=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(tick);};
  function tick(time:number){frame=0;if(disposed)return;if(!motion.matches&&!document.hidden)models.forEach(m=>m.animate(time/1000));renderer.render(scene,camera);if(!motion.matches&&!document.hidden&&models.length)render();}
  const wake=()=>{cancelAnimationFrame(frame);frame=0;render();};
  motion.addEventListener('change',wake);document.addEventListener('visibilitychange',wake);
  const clear=()=>{models.forEach(m=>{objects.remove(m.group);m.dispose();});models=[];};
  const clearInfrastructure=()=>{for(const object of [...infrastructure.children]){infrastructure.remove(object);if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}}};
  const update=(list:Site[], selected:string|null)=>{clear();clearInfrastructure();
  // Connect only occupied sectors through an unobstructed central service junction.
  const road=(ax:number,az:number,bx:number,bz:number)=>{const length=Math.hypot(bx-ax,bz-az);if(length<.01)return;const segment=new THREE.Mesh(new THREE.PlaneGeometry(length,.48),new THREE.MeshBasicMaterial({color:0x39485d,side:THREE.DoubleSide}));segment.rotation.x=-Math.PI/2;segment.rotation.z=-Math.atan2(bz-az,bx-ax);segment.position.set((ax+bx)/2,.018,(az+bz)/2);infrastructure.add(segment);};
  if(list.length>1)for(const b of list){const [x,z]=b.position;const px=x-.75,pz=z-.75;road(px,pz,px,0);road(px,0,0,0);}
  for(const b of list){
    const pad=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.75),new THREE.MeshBasicMaterial({color:b.id==='ore_extractor'?0x655e53:b.id==='fuel_refinery'?0x455257:0x65706a,side:THREE.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(b.position[0]-.75,.025,b.position[1]-.75);infrastructure.add(pad);
    const detail=(x:number,z:number,w:number,h:number,color:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,.06,h),new THREE.MeshLambertMaterial({color}));mesh.position.set(b.position[0]+x,.05,b.position[1]+z);infrastructure.add(mesh);};
    if(b.id==='civil_district'){detail(-1.35,-.65,.08,.08,0x73c9ce);detail(-.15,-1.2,.08,.08,0xd69c55);detail(-1.1,-1.1,1.15,.08,0x78827b);}
    if(b.id==='ore_extractor'){for(let n=0;n<5;n++)detail(-1.55+n*.18,-1.15,.12,.14,n%2?0x878271:0x6c6c60);detail(-.7,-1.45,1.1,.12,0x817568);}
    if(b.id==='fuel_refinery'){detail(-1.2,-1.25,1.35,.1,0x9b8164);detail(-.55,-.85,.1,.8,0x77918b);detail(-1.45,-.8,.1,.1,0xd69c55);}
    const model=createColonyBuilding(b.id,b.id===selected);model.group.position.set(b.position[0]-.75,.03,b.position[1]-.75);models.push(model);objects.add(model.group);
  }render();};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const aspect=w/h;const half=3.8;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();};
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
  return {update,reset,dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',change);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);clear();clearInfrastructure();rockGeometry.dispose();leafGeometry.dispose();crystalGeometry.dispose();rockMaterial.dispose();foliageMaterial.dispose();crystalMaterial.dispose();ground.geometry.dispose();(ground.material as THREE.Material).dispose();groundTexture.dispose();rocks.geometry.dispose();(rocks.material as THREE.Material).dispose();motion.removeEventListener('change',wake);document.removeEventListener('visibilitychange',wake);light.shadow.map?.dispose();renderer.dispose();renderer.domElement.remove();}};
}

export function PlanetDiorama({planetId,planet,levels,onFallback}:{planetId:string;planet:Planet;levels:Record<string,number>;onFallback:()=>void}) {
  const host=useRef<HTMLDivElement>(null);const scene=useRef<Scene|null>(null);const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState(false);
  const list=useMemo(()=>dioramaBuildings(planetId,levels),[planetId,levels]);
  useEffect(()=>{setSelected(null);setError(false);if(!host.current)return;try{scene.current=createScene(host.current,planetId,planet,setSelected,()=>setError(true));}catch{setError(true);return;}return()=>{scene.current?.dispose();scene.current=null;};},[planetId]);
  useEffect(()=>{scene.current?.update(list,selected);if(selected&&!list.some(item=>item.id===selected))setSelected(null);},[list,selected]);
  return <section className="planet-diorama" aria-label="Superfície planetária"><div ref={host} className="planet-diorama-canvas"/>{error?<div role="alert">Não foi possível iniciar o WebGL. <button onClick={onFallback}>Voltar às instalações</button></div>:<div className="planet-diorama-controls"><button onClick={()=>scene.current?.reset()}>Restaurar visão</button><span>Arraste para mover · roda ou pinça para aproximar</span><div aria-label="Selecionar construção">{list.map(b=><button key={b.id} aria-pressed={selected===b.id} onClick={()=>setSelected(b.id)}>{b.name} · Nv {b.level}</button>)}</div>{!list.length&&<span>Nenhuma das instalações representadas foi construída neste planeta.</span>}</div>}</section>;
}
