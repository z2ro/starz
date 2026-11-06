# STARZ design contract

Scope: normal persistent-universe gameplay. This is a design/acceptance contract, not permission to change mechanics, save data or approved graphics. The owner retains artistic approval.

## Evidence and precedence

The approved [pixel direction](pixel-direction.md), [pixel expansion](pixel-expansion.md) and [strategy experience](strategy-experience.md) establish the visual identity. Actual tokens/components live in `frontend/src/pixel-command/`. The [fullscreen workspace record](fullscreen-workspaces.md) describes the current implementation, including internal scrolling. **The newer requirement below supersedes its permission for routine catalog/inspector/workspace scrolling.** Existing violations are design debt, not retroactive proof of acceptance. This infrastructure change does not fix them.

## Pixel identity / Industrial Frontier palette

“Industrial Frontier” here names STARZ's existing industrial pixel-art direction, not a new color scheme.

| Role | Approved value / source |
|---|---|
| Space / graphite | `#080f1c` / `#172331` |
| Surface / shadow | `#203346` / `#030914` |
| Text / interaction | ivory `#eee9d5` / cyan `#86d4d5` |
| Priority / healthy | amber `#edb969` / green `#a5c5a0` |

Use restrained violet only where the existing research states already use it. Reuse Silkscreen for short titles/labels, readable system text/tabular numbers for data (existing 13–14px body scale; secondary labels 12px or larger). Do not apply image pixelation to fonts. Preserve filled 16×16-grid icons, orthogonal frames, square controls, existing segmented progress and visible focus. Approved 44px primary/touch targets remain the reference. Color never carries status alone.

Reuse existing procedural planets/ships and the Three.js low-resolution pixel pipeline. Asset loading, proportion, silhouette and framing matter more than decoration. No arbitrary art replacement, smooth line-icon library, gradients, generic SaaS card wall or new graphics engine.

## Density and hierarchy

The player should recognize location, local production, real activity, the decision and its consequence. Group related data with the selected planet/model/technology. Show current resources once in the shell; distinguish nominal from effective rates. Use short labels, real states and progressive detail. Empty states should offer a relevant next action without reserving a huge empty panel. Never fill space with invented metrics or gameplay.

Desktop: persistent empire/planet/resources context, navigation, system-specific workspace and a finite contextual detail/review area. A shipyard is not a copy of Overview; research and galaxy prioritize their actual graphs/maps.

Mobile: one meaningful workspace/subview at a time, compact global context, sector navigation, explicit detail/back navigation and reachable confirmation. Preserve selection, drafts and canvas/renderer identity. Do not squeeze desktop columns or remove essential information.

## Single-screen rules

1. No document scrolling horizontally or vertically in normal gameplay, including expanded/error/populated states.
2. No routine scrolling in catalogs, inspectors or a catch-all central workspace. Use fitting page sizes, tabs, search/filters, comparison pages and dedicated detail/review subviews.
3. No scroll jail: locking `body` while nesting scrollable workspace → catalog → inspector is a failure, even when document dimensions pass.
4. No clipping: essential cost, requirements, duration and action must be visible together in their active review subview. A sticky action cannot cover evidence or inputs.
5. Spatial maps/trees may pan/zoom locally. A deliberately opened long help/historical record can have one reading surface. Neither exception permits a normal upgrade/build inspector to scroll.
6. Use responsive Grid/Flex and `minmax(0,1fr)` with shrinkable children. Change information architecture before reducing text or hard-coding monitor-specific heights.
7. Keep keyboard focus visible; tabs/pagination must change the actual content. Respect touch, reduced motion and browser zoom. Do not discard draft or selected entity when switching subviews.

## Acceptance and visual review

At **1920×1080, 1366×768 and 390×844**, for representative empty and populated states:

- Document fits; no unwanted internal scroll containers.
- Selected inspector's essential contents are reachable **without scrolling**.
- Primary controls are present, in bounds, unobscured, readable and genuinely actionable/clearly blocked.
- Actual tabs/pages navigate content, retain context and expose the last item/detail.
- Fonts, pixel sprites and renderer surfaces load; no broken images or zero-sized canvases. Inspect actual captures for blurred sprites, blank scenes, bad framing, clipped text and visual hierarchy.
- Authentication/ownership/engine actions remain authoritative. Staged visual fixtures are labeled and cannot count as a real gameplay smoke test.

Measure geometry and hit targets, exercise interactions, then inspect screenshots at native size. Capture baseline/key interaction/result with the same state/camera/framing for visual changes. A green build, zero `scrollHeight` excess or a numerical score alone cannot certify quality. Report missing browser/device coverage and pre-existing failures honestly; never silently waive the new contract.

Run/review instructions: [design quality workflow](design-quality-workflow.md). Task-specific guidance: [compact strategy skill](../../.agents/skills/starz-compact-strategy-ui/SKILL.md).
