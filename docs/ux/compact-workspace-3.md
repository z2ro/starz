# Compact Workspace 3.0 — evidence and decisions

Baseline: `cfd7b8b`, existing staged browser fixtures, no player data. Scope: UI distribution only, no gameplay/database/schema changes. Target: **each view ≥8/10**, no hard accessibility/reachability failures. Independent baseline judge inspected all 36 captures, not source code alone.

## Root causes and priorities

| Root cause | Impact | Correction |
|---|---|---|
| Catch-all workspace + catalog + inspector `overflow:auto` | Scroll jail across every subsystem | Finite content pages measured from available height; no replacement reading scroll surface. |
| Mutation-observed `max-height` and sticky confirmations | Actions cover cost/benefit; content inaccessible | Remove imperative max-height controller and sticky CTAs; cost, duration, restrictions and confirmation grouped in review. |
| 156px installation cards / 112px naval rows | Low density, selected object absent from viewport | Compact roster entries and measured pagination; full details remain in inspector. |
| Repeated introductions and simultaneous administrative sections | Mobile workspace has little decision space | Dedicated population, production, report and transaction subviews; concise local headers. |
| Sidebar taller than 768px | Navigation itself scrolls | Compact desktop groups; mobile sector dialog with touch targets. |
| Long dossiers, reports and operation lists | Hidden actions or enormous expanded details | Finite review/report pages; explicit navigation, preserving selection/drafts. |
| Height 100% plus renderer headers/controls | Visualization crosses its container | Shrinkable flex canvas, fixed control allocation; renderer/geometries unchanged. |

No document overflow was recorded in the original 36-case baseline. The 136 findings were mostly repeated internal scrolling/reachability observations, not 136 independent bugs. Excessive whitespace and oversized framing were confirmed visually, rather than inferred from overflow alone.

## Baseline scorecard

Criteria, each 0–2: hierarchy / space efficiency / pixel consistency / usability and accessibility / functional correctness. 0 fails, 1 partial, 2 meets the criterion in reviewed desktop/mobile states. Target 8 is per view, never an average. Functional scores are limited by fixture-only evidence; no claim of real multiplayer completion.

| View | H | Space | Pixel | UX | Function | Total |
|---|---:|---:|---:|---:|---:|---:|
| Overview | 2 | 0 | 2 | 1 | 1 | 6 |
| Installations | 1 | 0 | 2 | 0 | 1 | 4 |
| Research | 1 | 0 | 2 | 0 | 1 | 4 |
| Defenses | 1 | 0 | 2 | 0 | 1 | 4 |
| Shipyard | 2 | 0 | 2 | 0 | 1 | 5 |
| Galaxy | 1 | 0 | 2 | 0 | 1 | 4 |

Additional views are validated in this task; no invented pre-change numerical score is assigned without a matching baseline capture.

## All 34 original failing scenarios

| View | State | Viewport | Observed categories |
|---|---|---|---|
| installations | empty | 1920×1080 | unwanted-scroll-container |
| research | empty | 1920×1080 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| defense | empty | 1920×1080 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| shipyard | empty | 1920×1080 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| galaxy | empty | 1920×1080 | occluded-critical-control, small-critical-target |
| overview | empty | 1366×768 | unwanted-scroll-container |
| installations | empty | 1366×768 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| research | empty | 1366×768 | inspector-content-unreachable-without-scroll, occluded-critical-control, unwanted-scroll-container |
| defense | empty | 1366×768 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| shipyard | empty | 1366×768 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| galaxy | empty | 1366×768 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| overview | empty | 390×844 | clipped-critical-control, unwanted-scroll-container |
| installations | empty | 390×844 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| research | empty | 390×844 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| defense | empty | 390×844 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| shipyard | empty | 390×844 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| galaxy | empty | 390×844 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| installations | populated | 1920×1080 | unwanted-scroll-container |
| research | populated | 1920×1080 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| defense | populated | 1920×1080 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| shipyard | populated | 1920×1080 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| galaxy | populated | 1920×1080 | occluded-critical-control, small-critical-target |
| overview | populated | 1366×768 | unwanted-scroll-container |
| installations | populated | 1366×768 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| research | populated | 1366×768 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| defense | populated | 1366×768 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| shipyard | populated | 1366×768 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| galaxy | populated | 1366×768 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| overview | populated | 390×844 | clipped-critical-control, unwanted-scroll-container |
| installations | populated | 390×844 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| research | populated | 390×844 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| defense | populated | 390×844 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| shipyard | populated | 390×844 | inspector-content-unreachable-without-scroll, unwanted-scroll-container |
| galaxy | populated | 390×844 | clipped-critical-control, inspector-content-unreachable-without-scroll, unwanted-scroll-container |

