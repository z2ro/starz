# STARZ Master UI — reference implementation

**Status: approved Overview, adopted for the persistent-universe application.** The owner authorized the global rollout on `experiment/persistent-universe`. The current Overview is the composition reference; the supplied [1672×941 image](references/starz-master-ui.png) remains the original visual source. Other workspaces reuse its shell and primitives while retaining their own content layouts. No further design approval gate is required for this rollout.

The source arrived as `starz-master-ui.png.png`; its original bytes and name were preserved. The canonical `.png` is a byte-identical copy. Neither image is a runtime background or substitute for the renderer.

## Reference audit

| Element | Reference geometry / hierarchy | Implementation decision |
|---|---|---|
| Sidebar | x≈12–259; full-height framed column; logo and civilization above five groups | 248px sidebar, independent full-height grid area; shorter-height adaptation, sector dialog on mobile. |
| Resource HUD | x≈273, bottom y≈110; one compact band, resource icon then name/value; selector and records/help at right | One selected-planet resource band. Six resource identities plus actual energy generation; rates/details remain in explicit disclosure. |
| Navigation | Pixel uppercase categories, readable item labels, inset cyan active frame | Existing destinations and active-state rules; group icons and a framed selected item. No new gameplay route. |
| Main hierarchy | Breadcrumb near y≈143; title near y≈191; hero x≈295,y≈234 | Existing operations dialog becomes the breadcrumb action. Title, accent rule, hero and colony strip form one finite workspace. |
| Hero | Approximately 1352×544; planet left, development right; modes at lower left | Same procedural component/adapter, no generator/camera/shader modifications. Host placement frames the real planet; no screenshot artwork in runtime. |
| Development | Title, five local rows, physical characteristics, four actions | Actual population, energy margin, workforce, construction and shipyard vacancies. Temperature K, gravity g and water percentage retain existing semantics. |
| Colony strip | Thin separators around selector/count and administration link | Actual owned worlds/limit, controlled native selector under the visual label, existing population-management destination. |
| Frames / surfaces | Sharp cut corners, thin layered cyan/blue edges, restrained lighting | Code-native 9-slice SVG frame, discrete button shadows, limited ramps and subtle grid. No glass blur or generated assets. |
| Responsive | Reference is desktop, not a fixed canvas dimension | Two-line HUD on narrower desktop; mobile scene/status subviews, compact context and bottom navigation; short-height status opens explicitly fullscreen. |

The previous Overview was judged against this reference at composition 3/10, typography/spacing 4/10, pixel fidelity 6/10, color/components 4/10, observable usability 6.5/10. These are independent visual judgments, not engine test scores. Different planets, ship designs, names and numeric values are not reference discrepancies.

## Central tokens

Source: `frontend/src/pixel-command/master/master-tokens.css`. Colors are bounded implementation ramps interpreted from the supplied raster, not a claim that every texture pixel has one exact token.

| Role | Token / value |
|---|---|
| Space / panel | `--master-space: #04101c`, `--master-surface: #081a27` |
| Raised / hover | `--master-raised: #17394b`, `--master-hover: #205263` |
| Text / secondary | `--master-text: #f1f1df`, `--master-muted: #b5ccd2` |
| Cyan / priority | `--master-cyan: #83e5e5`, `--master-amber: #ffc465` |
| Frame / divider / shadow | `#6497a8`, `#305363`, `#020912` |
| Typography | Existing local Silkscreen for short headings/logo; system text/tabular numbers for reading/data |
| Geometry | 4px spacing unit, 248px reference sidebar, 104px HUD allocation, 44px primary/touch targets |

Shared styling is centralized in `master-ui.css`, scoped to `.master-ui`. No page-specific palette is introduced. Small border highlights and resource ramps are local to that shared component stylesheet. Pixel art uses integer-grid filled SVG shapes, nearest-neighbor asset scaling and the unmodified ordered-dither Three.js presentation pipeline; text is never pixelated with a filter.

## Components and data contracts

| Component | Responsibility |
|---|---|
| `GameShell` | One reference grid for every persistent-universe workspace; no route-specific enable flag or fallback masthead. |
| `ResourceHUD` / `ResourceIndicator` | Real selected-planet stocks in stable reference order; distinct chip, ore, ingots, gas, fusion, ion and energy icons. No capacity gauges inferred. |
| `SidebarNavigation` | Civilization identity, existing navigation groups, current page, persistent-universe context and existing logout handler. |
| `WorkspaceHeader` | Heading, pixel emblem and technical accent rule. |
| `PixelPanel` | Shared scalable frame, no gameplay behavior. |
| `PixelButton` / `PixelAction` | Native accessible button or router link, primary/secondary/selected/disabled/focus states. |
| `PixelTabs` | Existing keyboard-accessible Tabs primitive with shared presentation; preserves selection semantics. |
| `ContextInspector` / `PlanetaryStatus` | Contextual local facts, real warnings, physical data and existing action routes. |
| `GameStatusBar` | Actual colony count/limit and selection; population management and retained contextual recommendations. |

