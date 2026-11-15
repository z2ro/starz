import {describe,it,expect} from 'vitest';
import {createColonyBuilding} from '../frontend/src/universe/ColonyBuilding';
import * as THREE from 'three';
describe('colony geometry',()=>{
 for(const id of ['civil_district','ore_extractor','fuel_refinery'])it(id+' has valid selectable geometry and deterministic animation',()=>{
  const a=createColonyBuilding(id,false),b=createColonyBuilding(id,false);
  const transforms=(model:ReturnType<typeof createColonyBuilding>)=>model.group.children.map(c=>[...c.position.toArray(),...c.rotation.toArray(),...c.scale.toArray(),c.visible]);
  a.animate(1);const first=transforms(a);a.animate(4);b.animate(4);expect(transforms(a)).toEqual(transforms(b));expect(transforms(a)).not.toEqual(first);
  expect(a.group.position.toArray()).toEqual([0,0,0]);
  const bounds=new THREE.Box3().setFromObject(a.group);expect(bounds.min.y).toBeGreaterThanOrEqual(0);expect(bounds.max.y).toBeLessThan(3);
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  a.group.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of [o.material].flat())materials.add(m);}});
  let disposedGeometries=0,disposedMaterials=0;geometries.forEach(g=>g.addEventListener('dispose',()=>disposedGeometries++));materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterials++));
  a.group.traverse(o=>{if(o instanceof THREE.Mesh){expect(o.userData.id).toBe(id);expect([...o.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);}});
  a.dispose();b.dispose();expect(disposedGeometries).toBe(geometries.size);expect(disposedMaterials).toBe(materials.size);
 });
});
