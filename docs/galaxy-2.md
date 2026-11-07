# Galaxy 2.0 — spatial presentation

The existing `#/galaxy` workspace has two levels: a 2D SVG strategic map and a lazy Three.js orbital scene. Both retain GameShell, resource HUD, navigation, the existing planet inspector context and mission planner. No backend, catalog, database or travel rule changed.

## Authority and disclosure

| Source | Presentation |
|---|---|
| `/api/galaxy?radius=2` | Only returned locations are drawn. Centers remain home or arrived fleets; no expanded query limits. |
| `system.x/y` | Stable identity across UNKNOWN (`x:y`) and SURVEYED (`system-x-y`) aliases; versioned warped/jittered visual positions. |
| `knowledge_level` | Unknown entries are explicitly stripped of name, star, planets and civilization before rendering, even if malformed data includes them. |
| Surveyed planet gravity, temperature, water, radiation | Existing physical inspector data and `derivePlanetVisual` mappings. Missing chemistry, geology and climate inputs keep existing documented presentation defaults; no city lights. |
| `state.fleets/ships`, catalog hull IDs | Own authorized fleet markers, composition, mission, destination and server arrival time. No inferred enemy fleets. Approved hull registry selects models; unknown designs are never replaced with Horizon. |
| Departure/arrival timestamps | Transit marker progression interpolates display positions. This is not a simulated flight path or a new travel mechanic. Invalid/missing timing suppresses the interpolated marker. |
| `state.observed_at` | Shared phase for illustrative orbital animation, advanced locally by monotonic elapsed time. Reduced motion/pause freezes animation. Without a server timestamp phases are presentation-only. |

The API exposes no universe identifier for this response. The layout namespace is shared and coordinate-based, never player-specific, random or derived from display names. Nodes retain their positions when discovery or query window changes. Actual distances and fuel/ETA remain exclusively server values.

## Interaction and lifecycle

- Strategic map: drag/pinch/wheel, keyboard arrows, +/- and Home; keyboard-selectable systems; fit/selection camera actions. Low zoom hides secondary names and collision checks suppress overlapping labels.
- Surveyed systems can open the orbital workspace. Rotate/pinch/wheel (cursor-focused zoom) or use zoom/reset buttons; planet labels and meshes select the same inspector context. Return restores the strategic camera.
- System, Planet and Fleets inspector tabs use existing finite content pagination. The mission action stays outside pagination. Destination and planet index go to the existing persisted fleet draft; no automatic spending or dispatch.
- Mobile retains Map / System-and-mission subviews, touch-sized controls, a planet selector and an explicit return to the strategic map. Short-height layouts remove redundant headings and paginate details rather than clipping actions.
- Only the orbital view creates a WebGL context. Planet geometries/textures regenerate only when their authorized visual inputs change. Selection, population/stock refresh and tabs retain the renderer. Approved ship assemblies are cached per design for that scene.
- Paused/reduced-motion scenes redraw only after actual input or state changes. Closing the scene or a render failure releases controls, frame loop, resize observer, handlers, planet textures/geometry/materials, ship assemblies, shared orbit resources, pixel pipeline and renderer.

## Rendering and limitations

Uses the approved `createLabPlanet`, hull factories/registry and `ShipPixelPipeline` (low-resolution target, depth outlines, OKLab palette and Bayer dithering). The star is a local sphere; no external assets, HDRs or new shaders. Ship staging, orbital radii, phases and apparent sizes are explicitly **presentation**, not orbital gameplay or measured astronomy.

The galaxy response lacks complete planetary profiles, persistent planet UUIDs and orbital elements. Orbital previews therefore use a stable coordinate/index seed and the shared partial-data mapping; they do not claim to reproduce the exact geography of the full Planet View. Only supplied planets exist in the scene. No moons, stations or foreign fleet/intelligence data are inferred. Lists distinguish no known own fleet from proof of an empty enemy system.

Development uses only the existing `compose.persistent.yaml` environment at `http://localhost:8030/#/galaxy`. No additional permanent Compose or database is required.

## Focused QA

Medium-risk frontend changes. Local QA runner jobs cover typecheck, build, spatial/disclosure/camera helpers, existing mission/navigation regressions and scene lifecycle. `scripts/visual-qa.cjs` supports `STARZ_QA_GALAXY_FLOW=1` with the existing galaxy case filter and disposable local API fixtures. It checks both levels, actual camera input, privacy, selection, retained canvas/geography, disposal and real mission-planner navigation. Screenshots and full reports stay in `.qa/runs/galaxy-2/`; no real player data or database writes are used. Browser rendering in SwiftShader is not a physical-GPU benchmark.

Validated with 26 focused frontend tests plus typecheck, build and diff checks. Chromium scenarios cover 1920×1080, 1366×768, 390×844 and an extra 390×650; mouse/wheel, keyboard, touch/pinch, both navigation levels, unknown-data suppression and mission destination transfer passed. A controlled stock/population snapshot refresh preserved the canvas and generation count. WebGL console checking is included in the focused galaxy flow. The two-planet/no-local-fleet fixture reported 9 draw calls and 65,082 triangles (including postprocessing), with low-resolution rendering; no hardware FPS claim is made.
