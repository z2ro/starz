# Agent design and QA workflow

This foundation installs four reviewed third-party skills plus STARZ's compact-strategy skill. No gameplay, renderer or screen is redesigned. [AGENTS.md](../../AGENTS.md) routes tasks to specific skills; do not load all five by default.

## Discovery and use

Codex discovers repository-local skill metadata under `.agents/skills/` in a new task/session. The folder's `SKILL.md` name/description explains when it applies; read its body only when relevant, then its linked references as needed. `AGENTS.md` also links exact entrypoints. The custom skill has `agents/openai.yaml` display/prompt metadata with normal implicit invocation. Installation does not retroactively refresh an already-running session's skill catalog.

Example future prompts:

- `Use $starz-compact-strategy-ui to plan a mobile Research review with no routine inspector scrolling. Inspect the current screen first; preserve engine rules.`
- `Use $design-first-ui-prompting and the STARZ design contract to specify a paginated Installations catalog. Do not implement it yet.`
- `Use $workflow-score-to-target to assess these sanitized STARZ captures against the user's stated target. Explain each criterion and retain any hard QA failures.`
- `Use $workflow-progress-screenshots to show before, interaction and result for this authorized UI change. Review every screenshot first; use the local Playwright QA tooling.`
- `Use $test-playable-web-games for an authorized isolated fleet mission playthrough. Staged visual fixtures are not proof of engine progression.`

The separate read-only Codex discovery smoke asks a new task, without naming the custom skill, to locate guidance for a no-scroll mobile research inspector. It must identify the custom path, read the skill and name concrete applicable rules/anti-patterns. No UI changes, live game access or network tools are authorized in that child task. Keep sandbox `read-only` and approval `on-request`; do not change global Codex settings.

The resumed check passed with all five skills in a new task's initial catalog, user configuration ignored, MCP servers empty and apps disabled. See the [sanitized investigation and exact isolation flags](../../.agents/skills/UPSTREAM.md#resumed-discovery--mcp-investigation). The initial loopback MCP event was traced to existing user configuration, not the imported skills.

## Setup / commands

Use the repository's normal backend Python virtualenv (for the pure fixture exporter) and Node ≥22. Playwright 1.65.0 is a pinned **development-only** dependency; current `PLAYWRIGHT_MODULE` / `CHROMIUM_PATH` conventions are supported.

```sh
npm ci --ignore-scripts
# Only if a browser is absent: reviewed local CLI, not a remote shell installer.
npx --no-install playwright install chromium
npm run skills:check
npm run test:design-qa
npm run qa:visual
npm run typecheck
git diff --check
```

For an existing local Chromium: `CHROMIUM_PATH=/path/to/chrome npm run qa:visual`. Set `STARZ_QA_PYTHON` if your backend virtualenv interpreter is elsewhere. Optional image comparison uses the reviewed vendored `compare.py` with Python/Pillow and already-sanitized images. The vendored CDP `capture.mjs` is restricted and must not be executed; see the [security audit](../../.agents/skills/UPSTREAM.md).

## What runs

`test:design-qa` verifies the **checker**, using small neutral browser fixtures at all three sizes: empty/populated finite content, functioning tabs/pagination, and deliberately broken scroll jail, clipping, overlay occlusion, missing assets and decorative controls. Passing these tests does not approve STARZ's current screens.

`qa:visual` tests the **actual built STARZ UI** at 1920×1080, 1366×768 and 390×844. Overview, Installations, Research, Defense, Shipyard and Galaxy each receive empty and populated deterministic states (36 cases). Review data is exported through existing engine/catalog/API serializers, entirely in memory. These are explicitly staged fixtures, not real player empires or gameplay completion tests. Empty means no active work/ships/defenses; the buildable catalogs still exist. Populated includes advanced inventory and actual in-memory construction/research work.

The runner builds into a fresh temporary directory, leaving `frontend/dist` and existing services untouched. Its static-only server binds 127.0.0.1 on an ephemeral port. `.env` loading is disabled, fixture/browser subprocess environments exclude secrets, and temporary browser contexts use pipe transport without debugging TCP ports. Every API response is intercepted; writes, unknown endpoints and external network/WebSocket requests fail the run. No database, login, persistent account or saved-game edits occur.

Checks include document geometry, unwanted scroll surfaces, ancestor clipping, critical-control hit tests/size, inspector content, expanded inspector sections, actual tab/page content transitions, loaded images/fonts/SVG pixel icons and nonzero canvas backing size. Spatial map pan is allowed explicitly. A result never says `VISUAL PASS`: screenshots still need visual inspection for framing, blur, blank graphics and hierarchy.

Outputs: ignored `qa-artifacts/design/results.json` and viewport PNGs. Review captures before sharing. Only synthetic identities appear; do not substitute private player storage/session files or credentials. Every context/server/temp build is closed/removed after the run; existing task services remain running.

## Interpreting results

- Exit 0 / `MEASURED_CHECKS_PASS_VISUAL_REVIEW_PENDING`: measured checks passed; review actual rendered evidence before claiming visual quality.
- Exit 1 / `FAIL`: layout, reachability, behavior, asset or security findings. Read per-view/state/viewport findings, not just the aggregate. A security event stops further cases; investigate before retrying.
- Missing browser/dependency or early setup failure is **NOT RUN**, never an artistic pass.
- A run that stops after some cases is **INCOMPLETE**, never a measured pass.

The current implementation predates the stricter [design contract](design-contract.md): it deliberately has scrollable catalogs/inspectors and a scrolling central workspace. Therefore the strict gate can be red on the unchanged baseline. Keep those findings visible. Do not weaken the test, add blanket waivers, hide scrollbars or redesign screens during this infrastructure task. Future authorized UX work fixes the documented debt and reruns the same gate.

### Integration validation baseline

The isolated production build and typecheck passed. The checker tests passed **9/9**; the offline validator's four mutation/allowlist tests passed. All imported SHA-256 values also matched the already-audited local upstream checkout at the pinned commit, without another download.

Actual STARZ Chromium QA completed **36/36** staged cases and **18** tab/pagination checks, with **zero** page errors, failed navigation checks or security events. The strict layout gate correctly returned **FAIL**: 34 cases had findings, totaling 89 unwanted scroll surfaces, 30 inspector-reachability findings, 12 clipped controls, 3 occluded controls and 2 small primary targets. Expanded-inspector findings can repeat baseline issues; these are observations, not 136 distinct root causes. No UI files were changed.

There are 36 ignored viewport captures. Representative Overview desktop, Research mobile and Shipyard mobile captures were inspected: procedural graphics/pixel identity rendered, while mobile inspectors revealed the documented reachability debt. This is sampled visual inspection, not approval of every screen or gameplay flow. Captures contain staged identities only; review each remaining image before sharing it. No visual acceptance or physical-device/GPU claim is made.

## Attribution / updates

Upstream: [MengTo/Skills](https://github.com/MengTo/Skills), MIT ©2026 Meng To, pinned to `5ea1661a0e05d82b054553daaa6baf6d0233c33c`. [File list, dependencies and checksums](../../.agents/skills/upstream.json), [full review](../../.agents/skills/UPSTREAM.md), [license](../../.agents/skills/MENGTO-LICENSE). The importer excluded all demos, unrelated skills and the unlinked marketing essay. No automatic updater exists.

Manual updates require explicit scope, a new full file review and checksums, reference/dependency checks, relevant tests and code review. A skill never grants permission to deploy, force push, merge, access credentials or modify somebody's data. Baseline npm advisories are recorded in the audit; dependency fixes are a separate task.
