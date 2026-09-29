# Render Lab 01

Render Lab 01 is an isolated `#/render-lab` experiment for the existing
`horizon.glb`. It is not part of the Shipyard or gameplay views.

The lab uses Three.js `WebGPURenderer`, TSL node materials, `vgpu@0.5.0`
`tslExports()` and Vite-loaded WGSL modules. `hull-surface.wgsl` adds a small
Perlin-based roughness variation; `engine-emissive.wgsl` is applied only to the
GLB meshes named `horizon_engine_core*` / material `engine emissive`.

Open `/#/render-lab` in a WebGPU-capable browser. The panel exposes camera,
star, exposure, environment, material and debug controls, plus an original
material comparison. The viewport loads `/static/models/horizon.glb`, centers
it from its bounding box, and disposes renderer resources on unmount.

Validate the WGSL modules with:

```sh
npm run shader:check
```

The command performs vgpu source/dependency diagnostics. Device-backed
validation is attempted automatically; environments without a Vulkan/WebGPU
adapter report a skipped validation instead of failing the source check.

This lab deliberately does not modify `PlanetRenderer`, Shipyard, gameplay,
GLB geometry or the 11-ship design catalog. The current environment may show
the explicit unsupported-WebGPU state when no browser GPU adapter is present.
