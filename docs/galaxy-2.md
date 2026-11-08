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

Uses the approved `createLabPlanet`, hull factories/registry and `ShipPixelPipeline` (low-resolution target, depth outlines, OKLab palette and Bayer dithering). The star uses a local procedural surface (see Galaxy 2.2 below); no external assets or HDRs. The approved shared pixel postprocessing shaders remain unchanged. Ship staging, orbital radii, phases and apparent sizes are explicitly **presentation**, not orbital gameplay or measured astronomy.

The galaxy response lacks complete planetary profiles, persistent planet UUIDs and orbital elements. Orbital previews therefore use a stable coordinate/index seed and the shared partial-data mapping; they do not claim to reproduce the exact geography of the full Planet View. Only supplied planets exist in the scene. No moons, stations or foreign fleet/intelligence data are inferred. Lists distinguish no known own fleet from proof of an empty enemy system.

Development uses only the existing `compose.persistent.yaml` environment at `http://localhost:8030/#/galaxy`. No additional permanent Compose or database is required.

## Focused QA

Medium-risk frontend changes. Local QA runner jobs cover typecheck, build, spatial/disclosure/camera helpers, existing mission/navigation regressions and scene lifecycle. `scripts/visual-qa.cjs` supports `STARZ_QA_GALAXY_FLOW=1` with the existing galaxy case filter and disposable local API fixtures. It checks both levels, actual camera input, privacy, selection, retained canvas/geography, disposal and real mission-planner navigation. Screenshots and full reports stay in `.qa/runs/galaxy-2/`; no real player data or database writes are used. Browser rendering in SwiftShader is not a physical-GPU benchmark.

Validated with 26 focused frontend tests plus typecheck, build and diff checks. Chromium scenarios cover 1920×1080, 1366×768, 390×844 and an extra 390×650; mouse/wheel, keyboard, touch/pinch, both navigation levels, unknown-data suppression and mission destination transfer passed. A controlled stock/population snapshot refresh preserved the canvas and generation count. WebGL console checking is included in the focused galaxy flow. The two-planet/no-local-fleet fixture reported 9 draw calls and 65,082 triangles (including postprocessing), with low-resolution rendering; no hardware FPS claim is made.

## Galaxy 2.1 — system and planet identity

`SystemIdentity` separates the authorized system name and `(x,y)` from planet ordinals. It shows stellar class, the number of returned known planets and own-planet counts. If any ownership is missing, the count remains unknown (with any confirmed own planets identified separately), rather than claiming zero. The strategic map uses the same count rules.

| Authoritative field | UI rule |
|---|---|
| Surveyed `planet.name`, `planet_index` | Same name in map inspector, orbital label and selector. `P1` means API index `0`; mission URLs retain the original zero-based index. |
| `planet.ownership = OWNED` | Own colony; the exact `state.planets` match on system coordinates **and** index supplies the persistent UUID for management/reinforcement. |
| Matching roster entry `home = true` | Mundo natal. Neither `system.home` nor the first orbital position identifies the homeworld. |
| `UNCLAIMED` | Não colonizado; this alone does **not** authorize colonization. |
| `OCCUPIED` | Ocupado por outro império. No foreign identity is inferred or disclosed. |
| Missing/contradictory ownership | Estado desconhecido. Missing physical measurements display “Não informado”, never measured zero. |
| Unclaimed + `colonization.eligible = true` | Colonization may be suggested in the existing planner; its normal server preview/validation still decides whether dispatch is allowed. |

Ownership uses pixel glyphs (home, flag, empty world, shield, unknown). Selection uses a separate cyan label border and a depth-tested outline facing the camera. One `GalaxyView.planetIndex` controls meshes, accessible labels, native keyboard/touch selector and inspector. Camera navigation retains that selection. Label placement avoids projected bodies and other labels; the selector/inspector remain available when an offscreen/crowded label cannot fit. Identity updates do not regenerate planet geometry.

The fixed inspector footer exposes **Administrar** only with a confirmed own UUID, or a read-only **Requisitos** dialog for an unclaimed planet. Requirements use the returned eligibility, reason, cost and expedition population; no automatic action or spending. Occupied/unknown planets expose authorized information and the existing mission planner, without a colonization shortcut. Missing UUID/eligibility no longer implies a colonization mission. A verified foreign public planet UUID can preselect reconnaissance; unknown occupancy/identity falls back to a generic move, not invented permission.

