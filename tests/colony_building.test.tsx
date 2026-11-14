import {describe,it,expect} from 'vitest';
import {createColonyBuilding} from '../frontend/src/universe/ColonyBuilding';
import * as THREE from 'three';
describe('colony geometry',()=>{
 for(const id of ['civil_district','ore_extractor','fuel_refinery'])it(id+' has valid selectable geometry and deterministic animation',()=>{
  const a=createColonyBuilding(id,false),b=createColonyBuilding(id,false);
  a.animate(4);b.animate(4);expect(a.group.children.map(c=>c.rotation.toArray())).toEqual(b.group.children.map(c=>c.rotation.toArray()));
  a.group.traverse(o=>{if(o instanceof THREE.Mesh){expect(o.userData.id).toBe(id);expect([...o.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);}});
  a.dispose();b.dispose();
 });
});