Before images and raw measurements: ignored `qa-artifacts/compact-before/`. Later rounds retain the same original fixture identities and viewports. Additional QA data remains explicitly synthetic.

## Workspace distribution

- Overview retains its planet-first composition; mobile switches between the scene and local orders. Resource details and operations open explicit workspaces rather than expanding the masthead or adding a scrolling column.
- Installations use compact paginated choices, a persistent selected title and a grouped upgrade review. Population is a dedicated local subview; mobile keeps a goal selector instead of a horizontally scrolling category bar.
- Production separates stock selection, industrial chains, capacity and detail. Colonies separate roster, imperial summary and recurring orders.
- Research retains the existing spatial tree and connections. Scientific capacity remains available in the detail pages; planning, dependencies, effects and paid review have finite reading pages. No engine research rule changed.
- Defense separates catalog/build, garrison/works, missiles and reports. Full blocking requirements have their own reading space; quantity, actual cost, duration and confirmation remain together.
- Shipyard preserves the actual procedural model/canvas and configuration chain. Review identifies propulsion/fuel, duration, crew and actual cost; secondary specifications and full prerequisites remain reachable.
- Fleets preserve actual inventories, IDs, missions and travel status. Mission planning retains per-class quantities and individual selection in named subviews, with the existing destination/draft preserved.
- Galaxy keeps the existing map and local pan/zoom, with a finite selected-system/planet/mission dossier. No Galaxy 2.0 work or mission-rule changes.
- Diplomacy, market and reports use finite collections; publishing an offer and browsing reserved offers are separate activities. Detailed intelligence/battle records paginate instead of expanding into an unbounded reading panel.

Measured pagination is a presentation primitive, not gameplay: children stay mounted, form state is retained, and resize changes capacity rather than reducing font size. A single oversized decision block is still a defect and must be repartitioned semantically; the browser checker explicitly rejects clipped reading blocks. Spatial map/tree pan is the only automatic scroll waiver.

## Independent visual scorecard after refinement

Read-only reviewer, same rubric and anchors as the baseline, inspecting actual Chromium PNGs. The scores are judgments, not gameplay certification. Each result is at the 8/10 target; none is rounded up. Function retains partial credit because staged UI evidence does not execute a persistent multiplayer session.

| View | Before | Hierarchy | Space | Pixel | UX | Function | After | Principal correction |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Overview | 6 | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Local situation and orders together; short-height fullscreen dossier. |
| Installations | 4 | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Finite roster, selected installation, atomic paid review. |
| Production | — | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Stocks/chains/capacity/detail subviews, mobile installation selector. |
| Research | 4 | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Spatial progression retained; path/effects/launch details paginated. |
| Defenses | 4 | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Selected defense named in review; distinct operational subviews. |
| Shipyard | 5 | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Model retained; configuration and real paid review reachable. |
| Fleets | — | 2 | 1.5 | 2 | 1.5 | 1 | 8 | One operation selector; route, ETA and recall together. |
| Galaxy | 4 | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Existing map; finite system dossier and named destination. |
| Colonies | — | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Finite worlds, labeled population, summary/orders subviews. |
| Diplomacy | — | 2 | 1 | 2 | 2 | 1 | 8 | Intent selection and real confirmation together. |
| Market | — | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Publishing separated from offer browsing; clear exchange review. |
| Reports | — | 2 | 1.5 | 2 | 1.5 | 1 | 8 | Readable fullscreen reports; one uncertainty explanation. |

