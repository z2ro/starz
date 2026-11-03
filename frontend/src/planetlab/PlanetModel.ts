import * as THREE from 'three';
import { generatePlanetTextures, samplePlanet } from './planetGenerator';
import { PLANET_PRESETS, type PlanetLabSettings } from './planetLabTypes';

export const PLANET_RADIUS = 1.28;
export const PLANET_OUTER_RADIUS = PLANET_RADIUS * 1.06;

export function disposeLabObject(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Points)) return;
    geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
  object.clear();
}

/** The approved Planet Lab mesh assembly, shared without changing its appearance. */
export function createLabPlanet(settings: PlanetLabSettings) {
    const root = new THREE.Group();
    const textures = generatePlanetTextures(settings);
    const colorTexture = new THREE.CanvasTexture(textures.color);
    const roughnessTexture = new THREE.CanvasTexture(textures.roughness);
    const cloudTexture = new THREE.CanvasTexture(textures.clouds);
    colorTexture.colorSpace = THREE.SRGBColorSpace;
    colorTexture.anisotropy = 1;
    roughnessTexture.colorSpace = THREE.NoColorSpace;
    cloudTexture.colorSpace = THREE.NoColorSpace;
    for (const texture of [colorTexture, roughnessTexture, cloudTexture]) {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.RepeatWrapping;
    }
    const radius = PLANET_RADIUS;
    const geometry = new THREE.SphereGeometry(radius, 128, 80);
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      const direction = new THREE.Vector3(positions.getX(index), positions.getY(index), positions.getZ(index)).normalize();
      const sample = samplePlanet(direction, settings);
      const displacement = sample.land ? sample.elevation * 0.045 : 0;
      positions.setXYZ(index, direction.x * (radius + displacement), direction.y * (radius + displacement), direction.z * (radius + displacement));
    }
    geometry.computeVertexNormals();
    const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: colorTexture, roughnessMap: roughnessTexture, roughness: 0.72, metalness: 0.04 }));
    surface.castShadow = true;
    surface.receiveShadow = true;
    root.add(surface);
    const cloudGeometry = new THREE.SphereGeometry(radius * 1.045, 96, 64);
    const cloudLayer = new THREE.Mesh(cloudGeometry, new THREE.MeshStandardMaterial({ color: 0xe4edf0, alphaMap: cloudTexture, transparent: true, opacity: 0.52, roughness: 1, depthWrite: false }));
    cloudLayer.renderOrder = 2;
    cloudLayer.castShadow = false;
    root.add(cloudLayer);
    const preset = PLANET_PRESETS[settings.family];
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.06, 96, 64), new THREE.ShaderMaterial({
      uniforms: { uLight: { value: new THREE.Vector3(1, 0.45, 0.5).normalize() }, uColor: { value: new THREE.Color(preset.atmosphereColor).multiplyScalar(preset.atmosphereStrength) } },
      vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){ vec4 world = modelMatrix * vec4(position, 1.0); vNormal = normalize(mat3(modelMatrix) * normal); vView = cameraPosition - world.xyz; gl_Position = projectionMatrix * viewMatrix * world; }',
      fragmentShader: 'uniform vec3 uLight; uniform vec3 uColor; varying vec3 vNormal; varying vec3 vView; void main(){ float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 2.25); float lit = 0.28 + max(dot(normalize(vNormal), normalize(uLight)), 0.0) * 0.72; gl_FragColor = vec4(uColor * rim * lit, rim * 0.44); }',
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    }));
    atmosphere.renderOrder = 3;
    root.add(atmosphere);
    root.rotation.z = THREE.MathUtils.degToRad(settings.axialTilt);
    return { root, cloudLayer, atmosphere, surface, diagnostics: textures.diagnostics };
}
