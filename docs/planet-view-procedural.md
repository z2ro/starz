# Planet View — Procedural Integration 01

Open `/#/planet`. IMAGE remains the initial mode. The native IMAGE / PROCEDURAL
buttons remember the choice in `localStorage` (`starz.planet.visual-mode.v1`).
Blocked storage does not prevent switching. No backend setting or API was added.

## Integration

`PlanetHero` passes the existing AppShell State/Catalog to `PlanetProceduralView`.
The view derives the approved `SpaceSceneDescriptor` and loads the existing
`LiveSceneRenderer` only when requested. There is no additional query, polling,
scene implementation, generator, shader, model or runtime artwork.

The renderer accepts optional hero insets measured from the real header and
operations deck. Only the orthographic projection changes; scene lighting,
pixel palette, surface generation and materials remain the approved live pipeline.
The isolated live route keeps its original projection when insets are absent.
The existing inspector, operations, homeworld badge, navigation and markers remain.
Long physical values wrap instead of colliding with labels. Planet-specific mobile
CSS fixes the legacy minimum width/HUD overflow and stacks the inspector below
the hero. Vertical scrolling exposes all operations and inspector controls.

## Snapshot and lifecycle guarantees

AppShell retains the last complete pair while another selected planet loads,
keeping the same component/canvas mounted. An opaque synchronization/error cover
and `inert` hide and disable the old HUD, hero and inspector. A null descriptor
clears the previous procedural scene before paint. Only a matching active-planet
response removes the cover; retry also preserves the renderer.

Population and fleet updates use the same descriptor consumer. Its existing
geography key (seed, family, generation parameters) avoids regenerating continents
for dynamic changes. Night lights follow local population. Only a proved compatible
local-system ship is represented; its placement remains a presentation default,
not a claimed orbit. Unknown moon/station contracts create no corresponding objects.
GROUNDED / HEURISTIC / DEFAULT / UNKNOWN adapter semantics are unchanged.

Until startup succeeds, IMAGE stays visible. Unsupported WebGL2, invalid generation
data, startup/frame errors or context loss dispose the scene and return to IMAGE
with a status message. The requested preference is retained so the user can retry.
StrictMode cancellation, unmount and mode changes disconnect observers/listeners
and dispose the renderer/resources. Reduced motion pauses visual rotation. The
pre-existing `?planet_visual=3d` debug path and image-error behavior are preserved.

## Validation and review

Commands: `npm run typecheck`, `npm test`, `npm run build`, `git diff --check`.
New tests cover mode persistence, denied storage, failure/retry/context loss,
StrictMode, same-canvas population/fleet/planet changes, deferred snapshots,
API error recovery, existing request counts and overlay-aware framing.
Existing CPU scene tests verify geography reuse and actual resource disposal.
Final suite: 153 Vitest + 11 Node tests passed. The existing real-generator scene
test intermittently exceeded its 5-second timeout during parallel runs; a repeat
of the unmodified `npm test` command passed. No timeout/configuration was changed.

Chromium/SwiftShader QA covers IMAGE and PROCEDURAL at **1920×1080, 1440×900,
1366×768 and 390×844**, reload persistence, no added requests on switching,
unsupported WebGL and real context loss. No horizontal page overflow or uncaught
JavaScript errors. Mobile inspector and operations remain available by scrolling.
Captures and machine-readable reports: `/tmp/starz-planet-procedural-qa/`.
`1920-image.png` / `1920-procedural.png` are the primary approval pair;
each other width has the equivalent pair and `390-inspector.png` shows mobile detail.

Controlled `fixture-*` captures exercise zero population, local fleet, transit,
delayed selection and a second planet through the existing polling hooks. They
are explicitly test data, never inserted into PostgreSQL. The same canvas survives.
Live / Space Scene Lab 02 / Planet Lab / Ship Geometry Lab regression captures
compare the independent routes without modifying their generators or content.

No backend/gameplay changes; Docker is not required for this frontend slice.
Software WebGL is not a physical-GPU performance benchmark. Final artistic approval
remains with the project owner. Existing live limitations still apply: no trusted
time for unattached ship readiness, no persisted orbital positions, and no concrete
moon/station entities or additional approved hull-model mappings.