The existing AppShell owns API queries, authentication, snapshot readiness and selected planet. No new endpoint, polling loop, state store or gameplay inference was added. Moon/station/ship presence remains governed by the existing visual adapter. IMAGE fallback, operations, records, help and recommendation preference continue to work.

## Validation policy

Follow the [risk-based local QA policy](../development/local-qa.md). Shared-shell rollout is medium risk with broad frontend impact: validate the affected UI/functional tests and actual rendered routes at 1920×1080, 1366×768 and 390×844. Start by comparing Overview and Installations. Isolated follow-up fixes use narrower cases; do not run all validation modes in sequence. A full backend/release suite is not required for presentation-only work.

Preserve the reference Overview's layout and renderer. Review actual captures for framing, legibility, clipping and shared shell geometry; passing overflow checks is insufficient. Use isolated fixtures, never private accounts or screenshot credentials. Historical numerical review scores below record the original approval exercise, not a requirement to rescore every future edit.

The optional master flow uses controlled in-memory API snapshots and real rendered UI: dialogs, keyboard mode changes, stock/population refresh with stable canvas/geography, both planet selectors and contextual destinations. It never sends paid actions, logs out a real account or edits a database. This is UI integration evidence, not a persistent multiplayer campaign test.

Every persistent gameplay view uses these shared primitives. Keep the implementation linked from AGENTS.md and the STARZ UI skill; changes to the visual direction require explicit owner authorization.

## Historical Phase 8 evidence

**Historical candidate record:** the owner has since approved Overview and authorized rollout. The following evidence describes the original reference review, before global adoption.

Reference SHA-256: `4a102ac39951662921f88954faa89589a474fa49746b05ec76d0bbb0bf3a2aef`. The source and canonical copy are identical; no source art was cropped, repainted or promoted to runtime.

| Category, individually /10 | Original baseline | First candidate | Refined candidate |
|---|---:|---:|---:|
| Layout composition | 3 | 7.5 | **8** |
| Typography and spacing | 4 | 7 | **8** |
| Pixel-art fidelity | 6 | 8 | **8** |
| Color and component consistency | 4 | 7.5 | **8** |
| Functional usability observed | 6.5 | 7 | **8.5** |

Independent read-only reviewers inspected actual PNGs against the supplied reference. Scores are judgments, not exact image-diff claims; they were not rounded up. The final mobile footer abbreviates the unit to “hab.” while retaining the full accessible text, addressing the remaining three-line caption. No category is replaced by a numerical average.

### Screenshots

All captures below are actual Chromium renders with synthetic/in-memory engine snapshots, not private accounts or hand-painted mockups. Desktop comparisons retain native dimensions; the side-by-side adds only a caption strip, without changing either image's pixels. Mobile is a browser viewport, not a physical-device certification.

- [Reference vs implementation, 1672×941 each](master-ui-review/reference-vs-actual-1672x941.png).
- [Implementation, 1672×941](master-ui-review/actual-1672x941.png), [empty/initial activity state](master-ui-review/empty-1672x941.png).
- [1920×1080](master-ui-review/actual-1920x1080.png), [1366×768](master-ui-review/actual-1366x768.png).
- [390×844 planet subview](master-ui-review/mobile-planet.png), [390×844 situation/actions](master-ui-review/mobile-status.png).
- [Sanitized validation summary](master-ui-review/validation.json). Full local captures/results: ignored `qa-artifacts/master-approval/`.

### Technical and interaction results

- `typecheck`: PASS.
- `npm test`: **35 files / 271 Vitest tests**, plus **11 Node asset/planet/icon tests**, all PASS.
- `test:design-qa` with the installed Chromium path: **12/12 PASS**, including the new `display:contents` negative/positive clipping test.
- `build` and `git diff --check`: PASS. Existing Vite config-loader/chunk-size warnings remain.
- Overview browser matrix: **12/12 cases, zero layout findings, page errors or security events**, covering empty/populated 1672×941, 1920×1080, 1440×900, 1366×768, 390×844 plus populated 1093×614/DPR1.25 and 390×650.
- Two real rendered **UI flows**, desktop/reference and phone-sized, PASS: resource/records/help/operations dialogs and Escape, keyboard IMAGE mode, procedural restoration, polling-driven stock/population refresh retaining the canvas and geographic identity, header/footer planet selection and four contextual destinations. The destination views retain their prior shell. No API write is permitted by this runner.
- No backend, gameplay content, schema, procedural generator, shader, ship model or simulation formula changed. Existing data volumes and saves were not reset.