Final scoring used `compact-release` for Installations/Research/Shipyard/Galaxy/Diplomacy/Market; `compact-acceptance` for Defenses/Reports; `compact-settle` for Overview/Production/Fleets/Colonies. Each view was reviewed empty and populated at 1920×1080 and 390×844. Subsequent measured checks cover additional dimensions; the score does not imply artistic inspection of every PNG or real device.

Remaining visual nits: conservative roster density on mobile, some unused desktop report space, occasional generic “Detalhes” page captions, minor metric alignment and repeated fleet ETA metadata. These are visible limitations at the target, not hidden failures or an assertion of perfection.

## Functional and scope safeguards

- No backend, database schema, YAML gameplay content, authentication, economic rule, combat rule or procedural renderer/model changed.
- Exact existing build/recall/diplomacy payloads remain covered by focused tests. No mutation is issued by the screenshot runner.
- Stable keyed pages keep draft values and selected gameplay entities through resize and live warning/quote updates. Fullscreen reviews invoke the same handlers and show the same controlled values.
- Existing services, database volumes, two local stashes and user temporary files remain untouched. Browser profiles/static output are disposable and bound to loopback.
- QA uses synthetic identities and in-memory engine snapshots. It checks rendered layout and local navigation, not successful resource spending or persistent multiplayer simulation. No physical-device, native toolbar zoom, GPU benchmark or new gameplay claim.


## Reviewed screenshot gallery

Real headless Chromium captures with staged data, never player accounts. Desktop is 1920×1080; phone-sized viewport is 390×844, not a physical-device test. Mobile images deliberately show the task/review subview; the procedural scene remains available on the adjacent tab. Full local matrices, additional sizes and tab captures remain in ignored `qa-artifacts/`.

| View | Desktop | Mobile |
|---|---|---|
| overview | [capture](evidence/compact-workspace-3/overview-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/overview-populated-390x844.png) |
| installations | [capture](evidence/compact-workspace-3/installations-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/installations-populated-390x844.png) |
| production | [capture](evidence/compact-workspace-3/production-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/production-populated-390x844.png) |
| research | [capture](evidence/compact-workspace-3/research-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/research-populated-390x844.png) |
| defense | [capture](evidence/compact-workspace-3/defense-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/defense-populated-390x844.png) |
| shipyard | [capture](evidence/compact-workspace-3/shipyard-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/shipyard-populated-390x844.png) |
| fleets | [capture](evidence/compact-workspace-3/fleets-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/fleets-populated-390x844.png) |
| galaxy | [capture](evidence/compact-workspace-3/galaxy-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/galaxy-populated-390x844.png) |
| colonies | [capture](evidence/compact-workspace-3/colonies-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/colonies-populated-390x844.png) |
| diplomacy | [capture](evidence/compact-workspace-3/diplomacy-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/diplomacy-populated-390x844.png) |
| market | [capture](evidence/compact-workspace-3/market-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/market-populated-390x844.png) |
| reports | [capture](evidence/compact-workspace-3/reports-populated-1920x1080.png) | [capture](evidence/compact-workspace-3/reports-populated-390x844.png) |

Before/after examples use the same viewport and fixture category; the final populated fixture additionally includes a transit fleet and extra empires/colonies/reports for stress coverage. Catalog order/selected hull can differ; these are layout comparisons, not pixel-exact visual regression snapshots.

