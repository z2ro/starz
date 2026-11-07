# Local QA

A local, Codex-independent runner coordinates the existing TypeScript, Vitest, Node, Python unittest, Alembic/PostgreSQL and Playwright checks. No cloud CI, new test dependency or gameplay change is involved. Existing individual commands remain available for diagnosis; agents use this runner.

## Default policy: classify risk first

Every task must state its risk and select the smallest validation scope that gives sufficient confidence. Classify by actual changed behavior and blast radius, not task frequency, file count or whether a skill contains a large checklist. Documentation-only policy edits are low risk; changing executable QA selection, caching or failure handling is high risk.

| Risk | Typical change | Required validation | Preferred time |
|---|---|---|---|
| Low | Isolated CSS, icons, spacing, text or documentation | Relevant targeted checks; `quick` when necessary; no automatic `full` | Under 30 seconds |
| Medium | Shared React components, navigation, forms, multi-page interactions | `affected`, including related functional/layout checks; reuse valid results | Under two minutes |
| High | Backend architecture, database/schema, shared gameplay, authentication, large refactors, executable test infrastructure | Relevant checks during implementation; `full` before delivery when impact, uncertainty or an applicable quality gate requires it | Based on necessary scope |
| Release | Release/deployment candidate | Comprehensive `full` validation | Full scope |

Examples: a mobile-menu padding fix validates its affected viewports and hit targets; a navigation change includes route/state behavior and related layouts; an authentication change covers ownership/session isolation and the required broader regression gate. Release validation does not authorize a merge or deployment.

### Execution rules

- Choose a mode or targeted check. **Do not run `quick`, `affected`, and `full` sequentially by default.** A delivery is not automatically a release.
- Use the existing local runner and dependency map. If it cannot express a justified narrow scope, use an existing tool's supported targeted filter, retain logs and report the exception. Do not redesign the runner for a one-off correction.
- Existing wrapper modes can broaden selection when dependencies are unknown or unrelated uncommitted infrastructure is present. That behavior is not automatic risk classification. Account for the task's real scope before launching; document the targeted fallback rather than triggering a full visual matrix for isolated CSS.
- Expand only when impact is broad/uncertain or evidence calls for it. Investigate a failing targeted check before expanding; rerunning a larger suite is not a diagnosis.
- Reuse successful results only while their relevant inputs remain valid. Do not rerun passing tests without relevant changes, clear caches routinely or repeatedly audit QA infrastructure during normal work.
- Run independent checks in parallel when safe, within the existing concurrency limits. Preserve the test inventory, coverage and mandatory quality gates; never hide, disable or omit a required check to meet a time target.
- The preferred times are efficiency targets, not hard budgets or reasons to terminate necessary validation. Existing stall timeouts still apply.
- Store complete logs locally. Keep normal successful output to a brief status/log pointer; show relevant failures/errors and retain nonzero failure exits. Read detailed logs only when necessary.
- Review actual rendered evidence for the affected visual behavior. A targeted green result is not proof that unrelated screens or a full release passed.

### Existing targeted entrypoints

The wrapper currently exposes `quick`, `affected` and `full`, not arbitrary group/scenario flags. Use existing tools when a narrower scope is justified; do not invent runner options.

For example, the existing Playwright filter below selects the two mobile-menu scenarios (390×844 and 390×650), not the full matrix:

```sh
STARZ_QA_CASE=menu-populated-390 STARZ_QA_OUTPUT=.qa/runs/mobile-review/visual node scripts/visual-qa.cjs
```

Use an installed Chromium through `CHROMIUM_PATH` if Playwright's default executable is absent. Retain the repository's sanitized subprocess environments, isolated fixtures/accounts and local-only services. Static instruction/skill edits need metadata/reference/checksum validation and a diff check, not a browser run or application build. The runner's exported job definitions also permit local orchestration of just the existing `skills`/`diff` groups; no new test framework is needed.

## Commands

```sh
npm run qa:quick
npm run qa:affected
npm run qa:full
# Equivalent without npm's command banner:
node scripts/qa.cjs quick
node scripts/qa.cjs affected --base HEAD
node scripts/qa.cjs full --verbose
```

`quick` runs applicable code, content and infrastructure checks but excludes PostgreSQL, production build and browser validation. It does not replace a required targeted browser/database check. `affected` includes the integrations/build/browser checks required by changed modules; `full` selects every group. Select among them using the risk policy above. Low-risk delivery does not require `full`; high-risk changes use it when required, and release candidates always require it.

Options: `--base <commit/ref>` selects the Git comparison base, `--jobs 1..4` bounds simultaneous groups (default 2), `--no-cache` forces execution, `--verbose` streams complete sanitized child output. A second concurrent runner exits with an error rather than racing cache files, builds or databases. A stale lock is reclaimed only when its owning process no longer exists.