### Local owner review

A separate production-build preview is available at **http://localhost:8040/static/#/universe**, bound to loopback. Its `/api` and `/health` proxy to the pre-existing local `8033` application. The two existing stopped `8033` containers were started without rebuilding their image or recreating volumes. Other STARZ environments were not started or changed. Frontend/root and proxied health checks return 200.

The preview uses the normal authoritative API and authentication when the owner signs in. Browser automation above used only isolated fixtures; it did not log in or issue actions against the saved universe. The service at `8033` retains its previously applied interface. The review server is a local process, not a deployment or a new gameplay route.

### Remaining differences and limits

The renderer's near-black background has less visible grid/starfield than the supplied image. Existing Silkscreen and code-native frames approximate the reference's typography/lighting details; no exact font-source or pixel-perfect-match claim is made. The larger desktop centers a bounded status block rather than stretching every row. Real geography, local ship presence and numeric state deliberately differ from the reference.

Native-device touch, every browser/zoom setting and real multiplayer mutations were not re-certified by this UI-only change. Existing mechanisms remain intact, but staged UI flows do not prove engine or save correctness. Final artistic approval belongs to the STARZ owner.

**Stop here:** approve or request changes to Overview before migrating Installations, Production, Research, Defenses, Shipyard, Fleets, Galaxy, Colonies, Diplomacy, Market or Records. Permanent global design-contract adoption is the subsequent authorized phase, not an automatic consequence of passing these checks.


The desktop HUD now wraps from its measured content budget (`flex-basis: 975px` for the resource group), and the shell's header track sizes automatically. It does not choose a bespoke layout for each screenshot resolution. Breakpoints remain for meaningful composition changes (narrower navigation/typography and mobile subviews). The final desktop interaction flow also resizes through **1501, 1550, 1630 and 1640px**, asserting readable resource names and no layout findings; this caught and corrected an intermediate-width failure absent from the canonical screenshots.

## Shared application architecture

`AppShell` retains authentication, API snapshots, selected planet, mutations and feedback. Its persistent-universe branch renders one `PixelShell`, which always uses `GameShell`, `ResourceHUD` and `SidebarNavigation`. There is no per-route shell switch and only one local-resource band. `WorkspaceHeader`, `PixelPanel`, `PixelButton`, `PixelTabs`/`Tabs`, `ContextInspector`, `StatusIndicator` and `ContentPages` provide common presentation without replacing page-specific state/actions. Existing UI Button/Panel/Inspector/Badge APIs delegate to these primitives.

`master-tokens.css` owns the palette and typography roles; `master-ui.css` preserves the approved shell/Overview; `master-workspaces.css` applies the same components to system workspaces. `resourcePixelIcons` is the single pixel resource-identity map used by HUD, costs and resource inspectors. Do not add a second HUD, sidebar, page palette or graphics pipeline.

| Persistent route | Workspace retained |
|---|---|
| `/universe` | Approved planet Overview and colony strip |
| `/development` | Installations, upgrade review and population administration |
| `/economy` | Stocks, industrial flow, capacity and resource details |
| `/research` | Three-domain technology progression and planning |
| `/defenses` | Planetary readiness, construction, garrison and reports |
| `/shipyard` | Model selection, procedural preview and real assembly |
| `/fleets` | Fleet inventory, inspection and mission planner (`?plan=1`) |
| `/galaxy` | Spatial exploration, selected systems and mission destinations |
| `/overview` | Colonies and empire information |
| `/relations` | Diplomacy, market (`?tab=market`) and records (`?tab=reports`) |
| `/planet` | Existing image/procedural renderer, physical data and operations in finite subviews |
| `/missions` | Existing planner alias; destination/draft query parameters preserved |
| `/campaign` | Existing scenario route/fallback; no new campaign mechanics |

The independent lab routes (`/planet-lab`, `/ship-geometry-lab`, `/space-scene-lab`, `/space-scene-live`) remain outside AppShell. Authentication/loading/error screens have no invented empire data. The old nonpersistent compatibility branch still uses its own bootstrap; it is not a second shell within the persistent universe, and its used components are retained.

Planet data and operations use the existing pagination/inspectors; planet/ship geometry, generators, shaders, APIs and economic/combat rules are unchanged. Mobile retains contextual area tabs and the sector dialog with 44px touch targets. A shared presentation edit must not erase research/map states or hide primary paid-action reviews.

## Global rollout evidence

See the [rollout report](master-ui-review/rollout.md) for migrated workspaces, component reuse, removed legacy branches, responsive screenshots, targeted validation and remaining scope limitations.
