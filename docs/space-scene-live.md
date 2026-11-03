# Space Scene Runtime Integration 01

Experimental lazy route: `#/space-scene-live`, outside AppShell/sidebar. Base: main
`2d26bc2` after PR #8. Planet View and all approved laboratories remain unchanged.
Open the normal app URL followed by `#/space-scene-live`; this session's real API
was served at `http://localhost:8010/#/space-scene-live` because 8000 already held
a frontend preview. No backend, game_data, API or schema changes.

## Data and snapshot ownership

`useCatalogQuery()` and `useStateQuery(selectedPlanetId)` are reused directly.
TanStack Query owns the existing 15-second polling, per-planet cache and retries.
No second request client, custom interval or mutation was added. The descriptor is
memoized from the accepted State + Catalog; render statistics never regenerate it.

The initial request uses `/api/state`; explicit selection uses the existing
`/api/state?planet_id=...`. Target data must have the requested `active_planet.id`.
Missing, erroneous or mismatched snapshots pass `null` to the persistent renderer.
A layout effect hides the old model and draws a cleared frame before browser paint.
The selector retains only the last valid ID/name roster for navigation; it does not
provide physics, population or naval evidence. Late responses for other query keys
cannot populate the current scene. Correct cached target data can be reused while
that same planet refreshes. Any API error hides the scene and offers retry.

## Descriptor application

| Input | Runtime behavior |
| --- | --- |
| Stable identity + known family | `createLabPlanet` receives exact descriptor seed, family and all seven generation parameters |
| Identity/family unavailable | Hide the world and explain UNKNOWN; no fabricated Terran fallback |
| Atmosphere | Apply descriptor visibility, color and strength to existing uniforms |
| Population signal | Enable/intensify existing night-light generator only when adapter permits it |
| Known local compatible ships | Show one identified Horizon Prototype representative of N eligible entities |
| Remote/transit/unknown hull/readiness | Hide model; preserve entities and reasons in diagnostic list |
| Moon / station UNKNOWN | Never instantiate their factories or geometry |
| Lighting / scale | Apply adapter presentation hints, marked DEFAULT, not physical measurements |

Ship presence is **system scope only**. The representative is static, with an
explicitly labeled DEFAULT display pose. There is no orbit line, orbital animation,
automatic docking or claimed planet association. Its actual ship ID is shown; extra
eligible ships are counted, not cloned into a fictional fleet arrangement. Engine
emission is off because operational thrust is unavailable. Unknown models are never
substituted by the prototype. Existing model geometry/materials are reused.

No `observedAt` is invented from Date.now or query `dataUpdatedAt`. The current API
has no trustworthy snapshot-time contract, so free ships without proven readiness
remain hidden. An ARRIVED fleet provides operational system-presence evidence under
the existing adapter rules. In the captured local game, one fleet was remote and
the remaining free ship had no provable readiness time: the live scene correctly
showed no ship, despite two entries in the imperial inventory.

## Rendering, updates and lifecycle

One WebGLRenderer, one scene and the existing `ShipPixelPipeline` (low-resolution
target/depth, nearest upscaling, OKLab, Bayer, outlines; RAW comparison available).
PlanetModel, planetGenerator, ShipGeometry and NightLights are imported unchanged.
The isolated renderer retains the approved camera, shared stellar light/fill and
navy background. Camera, visual rotation, starfield, scale and illustrative pose are
presentation defaults, not gameplay facts. No new shaders or visual assets.

Geography key = seed + family + seven procedural parameters. Equal keys preserve
planet geometry, textures and continents, even when population, fleets, notices,
polling or render statistics change. Atmospheric changes update uniforms in place.
Night-light geometry is created lazily on first permission, then reused while
visibility/intensity change. Prototype geometry is also created lazily and reused.
Switching keys disposes the old planet/maps/lights; only one geography is retained.
Pending/error states hide that allocation, allowing same-key recovery without work.

Resize changes projection/target only. RAW/pause/camera controls do not reconstruct
geography. Pause leaves camera inspection active. Unmount cancels RAF, disconnects
ResizeObserver and disposes controls, model, geometry/materials/textures, shadow map,
pixel target and renderer. No Three.js objects enter the adapter or API hooks.

## Fixtures and validation

`tests/fixtures/live-api-state.json` captures the adapter-relevant subset of a real
local PostgreSQL/API snapshot. Persistent UUIDs were remapped consistently; stock,
notice and unrelated state were excluded. `live-api-catalog.json` contains the real
ship/district definitions. Sanitized UUIDs intentionally produce different visual
seeds from the actual live account. These files are never imported by runtime code.

`liveSnapshots.ts` derives explicit controlled cases: local fleet (coordinates and
destination changed together), transit, zero population and incomplete observation.
Second-world and unknown-hull scenarios are test-only, not additional entities in
the database. Tests use the real hooks/QueryClient with deferred network responses,
and the real CPU scene factories with a Canvas 2D stub; GPU is not needed for tests.

Commands: `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
Coverage includes stale response races, mismatch rejection, error/retry, population
updates, naval eligibility, same-key geography reuse, pause and resource disposal.

Chromium/SwiftShader Browser QA at **1920×1080 and 1366×768** covered real API PIXEL
and RAW, comparison with Lab 02, controlled local fleet, zero population, transit,
unknown hull, delayed selection, second world, incomplete data and API error.
Real 15-second polling was used: population/naval updates retained the same canvas
and generation count 1; switching to another world produced count 2 without replacing
the canvas. Loading/error/incomplete scenes contained no previous world. No horizontal
overflow or JS/shader errors. Screenshots/reports: `/tmp/starz-space-scene-live-qa/`.
Controlled screenshots are explicitly named `fixture-*`; they are not real gameplay.
Software rendering is not a desktop GPU benchmark; final visual approval is human.

## Remaining contracts

Trustworthy server snapshot time for unattached ship readiness; persistent current
planet/orbital positions; concrete station and moon entities; additional approved
hull-to-model mappings; physical stellar lighting/atmospheric pressure/scale units.
Urban locations remain a heuristic driven by local population, not persistent cities.
Unknown fields stay unknown; no gameplay capability is inferred to fill visual space.
