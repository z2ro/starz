import {expect,it} from 'vitest';
import * as THREE from 'three';
import {decorativeStars,stellarAppearance,stellarSurface,orbitalFrame} from '../frontend/src/galaxy/galaxyVisuals';
import {ShipPixelPipeline,SHIP_PIXEL_PALETTE} from '../frontend/src/shipgeometrylab/ShipPixelPipeline';
import {createOrbitalStar,ORBITAL_PALETTE} from '../frontend/src/galaxy/OrbitalStar';

it('generates stable, non-grid decorative stars with exclusion spacing and varied brightness',()=>{
 const points=decorativeStars('Asterion');expect(points).toEqual(decorativeStars('Asterion'));expect(points).not.toEqual(decorativeStars('Another'));
 expect(points).toHaveLength(420);expect(new Set(points.map(p=>p.brightness)).size).toBe(3);
 expect(points.filter(p=>p.size===2).length).toBeLessThan(30);
 expect(new Set(points.map(p=>p.x)).size).toBe(points.length);expect(new Set(points.map(p=>p.y)).size).toBe(points.length);
 const increments=points.slice(1).map((p,i)=>[(p.x-points[i].x).toFixed(6),(p.y-points[i].y).toFixed(6)].join(':'));expect(new Set(increments).size).toBeGreaterThan(points.length*.95);
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)expect(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)).toBeGreaterThanOrEqual(.012);
 // Density varies at large scales; minimum spacing alone would produce an even field.
 const counts=Array.from({length:16},()=>0);points.forEach(p=>counts[Math.min(3,Math.floor(p.y*4))*4+Math.min(3,Math.floor(p.x*4))]++);
 expect(Math.max(...counts)-Math.min(...counts)).toBeGreaterThan(8);
});
it('uses existing backend-class color identities, including a warm K and red M',()=>{
 expect(stellarAppearance('K').color).toBe('#ffb66f');expect(stellarAppearance('m').color).toBe('#e47b69');
 expect(stellarAppearance('O').color).toBe('#b9d4ff');expect(stellarAppearance('B').color).not.toBe(stellarAppearance('G').color);
 expect(new Set(['O','B','A','F','G','K','M'].map(c=>stellarAppearance(c).color)).size).toBe(7);
});
it('creates repeatable quantized stellar texture with continuous longitude',()=>{
 const data=stellarSurface('Asterion');expect(data).toEqual(stellarSurface('Asterion'));expect(data).not.toEqual(stellarSurface('Other'));
 expect(new Set(Array.from(data).filter((_,i)=>i%4===0)).size).toBeGreaterThan(2);
 for(let y=0;y<48;y++)expect(data.slice(y*96*4,y*96*4+4)).toEqual(data.slice((y*96+95)*4,(y*96+96)*4));
});
it.each([[1200,600],[740,330],[370,200],[370,400]])('frames every orbital phase within %sx%s, including body radius', (width,height)=>{
 const camera=new THREE.OrthographicCamera();camera.position.set(4,5,9);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);const m=camera.matrixWorld.elements;
 const frame=orbitalFrame(7,.62,width,height,{x:m[0],z:m[2]},{x:m[4],z:m[6]});
 for(let i=0;i<360;i++){const x=7*Math.cos(i*Math.PI/180),z=7*Math.sin(i*Math.PI/180);expect(Math.abs(x*m[0]+z*m[2])+.62).toBeLessThan(frame.halfWidth);expect(Math.abs(x*m[4]+z*m[6])+.62).toBeLessThan(frame.halfHeight);}
 expect(Math.max(frame.x/frame.halfWidth,frame.y/frame.halfHeight)).toBeGreaterThan(.7);
});
it('releases the stellar texture, geometry and material once',()=>{
 const star=createOrbitalStar('Asterion','K'),events:string[]=[];
 star.mesh.geometry.addEventListener('dispose',()=>events.push('geometry'));star.mesh.material.addEventListener('dispose',()=>events.push('material'));star.mesh.material.uniforms.surface.value.addEventListener('dispose',()=>events.push('texture'));
 star.dispose();expect(events.sort()).toEqual(['geometry','material','texture']);
});

it('keeps the approved default pipeline and shaders while allowing a 48-color orbital ramp',()=>{
 expect(ORBITAL_PALETTE).toHaveLength(48);expect(SHIP_PIXEL_PALETTE[22]).toBe('#4e3875');expect(ORBITAL_PALETTE[22]).toBe('#633333');
 const original=new ShipPixelPipeline(),orbital=new ShipPixelPipeline(ORBITAL_PALETTE);
 const material=(pipeline:ShipPixelPipeline)=>(pipeline as unknown as {material:THREE.ShaderMaterial}).material;
 expect(material(orbital).fragmentShader).toBe(material(original).fragmentShader);
 expect(material(original).uniforms.uPalette.value[22]).not.toEqual(material(orbital).uniforms.uPalette.value[22]);
 original.dispose();orbital.dispose();
 expect(()=>new ShipPixelPipeline(['#000000'])).toThrow('48 colors');
});