### Reproducible focused checks

Five shared fixtures cover one planet, two including a nonzero-index homeworld, multiple own planets, foreign occupancy and incomplete ownership/physical data. `tests/galaxy_identity.test.tsx` checks mapping, partial counts, zero-vs-missing values, contextual actions and destination preservation. The opt-in `STARZ_QA_GALAXY_IDENTITY_FLOW=1` extends the existing local Playwright runner for `galaxy-populated-1366` and `galaxy-populated-390`: real mesh mouse/touch picking, shared selection, camera retention, layout, requirements dialog, privacy and unchanged renderer/geography. Mobile checks camera controls and mission actions in their respective explicit subviews after layout settles. These use disposable local API fixtures, no database or player accounts.

Evidence for this iteration stays in `.qa/runs/galaxy-21/`. The previous `STARZ_QA_GALAXY_FLOW=1` remains available for mission-planner navigation, camera/zoom, snapshot refresh and disposal regression checks. No gameplay, universe, orbit, renderer factory or schema changes are required.

Galaxy 2.1 validation: 39 focused frontend tests, typecheck, build and diff check passed. Chromium completed all five identity fixtures at both 1366×768 and 390×844; the extra generic 390×650 layout case also passed. The existing Galaxy flow passed at 1366×768, including real mission destination transfer, camera input, snapshot refresh without geography reconstruction and scene disposal. Final captures were reviewed for identity, selection, legibility and reachable actions. No security, JavaScript or layout findings remained in these scoped checks. This is not full-suite or physical-GPU certification.

## Galaxy 2.2 — orbital visual refinement

Presentation only. Backend coordinates, discovery, ownership, planet generation, orbital radii/phases/speeds and mission payloads are unchanged.

- **Decorative stars:** `decorativeStars` reuses the existing seeded hash utility. Rejection sampling combines three broad density concentrations with a normalized minimum separation of 0.012. Independent x/y samples avoid the old arithmetic sequence's diagonal alignments; mostly small points, three discrete brightness levels and fewer than 2% larger points. The strategic SVG memoizes 520 points in its decorative layer. The orbital scene batches 190 points into three reusable `Points` layers behind the scene, following the camera without reseeding. This is decoration, never discoverable systems or private data.
- **Real map markers:** versioned coordinate presentation `v2` uses a gently warped/sheared basis and a bounded seeded disk offset (106 display units). Positions remain independent of query order, viewer and discovery. Existing hit-target separation and label collision checks remain. If a query cannot fit at the existing minimum zoom, framing keeps the selected system safely visible; nearby systems remain reachable by pan.
- **Star:** `OrbitalStar` uses the existing O/B/A/F/G/K/M class colors from `starVisualConfig`. A 96×48 nearest-filtered texture samples the sphere before projecting into the existing noise utility, preserving the longitude seam. A small local stellar material combines quantized granulation and limb intensity; slow rotation uses the same visual simulation time and stops with pause/reduced motion. The K star is warm gold/amber through the local orbital palette. The point light takes the same stellar color. Missing class retains a documented presentation fallback, not an inferred backend classification.
- **Composition:** initial viewing direction changes from `(5,8,7)` to `(4,5,9)`, making the projected orbit less vertically demanding. Planet display scale changes from `.37 + index%3 × .035` to `.46 + index%3 × .035`, retaining the same generated geometry. `orbitalFrame` calculates the complete projected orbital envelope plus actual outer body radius and responsive margins; no per-resolution camera offsets. Reset fits the system; ordinary selection and resource refresh preserve the renderer, geography and user camera. Manual zoom/rotation can intentionally move objects outside the frame.
- **Orbits and labels:** shared thin orbit geometry, low-intensity blue for unselected paths and a separate restrained cyan material for the selected orbit. Labels lose the permanent framed-card background; names, ownership glyphs/status, keyboard semantics and 44px hit areas remain. A noninteractive SVG leader layer anchors labels to their planets. The existing collision solver now also considers diagonal placements. Secondary physical information stays in the inspector.
- **Lifecycle:** one WebGL context and the existing `ShipPixelPipeline`. Only a changed system/class rebuilds stellar texture/background batches. Stellar textures, materials, geometries, background batches, orbit materials, leaders and event handlers are released when the scene closes. No React state updates or geometry allocation per animation frame.

### Focused evidence

