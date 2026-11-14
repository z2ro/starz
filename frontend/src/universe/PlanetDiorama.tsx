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
  const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.99,.22,.99),new THREE.MeshLambertMaterial(),144);
  const family=derivePlanetFamily(planet.temperature,planet.water);
  const palette=family==='frozen'?['#a0b8b8','#809d9d','#becbba']:family==='desert'?['#967d54','#ad9364','#75674a']:family==='oceanic'?['#4e7772','#648c80','#3d6264']:['#667b57','#7e895f','#526b55'];
  const matrix=new THREE.Matrix4();
  for(let i=0;i<144;i++){const x=i%12-5.5,z=Math.floor(i/12)-5.5; matrix.makeTranslation(x, -.12,z);tiles.setMatrixAt(i,matrix);tiles.setColorAt(i,new THREE.Color(palette[hash(`${planetId}:terrain:${i}`)%palette.length]));}
  scene.add(tiles,new THREE.HemisphereLight(0xd8e8dc,0x394048,2));
  const light=new THREE.DirectionalLight(0xffe3ad,1.5);light.position.set(-5,10,7);scene.add(light);
  const objects=new THREE.Group();scene.add(objects);
  const textures=new Map<string,THREE.Texture>();const loader=new THREE.TextureLoader();
  let frame=0, disposed=false;
  const render=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});};
  for(const b of buildings){const texture=loader.load(b.image,()=>render()); texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;textures.set(b.id,texture);}
  const clear=()=>{for(const object of [...objects.children]){objects.remove(object);if(object instanceof THREE.Sprite){object.material.dispose();if(object.userData.label) object.material.map?.dispose();}else if(object instanceof THREE.Mesh){object.geometry.dispose();(object.material as THREE.Material).dispose();}}};
  const update=(list:Site[], selected:string|null)=>{clear();for(const b of list){
    if(b.id===selected){const outline=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.get(b.id),color:0x77d4db,transparent:true,alphaTest:.05,depthWrite:false,depthTest:false}));outline.position.set(b.position[0],.04,b.position[1]);outline.center.set(.5,0);outline.scale.set(3,3,1);outline.renderOrder=1;objects.add(outline);}
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.get(b.id),transparent:true,alphaTest:.05,depthWrite:false}));sprite.position.set(b.position[0],.05,b.position[1]);sprite.center.set(.5,0);sprite.scale.set(2.8,2.8,1);sprite.userData.id=b.id;sprite.renderOrder=2;objects.add(sprite);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=40;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#101c28';ctx.fillRect(0,0,256,40);ctx.fillStyle='#e9ead8';ctx.textAlign='center';ctx.font='bold 20px sans-serif';ctx.fillText(`${b.name} · Nv ${b.level}`,128,27,248);const tex=new THREE.CanvasTexture(canvas);tex.minFilter=THREE.NearestFilter;tex.magFilter=THREE.NearestFilter;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));label.position.set(b.position[0],3.2,b.position[1]);label.scale.set(3,.47,1);label.renderOrder=3;label.userData.label=true;label.userData.id=b.id;objects.add(label);}
  }render();};
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const aspect=w/h;const half=6.1;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h,false);render();};
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
  return {update,reset,dispose:()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.removeEventListener('change',change);controls.dispose();renderer.domElement.removeEventListener('webglcontextlost',contextLost);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);clear();tiles.geometry.dispose();(tiles.material as THREE.Material).dispose();textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove();}};
}

export function PlanetDiorama({planetId,planet,levels,onFallback}:{planetId:string;planet:Planet;levels:Record<string,number>;onFallback:()=>void}) {
  const host=useRef<HTMLDivElement>(null);const scene=useRef<Scene|null>(null);const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState(false);
  const list=useMemo(()=>dioramaBuildings(planetId,levels),[planetId,levels]);
  useEffect(()=>{setSelected(null);setError(false);if(!host.current)return;try{scene.current=createScene(host.current,planetId,planet,setSelected,()=>setError(true));}catch{setError(true);return;}return()=>{scene.current?.dispose();scene.current=null;};},[planetId]);
  useEffect(()=>{scene.current?.update(list,selected);if(selected&&!list.some(item=>item.id===selected))setSelected(null);},[list,selected]);
  return <section className="planet-diorama" aria-label="Superfície planetária"><div ref={host} className="planet-diorama-canvas"/>{error?<div role="alert">Não foi possível iniciar o WebGL. <button onClick={onFallback}>Voltar às instalações</button></div>:<div className="planet-diorama-controls"><button onClick={()=>scene.current?.reset()}>Restaurar visão</button><span>Arraste para mover · roda ou pinça para aproximar</span><div aria-label="Selecionar construção">{list.map(b=><button key={b.id} aria-pressed={selected===b.id} onClick={()=>setSelected(b.id)}>{b.name} · Nv {b.level}</button>)}</div>{!list.length&&<span>Nenhuma das instalações representadas foi construída neste planeta.</span>}</div>}</section>;
}