Install the project's existing prerequisites as described in README: Node 22+, `npm ci`, Python 3.12+ with `.venv/bin/python` and the locked Python dependencies/test extra. Browser checks need the existing Playwright Chromium installation; `CHROMIUM_PATH` can select a local executable. The runner never downloads browsers or packages. Database checks require Docker and an already available `postgres:17-alpine` image; it never pulls automatically. Missing required prerequisites fail validation instead of silently skipping it.

## Selection and dependency map

Git selection combines tracked changes (staged and unstaged, including deletions) with non-ignored untracked files. `affected` normally compares against the HEAD of the last successful affected/full validation; the first run uses the complete suite unless an explicit `--base` is supplied. Selection and cache validity are separate: an uncommitted file remains affected, but its successful unchanged tests can be reused.

`scripts/local-qa/dependencies.json` holds the explicit module-to-test/view map. `scripts/local-qa/selection.cjs` provides conservative rules:

| Change | Validation |
|---|---|
| Mapped Production, Galaxy, Research or Defense view | Listed frontend suites and browser views, typecheck, asset checks, content validation and build |
| Shared UI/API/types/assets, unknown frontend file | All frontend suites, assets, content, build and full browser matrix |
| Python engine, migrations or content | All groups, including disposable PostgreSQL |
| Runner, package/configuration, test infrastructure or uncertain dependency | All groups |
| A frontend test alone | That suite plus frontend build/integration checks |
| Agent instructions/skills/documentation | Skill metadata, checksums and reference tests; approved reference image changes additionally invalidate frontend validation |

Unknown dependencies broaden selection. A changed dependency-map rule must update the selection tests. Current scratch/output directories (`tmp/`, `.qa/`, `qa-artifacts/`, installed dependency trees and `frontend/dist/`) do not count as product changes. Installed dependency contents still enter cache fingerprints. `.env` files are neither read nor logged; QA uses isolated fixtures and explicitly constructed environments. Ignored temporary files are preserved.

## Groups and execution

| Group | Tool / coverage |
|---|---|
| runner | Node tests for selection, fingerprints, cache, scheduling, timeout, failure and reporting |
| typecheck | Existing TypeScript compiler, once |
| frontend | Existing Vitest suites, at most 4 workers, 15-second per-test limit for CPU procedural generation |
| assets | Existing four Node asset/registry/icon scripts |
| backend-unit | Existing Python unittest discovery, non-database cases |
| backend-db | Existing PostgreSQL tests and migrations, isolated temporary database |
| content | Existing Catalog validation for base, campaign and persistent overlays |
| skills | Existing offline skill trust-boundary tests, including manifest checksums and local references |
| browser-check | Existing Playwright layout-checker unit tests |
| build | Existing Vite config, after typecheck, without compiling TypeScript again |
| visual | Existing fixture-based Playwright runner against the same production build |
| diff | `git diff --check HEAD`, always executed |

Independent groups use a bounded scheduler. Renderer-heavy Vitest/Playwright groups run serially to avoid competing for rendering resources. Required dependency failures block dependent checks; independent checks still finish. Most commands have a 120-second timeout; PostgreSQL has 240 seconds and the full browser matrix 900 seconds. Timed-out process groups are terminated and required failures produce exit 1; configuration/setup errors exit 2 and interruption exits 130.

PostgreSQL uses a uniquely labelled temporary container, random test-only credentials, a loopback ephemeral port and tmpfs storage. Only that exact labelled container is removed. No existing database URLs, Compose projects, saves or volumes are used. Backend unittest classes are partitioned so unit tests are not rerun in the database group. Newly detected SQL-backed classes are conservatively assigned to integration validation.

The fixture browser server binds only loopback. Playwright uses temporary contexts and its local pipe, never a publicly exposed debugging port. Existing request guards block external traffic and API mutations. No live account is needed. Browser evidence is staged fixture evidence, not proof of live multiplayer behavior.

## Cache and logs

Successful results are stored under `.qa/cache/`, keyed by SHA-256 fingerprints of source paths and bytes, relevant tests/configuration, runner/dependency-map content, command/selection, installed dependency contents, runtime versions and browser/container-image identity as applicable. File additions, deletions and same-length edits change fingerprints. Shared/core changes invalidate the appropriate broader groups. Failed checks are never reused as successes. A complete failed browser matrix may retain only its successful individual cases: their report, screenshots and original full log must all match the same relevant fingerprint; failed cases always execute again. Incomplete runs or security events cannot supply reusable cases.

