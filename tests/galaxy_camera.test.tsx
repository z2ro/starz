import {expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {chooseOrbitalCamera,OrbitalCameraDirector,orbitalLabelRect} from '../frontend/src/galaxy/OrbitalCameraDirector';
import {createOrbitalStar} from '../frontend/src/galaxy/OrbitalStar';
import {STELLAR_VISUAL_RADII,stellarAppearance,visualOrbitRadius} from '../frontend/src/galaxy/galaxyVisuals';
import {orbitalPosition} from '../frontend/src/galaxy/galaxyPresentation';
import {identityFixtures} from './fixtures/galaxyIdentity';
it('uses bounded class presentation sizes, not physical stellar radii',()=>{
 for(const [type,radius] of Object.entries(STELLAR_VISUAL_RADII)){expect(stellarAppearance(type).radius).toBe(radius);expect(radius/(1.28*.495)).toBeGreaterThanOrEqual(2);expect(radius/(1.28*.495)).toBeLessThanOrEqual(2.5);expect(visualOrbitRadius(radius,0)-.72-radius).toBeGreaterThan(.49);}
 expect(stellarAppearance('unknown').radius).toBe(1.44);
});
it.each([1,2,5])('deterministically frames %s planets without modifying positions',count=>{
 for(const [width,height] of [[1200,600],[740,330],[370,200]]){
  const star=1.42,bodies=Array.from({length:count},(_,slot)=>{const p=orbitalPosition(identityFixtures.two,slot,1234,slot);return{position:new THREE.Vector3(p.x,p.y,p.z),radius:.68,labelWidth:125,labelHeight:44};}),original=bodies.map(p=>p.position.toArray());
  const radius=visualOrbitRadius(star,count-1),view=chooseOrbitalCamera(bodies,radius,star,width,height),camera=new THREE.OrthographicCamera(-view.frame.halfWidth,view.frame.halfWidth,view.frame.halfHeight,-view.frame.halfHeight,.1,150);camera.position.copy(view.direction).multiplyScalar(20);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  expect(view.direction.y*Math.min(...bodies.map(p=>p.position.length()))).toBeGreaterThan(star);
  expect(view).toEqual(chooseOrbitalCamera(bodies,radius,star,width,height));expect(bodies.map(p=>p.position.toArray())).toEqual(original);
  const scale=height/(2*view.frame.halfHeight),disks=[{position:new THREE.Vector3(),radius:star},...bodies].map(p=>{const v=p.position.clone().project(camera);return{x:(v.x+1)*width/2,y:(1-v.y)*height/2,r:p.radius*scale};});
  disks.forEach(p=>{expect(p.x-p.r).toBeGreaterThan(0);expect(p.x+p.r).toBeLessThan(width);expect(p.y-p.r).toBeGreaterThan(0);expect(p.y+p.r).toBeLessThan(height);});
  for(let a=0;a<disks.length;a++)for(let b=0;b<a;b++)expect(Math.hypot(disks[a].x-disks[b].x,disks[a].y-disks[b].y)).toBeGreaterThan(disks[a].r+disks[b].r);
 }
});
it('focuses smoothly, honors reduced motion, and stops on manual input or Reset',()=>{
 const camera=new THREE.OrthographicCamera(),controls={target:new THREE.Vector3(),enableDamping:true,update:vi.fn(()=>true)},director=new OrbitalCameraDirector(camera,controls),body={position:new THREE.Vector3(3,0,1),radius:.65};
 director.reset([body],4,1.42,740,330);const initial=camera.position.clone();director.focus(body,{bodies:[body],starRadius:1.42,width:740,height:330},false,100);expect(camera.position).toEqual(initial);expect(director.moving).toBe(true);director.update(280);expect(camera.position).not.toEqual(initial);director.cancel();const manual=camera.position.clone();expect(director.update(600)).toBe(false);expect(camera.position).toEqual(manual);
 director.focus(body,{bodies:[body],starRadius:1.42,width:740,height:330},true,1000);expect(director.moving).toBe(false);expect(controls.target.toArray()).toEqual(body.position.clone().multiplyScalar(.18).toArray());
 director.reset([body],4,1.42,740,330);expect(camera.zoom).toBe(1);expect(controls.target.length()).toBe(0);expect(director.moving).toBe(false);
});

it('allows bounded star scaling and clears its enlarged orbital surface',()=>{
 for(const scale of [NaN,.5,1,1.5,2]){const star=createOrbitalStar('scale','K',scale);expect(Number.isFinite(star.radius)).toBe(true);expect(visualOrbitRadius(star.radius,0)-.72-star.radius).toBeCloseTo(.5);expect(star.mesh.position.length()).toBe(0);star.dispose();}
});

it('keeps long selected labels reachable in a short viewport',()=>{
 const camera=new THREE.OrthographicCamera(),controls={target:new THREE.Vector3(),enableDamping:true,update:()=>true},director=new OrbitalCameraDirector(camera,controls);
 const body={position:new THREE.Vector3(-2.1,0,1.7),radius:.64,labelWidth:180,labelHeight:44},context={bodies:[body],starRadius:1.42,width:370,height:180};
 director.reset([body],2.64,1.42,370,180);director.focus(body,context,true,0);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
 const scale=180/(2*camera.top)*camera.zoom,disks=[{position:new THREE.Vector3(),radius:1.42},body].map(p=>{const v=p.position.clone().project(camera);return{x:(v.x+1)*185,y:(1-v.y)*90,r:p.radius*scale};});
 expect(orbitalLabelRect(disks[1],180,44,370,180,disks)).toBeDefined();
});
