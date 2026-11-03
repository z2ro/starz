import * as THREE from 'three';
import { samplePlanet, seedNumber, type PlanetGenerationSettings, type PlanetSample } from '../planetlab/planetGenerator';
import { PLANET_RADIUS } from '../planetlab/PlanetModel';

export function cityEligibility(sample: PlanetSample, latitude: number, family: PlanetGenerationSettings['family']) {
  if (!sample.land || sample.ice || sample.elevation > 0.56 || Math.abs(latitude) > 0.8 || sample.temperature < 0.2 || sample.temperature > 0.86) return 0;
  const climate = THREE.MathUtils.clamp(1 - Math.abs(sample.temperature - 0.5) * 1.6, 0, 1);
  const moisture = 0.15 + sample.moisture * 0.85;
  const familyWeight = family === 'frozen' ? 0 : family === 'desert' ? 0.15 : family === 'oceanic' ? 0.65 : 1;
  return climate * moisture * (sample.coastal ? 1 : 0.28) * familyWeight;
}

export function nightMask(incidence: number) {
  const x = THREE.MathUtils.clamp((-incidence - 0.03) / 0.22, 0, 1);
  return x * x * (3 - 2 * x);
}

export function generateCityLights(settings: PlanetGenerationSettings, count = 48000) {
  const positions: number[] = [], strengths: number[] = [];
  const hash = seedNumber(`${settings.seed}:settlements`), offset = (hash % 10000) / 1000;
  const direction = new THREE.Vector3();
  for (let index = 0; index < count; index++) {
    const y = 1 - (index + 0.5) / count * 2, angle = index * 2.399963229728653 + offset;
    const radius = Math.sqrt(1 - y * y);
    direction.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const sample = samplePlanet(direction, settings);
    const eligibility = cityEligibility(sample, y, settings.family);
    if (!eligibility) continue;
    const regional = Math.sin(direction.x * 9 + offset) * Math.cos(direction.z * 11 - offset) * Math.sin(direction.y * 7 + 2);
    const random = Math.sin(index * 127.1 + hash % 65536) * 43758.5453;
    if (regional < 0.16 || random - Math.floor(random) > eligibility * 0.85) continue;
    const height = PLANET_RADIUS + sample.elevation * 0.045 + 0.004;
    positions.push(direction.x * height, direction.y * height, direction.z * height);
    strengths.push(0.6 + eligibility * 0.4);
  }
  return { positions: new Float32Array(positions), strengths: new Float32Array(strengths) };
}

export function createNightLights(settings: PlanetGenerationSettings) {
  const data = generateCityLights(settings);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('strength', new THREE.BufferAttribute(data.strengths, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3() }, uIntensity: { value: 1 }, uHeight: { value: 1 } },
    vertexShader: `attribute float strength; uniform vec3 uSun; uniform float uHeight; varying float vEmission;
      void main(){ vec3 n = normalize(mat3(modelMatrix) * normalize(position));
        float night = smoothstep(0.03, 0.25, -dot(n, uSun)); vEmission = strength * night;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(uHeight * projectionMatrix[1][1] * 0.0035, 1.0, 5.0); }`,
    fragmentShader: `uniform float uIntensity; varying float vEmission;
      void main(){ float spot = 1.0 - smoothstep(0.12, 0.5, distance(gl_PointCoord, vec2(0.5)));
        float alpha = vEmission * spot; if(alpha < 0.02) discard;
        gl_FragColor = vec4(vec3(0.9, 0.65, 0.28) * uIntensity, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'Experimental civilization lights — not gameplay'; points.renderOrder = 1;
  return points;
}