`tests/galaxy_visual.test.tsx` covers deterministic decorative distribution, spacing, irregular coordinate increments, brightness variation, all seven stellar colors, quantized/seam-continuous texture, projected framing across aspect ratios and stellar resource disposal. Existing identity, discovery, destination, navigation and renderer lifecycle tests remain in scope.

`STARZ_QA_GALAXY_VISUAL_FLOW=1` extends the existing local fixture runner with the same class-K Asterion snapshot before/after, separate map/orbital/selection captures and a brief animated smoke step. Run this flag separately from `STARZ_QA_GALAXY_FLOW=1`, which ends in the mission planner. Identity fixtures use `STARZ_QA_GALAXY_IDENTITY_FLOW=1` separately. Browser evidence is under `.qa/runs/galaxy-22/`, at 1920×1080, 1366×768 and 390×844. Tests use temporary browser contexts and disposable API fixtures; they do not touch saves or databases.

The test runner controls browser time. Animation callback intervals therefore **are not FPS**. Draw calls and triangle counts are actual renderer counters; brief Node wall-clock observations are diagnostic only. SwiftShader is not equivalent to a physical GPU. The postprocessing palette intentionally constrains stellar colors; this is not astrophysical surface simulation, bloom, or a new visual engine.

Validation for this refinement: 53 existing targeted frontend tests plus 9 new visual-generator/framing/disposal tests passed; typecheck, build and diff check passed. Chromium map/orbital/selection captures passed at 1920×1080, 1366×768 and 390×844. The five identity fixtures and the full Galaxy mission/camera/privacy/lifecycle flow passed separately at 1366×768 and 390×844 (plus the existing 390×650 generic layout case). Rendered screenshots were inspected and before/after workspace crops are in `comparison-1366.png` and `comparison-390.png` under the evidence directory. No final scoped layout, JavaScript, WebGL or security findings remained.

In the same class-K two-planet fixture at 1366×768, renderer counters changed from **10 draw calls / 65,082 triangles** to **12 / 66,114** (+1.6% triangles). A sequential 12-callback wall-time smoke completed in approximately 0.2s before and after; because browser time is controlled and rendering uses SwiftShader, these observations do not establish FPS or hardware performance. No full-suite or GPU benchmark was run.

A class-M browser check exposed the default palette's lack of rust/red swatches. The pipeline now optionally accepts an exactly 48-color palette; all existing callers retain the original palette and byte-identical postprocessing shaders. Only the orbital instance substitutes three nonstellar/duplicate swatches with `#633333`, `#b56847`, `#e49a69`. Default-palette/shader regressions and palette-length/disposal checks are covered. Class K, M and O fixtures are available through `STARZ_QA_STELLAR_CLASS` on the visual flow, without changing backend data.

## Galaxy 2.3 — stellar scale, camera director and Celsius

### Presentation sizes

No measured stellar radius is available in the Galaxy contract. The following display radii are explicitly a **class-based presentation heuristic**, not physical dimensions:

| Class | Visual radius | Diameter relative to a typical planet |
|---|---:|---:|
| O | 1.58 | 2.49× |
| B | 1.55 | 2.45× |
| A | 1.50 | 2.37× |
| F | 1.47 | 2.32× |
| G | 1.44 | 2.27× |
| K | 1.42 | 2.24× |
| M | 1.30 | 2.05× |

The typical solid planet radius is `1.28 × .495 = .6336` in this scene; existing planet geometry and display sizes are retained. Unknown class uses radius 1.44 without claiming a known class. `createOrbitalStar` and the optional fifth `OrbitalSystemRenderer` constructor argument support a visual scale multiplier (default 1, bounded .75–1.5, nonfinite input falls back to 1). The star remains at the origin with its approved surface/palette/lighting.

Illustrative orbit radius is now `starRadius + .72 + .5 + slot × 1.85`, where .72 bounds the largest existing atmospheric planet radius. Thus the nearest planetary surface clears the star by at least .5 display units. These radii supersede the 2.2 presentation radii; deterministic phases, angular speeds, authoritative coordinates, physical `orbital_distance`, travel costs and server state are unchanged. The renderer updates illustrative rings and positions together without regenerating geography.

### OrbitalCameraDirector

A small reusable director evaluates 12 azimuths and four elevations against the actual projected star/planet disks, orbit envelope, viewport and label dimensions. It favors body separation, annotation room and a compact, familiar viewing angle. Initial load and Reset fit the complete projected orbital envelope with responsive margins. It chooses camera poses; it never changes planetary phases or moves bodies to stage a screenshot.

