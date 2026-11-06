---
name: starz-compact-strategy-ui
description: Plan, implement or review STARZ gameplay UI as compact fullscreen pixel-art strategy workspaces, using pagination and contextual subviews instead of catalog or inspector scrolling. Use for layout, density, responsive composition and gameplay-action accessibility work.
---

# STARZ compact strategy UI

Read [AGENTS.md](../../../AGENTS.md) and the [design contract](../../../docs/ux/design-contract.md). Start with the relevant existing view, its real state/actions and current rendered screenshots. This skill does not authorize changing gameplay or redesigning unrelated screens.

## Shape the interaction before the CSS

Identify the player's location, decision, essential evidence, primary action and active work. Keep related facts together. Allocate the available viewport to the decision, not repeated resource totals or decorative panels. Retain the existing shell, procedural graphics and industrial pixel language; a list of generic cards is not a strategy interface.

Design a finite visible set: choose a page size that fits at 1920×1080, 1366×768 and 390×844. Overflow is a signal to change the interaction, not shrink the font. Use `minmax(0, 1fr)`, `min-width: 0` and `min-height: 0` for correct sizing, but do not mistake them for information architecture.

- No document scrolling in normal gameplay.
- No routine scrolling inside catalogs, inspectors or a catch-all central workspace. Page the collection; divide details into named tabs/subviews. Keep selection stable or make any new visible selection explicit.
- Keep critical requirements, cost, duration and the confirmation action reachable in the current subview without scrolling. Do not obscure descriptions/inputs with a floating sticky CTA.
- Reserve pan/zoom for spatial maps and trees. A consciously opened long historical record/help document can have one clear reading surface; it is not a waiver for catalogs or routine inspectors.
- On mobile, show one meaningful workspace at a time. Offer an obvious back/tab control and a full-width inspector or dedicated detail view. Retain draft/selection and renderer identity across navigation.
- Preserve labels, visible focus, semantic controls, keyboard navigation and comfortable touch targets. Reuse existing readable text sizes; never pixelate text or compress everything into tiny labels.

## System-specific compositions

| View | Compact interaction |
|---|---|
| Overview | Planet is the subject. One local-resource strip, concise situation and real operations; put secondary physical data in a dossier subview. |
| Installations | Paginated visual installation roster with level/benefit; selected upgrade subview shows requirements, cost/time and action together. Separate population administration instead of placing it below a long catalog. |
| Research | Domain/tier workspace with actual prerequisite connections and local pan/zoom. Inspector tabs separate path, effects and launch/plan review; allow inspecting locked and cross-domain targets. Preserve three active domain programs. |
| Defense | Readiness overview, finite defense selection, and distinct construction, garrison, ammunition and report subviews. A build review includes actionable prerequisites and local capacity without a scrollable dossier. |
| Shipyard | Model selection and a dominant approved procedural ship presentation. Mobile model/presentation/assembly subviews; configuration and paid build confirmation share a compact review. Paginate comparisons rather than shrinking a large table. |
| Galaxy | Exploration map dominates. Pan/zoom locally; selected-system and mission-planning subviews preserve the real destination. Do not turn the universe into a coordinate table. |

## Failure patterns

**Scroll jail:** locking `body` and placing `overflow:auto` on the workspace, catalog and inspector. The document fits, but the player must hunt through competing scroll surfaces. Fix with fewer simultaneous items, explicit pages and semantic detail tabs.

Other failures: clipping with `overflow:hidden`; selecting an offscreen object without a way back; a sticky action masking cost/requirements; desktop columns squeezed into 390px; empty panels occupying a whole column; removing actions to force a fit; generic icons replacing STARZ sprites; treating unavailable data as zero or decorative gameplay.

## Verify and deliver

Use the existing fixture/browser QA in [design QA workflow](../../../docs/ux/design-quality-workflow.md). Test populated and empty states, every visible tab/page, the last item/detail and the primary action by keyboard and touch-sized viewport. Inspect screenshots at native size after fonts/assets/renderers settle. Check clipping and hit targets, not only `scrollHeight`.

Capture baseline and result with matching framing; label staged fixtures and emulated mobile honestly. Follow the installed screenshot skill when visual evidence is needed. Use the scoring skill only when a score/target was requested; numerical scores do not waive hard functional failures. Do not claim visual approval from passing tests.

Existing screens can violate this newer contract. Report that baseline honestly. An infrastructure-only task must not silently redesign them or suppress failing checks. The older [fullscreen workspace document](../../../docs/ux/fullscreen-workspaces.md) describes implementation history; this contract supersedes its allowance for routine inspector/catalog scrolling.
