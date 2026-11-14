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
const sites = [[-2, -1.4], [1.9, -1.4], [0, 2]] as const;

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
  const offsets = [...sites];
  // Shuffle every site before filtering, so constructing a building never moves another.
  for(let i=offsets.length-1;i>0;i--) { const j=hash(`${planetId}:${i}`)%(i+1); [offsets[i],offsets[j]]=[offsets[j],offsets[i]]; }
  return buildings.map((building,i)=>({...building, level:levels[building.id] ?? 0, position:offsets[i]})).filter(building=>building.level>0);
}
type Site = ReturnType<typeof dioramaBuildings>[number];
type Scene = {update:(sites:Site[], selected:string|null)=>void; reset:()=>void; dispose:()=>void};

function createScene(host:HTMLDivElement, planetId:string, planet:Planet, onSelect:(id:string)=>void, onError:()=>void):Scene {
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.setClearColor(0x101c28); renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
  camera.position.set(8,10,9); camera.lookAt(0,0,0);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableRotate=false; controls.enableDamping=false; controls.screenSpacePanning=false; controls.minZoom=.7; controls.maxZoom=2.3;
  controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  const family=derivePlanetFamily(planet.temperature,planet.water);
  const palette=family==='frozen'?['#738f91','#91a9a4','#b2c1b0','#d0d3bb']:family==='desert'?['#6c6049','#887454','#a38a60','#b19a6f']:family==='oceanic'?['#435f59','#526f62','#6a826b','#82917b']:family==='terran'?['#424d49','#56615b','#70776a','#8c8d7c']:['#555e58','#68716a','#7c8275','#95968a'];
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas indisponível');
  for(let z=0;z<128;z++)for(let x=0;x<128;x++){
    const patch=terrainSample(planetId,x/23,z/23)*.8+terrainSample(`${planetId}:detail`,x/7,z/7)*.2;
    ctx.fillStyle=palette[Math.min(3,Math.floor(patch*4))];ctx.fillRect(x,z,1,1);
  }
  const groundTexture=new THREE.CanvasTexture(canvas);groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.magFilter=THREE.NearestFilter;groundTexture.minFilter=THREE.NearestFilter;
  const groundGeometry=new THREE.PlaneGeometry(12,12,32,32);groundGeometry.rotateX(-Math.PI/2);
  const vertices=groundGeometry.attributes.position;
  for(let i=0;i<vertices.count;i++){
    const u=vertices.getX(i)/6,v=vertices.getZ(i)/6;
    const x=u*Math.sqrt(1-v*v/2)*6, z=v*Math.sqrt(1-u*u/2)*6;
    const radius=Math.hypot(x,z)/6, angle=Math.atan2(z,x);
    const edge=THREE.MathUtils.smoothstep(radius,.55,1);
    const boundary=1-edge*(.05+.08*terrainSample(`${planetId}:rim`,Math.cos(angle)*2+4,Math.sin(angle)*2+4));
    vertices.setXYZ(i,x*boundary,edge*(terrainSample(`${planetId}:relief`,(x+6)/2,(z+6)/2)*.65-.2),z*boundary);
  }
  groundGeometry.computeVertexNormals();
  const ground=new THREE.Mesh(groundGeometry,new THREE.MeshLambertMaterial({map:groundTexture,side:THREE.DoubleSide}));scene.add(ground,new THREE.HemisphereLight(0xbcd5d5,0x27353b,2));
  const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshLambertMaterial({color:family==='frozen'?0x8da1a0:0x5b5e52,flatShading:true}),36);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<36;i++){
    const cluster=i%5;const angle=cluster*Math.PI*2/5+(terrainHash(`${planetId}:rock-angle:${i}`)/4294967295-.5)*.65;
    const radius=4.8+terrainHash(`${planetId}:rock-radius:${i}`)/4294967295*1.1;
    const size=.13+terrainHash(`${planetId}:rock-size:${i}`)/4294967295*.28;
    const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
    const edge=THREE.MathUtils.smoothstep(Math.hypot(x,z)/6,.55,1);
    position.set(x,edge*(terrainSample(`${planetId}:relief`,(x+6)/2,(z+6)/2)*.65-.2)+size*.18,z);scale.set(size,size*.7,size*.8);matrix.compose(position,rotation,scale);rocks.setMatrixAt(i,matrix);
  }
  scene.add(rocks);
  const light=new THREE.DirectionalLight(0xffe3ad,1.5);light.position.set(-5,10,7);scene.add(light);
  const objects=new THREE.Group();scene.add(objects);
  const infrastructure=new THREE.Group();scene.add(infrastructure);
  const textures=new Map<string,THREE.Texture>();const loader=new THREE.TextureLoader();
  let frame=0, disposed=false;
  const render=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});};
  for(const b of buildings){const texture=loader.load(b.image,()=>render()); texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;textures.set(b.id,texture);}
  const clear=()=>{for(const object of [...objects.children]){objects.remove(object);if(object instanceof THREE.Sprite){object.material.dispose();if(object.userData.label) object.material.map?.dispose();}else if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}}};
  const clearInfrastructure=()=>{for(const object of [...infrastructure.children]){infrastructure.remove(object);if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}}};
  const update=(list:Site[], selected:string|null)=>{clear();clearInfrastructure();
  // Tracks are presentation only and connect constructed installations, never empty sites.
  for(let i=1;i<list.length;i++){
    const [ax,az]=list[i-1].position,[bx,bz]=list[i].position;
    const road=new THREE.Mesh(new THREE.PlaneGeometry(Math.hypot(bx-ax,bz-az),.35),new THREE.MeshBasicMaterial({color:0x777a68,side:THREE.DoubleSide}));
    road.rotation.x=-Math.PI/2;road.rotation.z=-Math.atan2(bz-az,bx-ax);road.position.set((ax+bx)/2-.75,.018,(az+bz)/2-.75);infrastructure.add(road);
  }
  for(const b of list){
    const pad=new THREE.Mesh(new THREE.CircleGeometry(1.1,8),new THREE.MeshBasicMaterial({color:0x485653,side:THREE.DoubleSide}));pad.rotation.x=-Math.PI/2;pad.position.set(b.position[0]-.75,.025,b.position[1]-.75);infrastructure.add(pad);
    const detail=(x:number,z:number,w:number,h:number,color:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,.06,h),new THREE.MeshLambertMaterial({color}));mesh.position.set(b.position[0]+x,.05,b.position[1]+z);infrastructure.add(mesh);};
    if(b.id==='civil_district'){detail(-1.35,-.65,.08,.08,0x73c9ce);detail(-.15,-1.2,.08,.08,0xd69c55);detail(-1.1,-1.1,1.15,.08,0x78827b);}
    if(b.id==='ore_extractor'){for(let n=0;n<5;n++)detail(-1.55+n*.18,-1.15,.12,.14,n%2?0x878271:0x6c6c60);detail(-.7,-1.45,1.1,.12,0x817568);}
    if(b.id==='fuel_refinery'){detail(-1.2,-1.25,1.35,.1,0x9b8164);detail(-.55,-.85,.1,.8,0x77918b);detail(-1.45,-.8,.1,.1,0xd69c55);}
    if(b.id===selected){const outline=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.get(b.id),color:0x77d4db,transparent:true,alphaTest:.05,depthWrite:false,depthTest:false}));outline.position.set(b.position[0],.04,b.position[1]);outline.center.set(.5,0);outline.scale.set(3.35,3.35,1);outline.renderOrder=1;objects.add(outline);}
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.get(b.id),transparent:true,alphaTest:.05,depthWrite:false}));sprite.position.set(b.position[0],.05,b.position[1]);sprite.center.set(.5,0);sprite.scale.set(3.15,3.15,1);sprite.userData.id=b.id;sprite.renderOrder=2;objects.add(sprite);
    if(b.id===selected){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=40;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#101c28';ctx.fillRect(0,0,256,40);ctx.fillStyle='#e9ead8';ctx.textAlign='center';ctx.font='bold 20px sans-serif';ctx.fillText(`${b.name} · Nv ${b.level}`,128,27,248);const tex=new THREE.CanvasTexture(canvas);tex.minFilter=THREE.NearestFilter;tex.magFilter=THREE.NearestFilter;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));label.position.set(b.position[0],3.45,b.position[1]);label.scale.set(3,.47,1);label.renderOrder=3;label.userData.label=true;label.userData.id=b.id;objects.add(label);}}
  }render();};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const aspect=w/h;const half=5.4;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  const change=()=>{const x=THREE.MathUtils.clamp(controls.target.x,-2,2),z=THREE.MathUtils.clamp(controls.target.z,-2,2);camera.position.x+=x-controls.target.x;camera.position.z+=z-controls.target.z;controls.target.x=x;controls.target.z=z;render();};
  controls.addEventListener('change',change);controls.update();
  let down:{x:number;y:number}|null=null;
  const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
  const pointerUp=(e:PointerEvent)=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=ray.intersectObjects(objects.children).find(item=>item.object.userData.id);if(hit)onSelect(hit.object.userData.id as string);};
  const contextLost=(event:Event)=>{event.preventDefault();onError();};
  renderer.domElement.addEventListener('webglcontextlost',contextLost);
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const reset=()=>{controls.target.set(0,0,0);camera.position.set(8,10,9);camera.zoom=1;camera.updateProjectionMatrix();controls.update();render();};
  return {update,reset,dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',change);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);clear();clearInfrastructure();ground.geometry.dispose();(ground.material as THREE.Material).dispose();groundTexture.dispose();rocks.geometry.dispose();(rocks.material as THREE.Material).dispose();textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}

export function PlanetDiorama({planetId,planet,levels,onFallback}:{planetId:string;planet:Planet;levels:Record<string,number>;onFallback:()=>void}) {
  const host=useRef<HTMLDivElement>(null);const scene=useRef<Scene|null>(null);const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState(false);
  const list=useMemo(()=>dioramaBuildings(planetId,levels),[planetId,levels]);
  useEffect(()=>{setSelected(null);setError(false);if(!host.current)return;try{scene.current=createScene(host.current,planetId,planet,setSelected,()=>setError(true));}catch{setError(true);return;}return()=>{scene.current?.dispose();scene.current=null;};},[planetId]);
  useEffect(()=>{scene.current?.update(list,selected);if(selected&&!list.some(item=>item.id===selected))setSelected(null);},[list,selected]);
  return <section className="planet-diorama" aria-label="Superfície planetária"><div ref={host} className="planet-diorama-canvas"/>{error?<div role="alert">Não foi possível iniciar o WebGL. <button onClick={onFallback}>Voltar às instalações</button></div>:<div className="planet-diorama-controls"><button onClick={()=>scene.current?.reset()}>Restaurar visão</button><span>Arraste para mover · roda ou pinça para aproximar</span><div aria-label="Selecionar construção">{list.map(b=><button key={b.id} aria-pressed={selected===b.id} onClick={()=>setSelected(b.id)}>{b.name} · Nv {b.level}</button>)}</div>{!list.length&&<span>Nenhuma das instalações representadas foi construída neste planeta.</span>}</div>}</section>;
}
