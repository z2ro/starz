# Global master-design rollout

Branch: `experiment/persistent-universe`. The owner approved Overview and authorized adoption across the persistent-universe UI. This is a presentation migration; no gameplay, API, database, model, shader or save changes.

## Delivered

All persistent gameplay routes now render one GameShell, ResourceHUD and SidebarNavigation through PixelShell. The Overview composition is retained. Installations was the first checkpoint; Production, Research, Defenses, Shipyard, Fleets/planning, Galaxy, Colonies, Diplomacy, Market, Records and the existing Planet route follow the same shell and tokens, with their own interaction layouts.

Shared primitives: WorkspaceHeader, PixelPanel, PixelButton, PixelTabs/core Tabs, ResourceIndicator, ContextInspector, StatusIndicator and existing ContentPages pagination. The original Button/Panel/Inspector/Badge APIs delegate to the shared primitives. Resource icons in stocks/costs use the same approved identity map as the HUD.

Removed: the route-dependent PixelShell masthead, resource band/toggle, sidebar implementation and 82 unused legacy CSS selectors. The old nonpersistent compatibility bootstrap remains in AppShell because it is still used outside the persistent game; independent labs and authentication are not given a fabricated empire HUD.

Planet keeps its existing image/procedural renderer, physical data, installation data and operations. Its persistent-mode presentation uses explicit scene/data/operations subviews, rather than imposing the old vertically oversized hero. No procedural graphics were replaced.

## Validation

Medium risk, broad frontend impact. Existing local QA job definitions/execution and existing Playwright filters were used. The CLI's conservative selection would include unrelated uncommitted QA/backend work, so validation explicitly selected the affected frontend groups; no runner/cache redesign or full backend suite was needed.

| Stage | Result | Time |
|---|---|---:|
| Initial shell/unit and typecheck | Both groups passed | 7.171 s |
| Overview + Installations visual checkpoint | 24 empty/populated/interaction cases passed | 95.208 s |
| Affected frontend | 286 Vitest tests, 11 asset checks, 4 skill tests, typecheck/build/diff passed (304 total) | 19.259 s |
| All workspaces visual scan | One reduced-height Planet operations defect found; shared shell geometry matched throughout | 171.051 s |
| Targeted CSS correction/build | Typecheck/build/diff passed | 7.400 s |
| Targeted visual rerun | 16 Planet/Shipyard/Fleets/Galaxy cases passed | 47.555 s |

The initial scan's failure is retained in its original report. The fixes address operations bottom-alignment overflowing the short Planet workspace and a title accent painting over a shrink-to-fit Shipyard heading. No assertion was waived. Successful unaffected cases were retained; corrected cases were replaced with their fresh targeted evidence.

Final relevant coverage: **56/56 scenarios across 14 workspaces**, at 1920×1080, 1366×768, 390×844 and additional 390×650. No remaining measured findings, interaction errors or shared-shell geometry mismatches in this scope. The checker now detects duplicate shells, HUDs, sidebars and legacy mastheads. UI tests cover the shared shell across 15 route/query combinations.

## Evidence

- Frontend: `.qa/runs/2026-11-07T14-55-45-962Z-rollout-frontend/summary.json`
- Initial browser scan: `.qa/runs/2026-11-07T14-59-36-875Z-global-rollout/summary.json`
- Fresh corrected cases: `.qa/runs/2026-11-07T15-08-05-647Z-rollout-targeted-fixes/summary.json`
- [Final screenshot index](../../../.qa/runs/2026-11-07T14-59-36-875Z-global-rollout/review/index.md)
- Final case provenance: `.qa/runs/2026-11-07T14-59-36-875Z-global-rollout/review/results.json`

These are Chromium headless captures of isolated engine-generated fixtures, not physical-device tests or production accounts. Paid actions/real multiplayer mutations were not performed. Existing services, PostgreSQL data and unrelated local work were preserved. The pre-existing Escape focus-restoration issue remains a separate accessibility follow-up; this rollout preserves the dialog behavior rather than silently changing it.

No release, merge or deployment was performed. The [master design contract](../starz-master-design-system.md) is the permanent visual baseline for future persistent gameplay pages.
