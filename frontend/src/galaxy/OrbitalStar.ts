import * as THREE from 'three';
import {SHIP_PIXEL_PALETTE} from '../shipgeometrylab/ShipPixelPipeline';

// Replace three nonstellar/duplicate swatches only in the orbital scene; keep 48 colors.
export const ORBITAL_PALETTE=SHIP_PIXEL_PALETTE.map((color,i)=>i===22?'#633333':i===46?'#b56847':i===47?'#e49a69':color);
import {stellarAppearance,stellarSurface} from './galaxyVisuals';

/** Local stellar material; the shared low-resolution palette/dither pass remains unchanged. */
export function createOrbitalStar(seed:string,stellarClass:string){
 const appearance=stellarAppearance(stellarClass);
 const texture=new THREE.DataTexture(stellarSurface(seed),96,48,THREE.RGBAFormat);
 texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;
 const material=new THREE.ShaderMaterial({
  uniforms:{surface:{value:texture},color:{value:new THREE.Color(appearance.color)}},
  vertexShader:`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
   void main(){vUv=uv;vNormal=normalize(normalMatrix*normal);vec4 view=modelViewMatrix*vec4(position,1.0);vView=-view.xyz;gl_Position=projectionMatrix*view;}`,
  fragmentShader:`precision highp float;uniform sampler2D surface;uniform vec3 color;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
   void main(){float cell=texture2D(surface,vUv).r*3.0;
    float limb=floor(pow(max(dot(normalize(vNormal),normalize(vView)),0.0),0.4)*3.99);
    float level=clamp(floor(cell*0.7+limb*0.3+0.25),0.0,3.0);
    gl_FragColor=vec4(color*(0.22+level*0.24),1.0);}`,
  toneMapped:false,
 });
 const mesh=new THREE.Mesh(new THREE.SphereGeometry(.85,32,24),material);
 return {mesh,dispose(){texture.dispose();material.dispose();mesh.geometry.dispose();}};
}
