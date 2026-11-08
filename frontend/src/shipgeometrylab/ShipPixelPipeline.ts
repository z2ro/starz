import * as THREE from 'three';
import type { ShipLabSettings } from './shipLabTypes';

// shortcut: local copy of the approved Planet Lab shaders; consolidate after both labs are reviewed.
const PALETTE = [
  '#020711', '#081425', '#102a40', '#183f55', '#0b4a63', '#14728a',
  '#214f43', '#3e7150', '#6f8b4a', '#9b874f', '#b69e62', '#6a4c34',
  '#5d5e5a', '#9ab7aa', '#c9e1e4', '#f3fbf8', '#496d95', '#78a9bf',
  '#2a7897', '#8bb8c7', '#d3d9cc', '#e5edf0', '#4e3875', '#c0a75b',
  '#061019', '#0c202c', '#123948', '#19536b', '#1c5d78', '#33899a',
  '#172f2c', '#2f5940', '#55754b', '#7c925b', '#b7a77c', '#d0bc8e',
  '#333d3d', '#788582', '#acc8ca', '#dcecef', '#304b65', '#587c95',
  '#306172', '#6699a6', '#8a938d', '#b4c2bf', '#25304a', '#e0cd9a',
];

const POST_VERTEX = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const POST_FRAGMENT = `
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform float uOutline;
uniform float uDither;
uniform vec3 uPalette[${PALETTE.length}];
varying vec2 vUv;

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float x0 = mod(q.x, 2.0), x1 = floor(q.x / 2.0);
  float y0 = mod(q.y, 2.0), y1 = floor(q.y / 2.0);
  return (abs(x0 - y0) * 8.0 + y0 * 4.0 + abs(x1 - y1) * 2.0 + y1 + 0.5) / 16.0;
}

vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toOklab(vec3 c) {
  c = max(toLinear(c), 0.0);
  float l = pow(0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b, 0.3333333);
  float m = pow(0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b, 0.3333333);
  float s = pow(0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b, 0.3333333);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}

void main() {
  vec4 source = texture2D(uColor, vUv);
  vec3 exposed = source.rgb * 1.08;
  vec3 mapped = clamp((exposed * (2.51 * exposed + 0.03)) / (exposed * (2.43 * exposed + 0.59) + 0.14), 0.0, 1.0);
  vec3 displayColor = mix(mapped * 12.92, 1.055 * pow(mapped, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), mapped));
  vec3 lab = toOklab(displayColor + (bayer4(floor(vUv / uTexel)) - 0.5) * uDither * 0.035);
  float centerDepth = texture2D(uDepth, vUv).r;
  float edge = 0.0;
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv + vec2(uTexel.x, 0.0)).r));
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv - vec2(uTexel.x, 0.0)).r));
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv + vec2(0.0, uTexel.y)).r));
  edge = max(edge, abs(centerDepth - texture2D(uDepth, vUv - vec2(0.0, uTexel.y)).r));
  if (uOutline > 0.5 && edge > 0.016) lab = mix(lab, vec3(lab.x * 0.68, lab.y * 0.62, lab.z * 0.62), 0.72);
  float best = 1e6;
  vec3 outputColor = uPalette[0];
  for (int index = 0; index < ${PALETTE.length}; index++) {
    vec3 paletteLab = toOklab(uPalette[index]);
    vec3 delta = paletteLab - lab;
    float distance = delta.x * delta.x * 1.25 + delta.y * delta.y + delta.z * delta.z;
    if (distance < best) { best = distance; outputColor = uPalette[index]; }
  }
  gl_FragColor = vec4(outputColor, 1.0);
}`;

const paletteVectors = PALETTE.map(hex => {
  const color = new THREE.Color(hex).convertLinearToSRGB();
  return new THREE.Vector3(color.r, color.g, color.b);
});

export class ShipPixelPipeline {
  private target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat,
    depthBuffer: true, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
  });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material = new THREE.ShaderMaterial({
    vertexShader: POST_VERTEX, fragmentShader: POST_FRAGMENT, depthTest: false, depthWrite: false,
    uniforms: {
      uColor: { value: this.target.texture }, uDepth: { value: this.target.depthTexture },
      uTexel: { value: new THREE.Vector2(1, 1) }, uOutline: { value: 1 },
      uDither: { value: 1 }, uPalette: { value: paletteVectors },
    },
  });
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
  width = 1;
  height = 1;

  constructor(palette?:readonly string[]) {
    if(palette){
      if(palette.length!==PALETTE.length){this.dispose();throw new Error(`Pixel palette must contain ${PALETTE.length} colors.`);}
      this.material.uniforms.uPalette.value=palette.map(hex=>{const color=new THREE.Color(hex).convertLinearToSRGB();return new THREE.Vector3(color.r,color.g,color.b);});
    }
    this.quad.frustumCulled = false; this.scene.add(this.quad);
  }

  resize(width: number, height: number, settings: ShipLabSettings) {
    const size = settings.raw ? 1 : Math.max(1, Math.min(6, settings.pixelSize));
    this.width = Math.max(1, Math.floor(width / size));
    this.height = Math.max(1, Math.floor(height / size));
    this.target.setSize(this.width, this.height);
    this.material.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, settings: ShipLabSettings) {
    if (settings.raw || settings.silhouette) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    this.material.uniforms.uOutline.value = Number(settings.outlines);
    this.material.uniforms.uDither.value = Number(settings.dither);
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.quad.geometry.dispose();
    this.material.dispose();
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.scene.clear();
  }
}

export {PALETTE as SHIP_PIXEL_PALETTE};
