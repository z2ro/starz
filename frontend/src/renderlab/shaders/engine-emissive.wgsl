import { hash3 } from "@vgpu/wgsl-std/hash";

export fn engineEmission(position: vec3f, intensity: f32) -> vec3f {
  let pulse = 0.92 + hash3(position * 5.0 + vec3f(0.5, 1.7, 2.9)).x * 0.08;
  return vec3f(0.07, 0.38, 1.0) * intensity * pulse;
}