| Case | Before | After |
|---|---|---|
| Research mobile | [Inspector hidden behind introductions](evidence/compact-workspace-3/before-research-390x844.png) | [Actual research review fits](evidence/compact-workspace-3/research-populated-390x844.png) |
| Shipyard mobile | [Cost and configuration underneath sticky action](evidence/compact-workspace-3/before-shipyard-390x844.png) | [Configuration, cost and build together](evidence/compact-workspace-3/shipyard-populated-390x844.png) |
| Installations desktop | [Oversized scrolling collection and inspector](evidence/compact-workspace-3/before-installations-1920x1080.png) | [Finite choices and complete review](evidence/compact-workspace-3/installations-populated-1920x1080.png) |


## Final validation

- **34/34 original failing scenarios resolved**, matched by view, fixture state and exact viewport against `compact-before/results.json` (baseline 34/36 failed).
- Complete production-build Chromium run: **146/146 scenarios**, **zero findings**, **zero JavaScript page errors**, **zero security events**. **312** tab/pagination/content navigation checks passed; **315** finite reading pages were examined. **169** PNGs include mobile subviews. [Per-case results](evidence/compact-workspace-3/layout-results.csv).
- Canonical 1920×1080, 1440×900, 1366×768, 390×844: empty/populated main views and mission planning. Global loading/error states at all four sizes; mobile menu/resources/help/operations; populated 1093×614 at DPR 1.25 and 390×650 reduced height. Selected inspectors/reviews and expanded disclosures are exercised. All visible tabs are checked; every page of the selected reading workspace is checked, not every possible combination of object/secondary tab.
- `npm run typecheck`: PASS.
- `npm test`: **34 Vitest files / 267 tests PASS**, plus **11 Node asset/planet/icon tests PASS**. Focused additions cover finite pagination, draft retention, live review identity, compact economic selection, exact selected-fleet recall and diplomacy payloads.
- `CHROMIUM_PATH=… npm run test:design-qa`: **11/11 PASS**, including negative controls for closed disclosures, modal top-layer handling and actual clipping. The local Chromium executable must be supplied when Playwright's default browser is absent; no browser download was performed.
- `npm run skills:check`: five skills and pinned checksums valid; **4/4 validator tests PASS**. No upstream scripts executed or skills modified.
- `npm run build` and `git diff --check`: PASS. Existing Vite config-loader and >500 kB bundle warnings remain; no dependency upgrade/code splitting belongs to this layout task.

The raw runner intentionally reports `MEASURED_CHECKS_PASS_VISUAL_REVIEW_PENDING`; measurements do not confer artistic approval. The independent screenshot scorecard above is the separate visual review. All 12 reviewed views meet 8/10, with the listed minor limitations. Browser validation remains fixture-only; it does not certify real multiplayer actions, native toolbar zoom, touch hardware or every accessibility combination. No backend/database or saved-game tests were needed for this UI-only diff.

To reproduce:

```sh
npm run typecheck
npm test
npm run build
npm run skills:check
CHROMIUM_PATH=/path/to/chromium npm run test:design-qa
CHROMIUM_PATH=/path/to/chromium STARZ_QA_OUTPUT=qa-artifacts/compact-review npm run qa:visual
git diff --check
```

## Changed implementation areas

Shared primitives: `ContentPages`, `ViewportWorkspace`, `PixelShell` and compact workspace CSS. Local presentation: `PixelCommand`, `DevelopmentView`, `EconomyView`, `LevelResearch`, `DefenseView`, `ShipyardView`, `FleetsView`, `GalaxyView`, `OverviewView`, `OperationsView`, activity/guide/return summaries and intelligence/battle report details. `HomeworldBadge` adds an opt-in localized label; existing callers retain their default.

Validation: audited local visual runner/checker, in-memory presentation fixtures, focused component tests and existing assertions adapted to explicit dialogs/finite pages. The baseline matrix and independent scorecard live here; reusable lessons are in [the design quality workflow](design-quality-workflow.md). Galaxy remains the existing implementation; Galaxy 2.0 was not started.
