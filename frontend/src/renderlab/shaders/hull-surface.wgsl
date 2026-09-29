import { perlin3d } from "@vgpu/wgsl-std/noise/perlin";

// Deliberately restrained variation: this is a surface response, not camouflage.
export fn hullRoughness(position: vec3f, variation: f32) -> f32 {
  let macroNoise = perlin3d(position * 1.65 + vec3f(0.37, 1.11, 2.19));
  let micro = perlin3d(position * 7.0 + vec3f(3.2, 0.8, 1.7));
  return (macroNoise * 0.72 + micro * 0.28) * variation;
}