Unresolved/external dependency symlinks disable cache reuse rather than guessing their contents. Cache reuse also requires the original full log and matching retained artifact contents. Missing or changed reports/build/screenshots invalidate the result. Inputs and runtime dependencies are checked again after the run; mid-run changes invalidate success. Use `--no-cache` for an explicit fresh measurement or after an external condition not represented by project inputs changes. `full` selects full coverage; it intentionally reuses still-valid successes rather than rerunning unchanged tests.

Every invocation writes `.qa/runs/<timestamp>-<pid>/summary.json`. Executed groups have full `.log` files and structured reports where supported. The build and Playwright captures stay under the same ignored run directory; `frontend/dist` and running previews are untouched. Cached groups point to their original logs/artifacts in the summary. Deleting `.qa` loses only validation results and forces revalidation; no automatic retention cleanup deletes evidence.

Default output is four summary lines: mode, totals/cache hits, log directory with elapsed time, and exit status. Failures add group/test names, a short message and log location. Read full logs only for failures or explicit debugging. `--verbose` is the debugging escape hatch.

A green browser measurement is not artistic approval. Keep the existing screenshot review and approval gate for visual changes. This infrastructure task does not redesign screens or suppress baseline defects.

## Historical pipeline validation and measurements

Measured locally on the existing development machine. No hardware-performance claim is implied.

| Measurement | Elapsed | Console output | Result |
|---|---:|---:|---|
| Original `typecheck` + `npm test` + `npm run build` | 29.850 s | 167 lines / 6,695 bytes | Frontend scope only; TypeScript ran twice |
| New frontend groups in final cold run | typecheck 9.676 s; Vitest 20.222 s; assets 0.375 s; Vite 0.681 s | Stored in logs/reports | Passed; parallel group times are not additive wall time |
| Final `full`, cold cache | 443.790 s | 8 summary/failure lines | 594 tests + 6 checks passed, 2 browser scenarios failed; exit 1 |
| Same `full`, warm cache | 9.686 s (9.725 s process) | 8 lines / 320 bytes | 10 groups and 172 browser cases reused; only 2 browser cases rerun, still exit 1 |
| Warm `quick` | 1.270 s (1.307 s process) | 4 lines / 160 bytes | 378 tests + 5 checks validated, 7/8 groups reused; diff fresh; exit 0 |

The cold full run adds 83 Python unit tests, 32 actual PostgreSQL tests, skill/checker/runner tests and 174 browser scenarios; it is **not** the same workload as the old 29.85-second frontend sequence. It spends 139.423 s on isolated DB integration and 414.992 s on the browser matrix, in parallel where safe. A single compilation and production build are shared with Playwright. The cold/warm `full` rows cover the same inputs and complete selection.

Evidence: `.qa/runs/baseline/results.json`, `.qa/runs/2026-11-07T13-49-54-463Z-156432/summary.json`, `.qa/runs/2026-11-07T13-57-27-525Z-176924/summary.json`, and `.qa/runs/final-cache-proof/`. The warm full summary records `cachedCases: 172` and `executedCases: 2`. The normal failure output lists two failed scenarios and their log without dumping the individual findings. Full captures, original evidence locations and findings remain in each run's `visual/` directory.

Historical baseline: `menu/populated/390x844` and `menu/populated/390x650` failed on 40px links; the original full run validated 174 scenarios with 172 passing. The subsequent 44px correction passed both targeted scenarios in 8.568 seconds, with zero findings/errors/security events: `.qa/runs/2026-11-07T14-30-23-787Z-mobile-targets/`. This is targeted evidence, not a later full-suite pass. Failed checks must still return nonzero; a cached green result must never be manufactured for a failed scenario.

A simultaneous second runner was rejected with exit 2 (`.qa/runs/lock-proof/`); no second test process or database started. One intermediate full repetition was interrupted with exit 130 to add per-case reuse instead of unnecessarily replaying successful browser cases. Its incomplete evidence cannot supply cache entries.

Example successful development output:

```text
QA quick
Passed: 378 tests + 5 checks; failed groups: 0; failed tests: 0; skipped: 0; cache: 7/8
Logs: .qa/runs/<timestamp>-<pid> (1.27s)
Exit: 0
```

The focused runner tests also cover artifact tampering, successful-only visual reuse, incomplete/external report rejection and screenshot path validation. They cover staged/unstaged/deleted/untracked Git changes, same-length source edits, dependency/test changes, failed-result rejection, missing-log invalidation, bounded scheduling, renderer serialization, dependency blocking, timeout/redaction and missing reports. The initial real `quick` execution returned exit 1 for import-discovery and CPU timeout failures, demonstrating required failures were not hidden; those orchestration issues were subsequently corrected. Existing upstream skill files and checksums remain unchanged.