Manual drag, zoom and selection retain the existing controls. Selection interpolates camera target/position/zoom over 360ms; reduced motion snaps immediately. Focus retains orbital context and searches zooms .65–1.1 and small target offsets using the **same** `orbitalLabelRect` solver as the HTML labels, so long annotations can fit on short mobile workspaces. Pointer gestures/zoom cancel the transition. Ordinary resource/population updates do not restart focus or reset the camera. Reset cancels transitions/damping residue and restores a full-system frame while preserving the selected planet. Offscreen/crowded unselected labels can still be suppressed; the selector and inspector remain available. Natural overlaps during animation/manual views remain allowed.

### Player-facing temperature boundary

`formatTemperatureKelvin` is the sole formatter for physical planetary temperature. It validates finite nonnegative Kelvin, subtracts 273.15 once, formats integer degrees with the existing pt-BR number formatter and appends `°C`. Valid negative Celsius is retained; near-zero rounding does not show `-0`. Missing/invalid data is “Não informado”. Examples: 299 K → 26 °C; 321 K → 48 °C; 325 K → 52 °C; 250 K → -23 °C.

| Source (stored/API unit) | Player-facing consumer |
|---|---|
| `state.system.planet.temperature` — Kelvin | Overview `PlanetaryStatus`; Planet `PlanetInspector` physical data |
| `/api/galaxy` surveyed `planets[].temperature` — Kelvin | Galaxy planet list and selected-planet inspector |

Units were checked against the existing universe generator, API snapshot pass-through and visual-state contract. Backend/YAML/database values and scientific mappings remain Kelvin. The Planet Lab's relative 0–1 temperature control/diagnostics are not physical measurements and are not converted. Developer raw-descriptor diagnostics retain source units. The master design contract now records Celsius for the player-facing display.

### Scoped validation and evidence

Medium risk: 107 focused frontend tests cover class sizes/configuration, orbital clearance, deterministic framing for 1/2/5 planets across aspect ratios, nonmutation, camera focus/cancel/Reset, short-view label fitting, all Celsius examples/missing/negative values and actual UI boundaries, plus existing navigation/geography/lifecycle regressions. Typecheck/build/diff checks are scoped; no automatic full suite or backend tests are required for these presentation-only changes.

The existing `STARZ_QA_GALAXY_VISUAL_FLOW=1` supports `STARZ_QA_GALAXY_CAMERA_FLOW=1` for initial/selection/Reset captures, paused Reset consistency, default disk separation, reduced-motion behavior and a real smooth transition. Identity fixtures exercise 1/2/multiple planets, occupancy and unknown data at 1366×768 and 390×844. The existing general flow additionally checks camera-state preservation during a stock/population refresh (numeric tolerance 1e-8, avoiding false failures on floating-point roundoff), manual controls and Reset after zoom/rotation. All routes use isolated API fixtures, not player saves.

Actual browser evidence is in `.qa/runs/galaxy-23/`: baseline `ce2a5f9` and updated orbital captures at 1920×1080, 1366×768 and 390×844, including initial, selection and Reset. Overview/Planet route layout checks also cover desktop/mobile for the Celsius rollout. There was no separate third-reference image file attached to this task; composition review used the available baseline captures. This remains a presentation heuristic, not an astronomical camera/size model or a GPU benchmark.

The default director also derives a minimum elevation from the innermost radius: `sin(elevation) × innerRadius >= starRadius + .08`. This keeps the illustrative path's projection outside the stellar disk in the initial/Reset composition, in addition to world-space surface clearance. Manual rotation remains unrestricted within the existing controls.

Final scoped results: all 107 selected frontend tests passed; the affected camera tests were rerun after the minimum-elevation refinement. Typecheck, build and diff checks passed. Chromium initial/selection/Reset and smooth/reduced-motion focus checks passed at all three requested viewports; all five identity fixtures passed at 1366×768 and 390×844. Overview/Planet route checks and mission/lifecycle regressions passed, with no remaining scoped layout, JavaScript or WebGL findings. Full-suite and physical-GPU validation were intentionally not run.

A hidden mobile workspace defers focus until it has real dimensions; controls keep a valid temporary camera pose. The 1366px browser flow additionally closes/reopens the scene with its host initially hidden, then verifies the selected planet and full-system frame when revealed. No renderer is recreated for ordinary camera operations or data refreshes.
