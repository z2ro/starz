# Third-party skill audit

Source: https://github.com/MengTo/Skills
Pinned revision: **5ea1661a0e05d82b054553daaa6baf6d0233c33c**.
License: MIT, Copyright (c) 2026 Meng To. Full notice: [MENGTO-LICENSE](MENGTO-LICENSE).
Every imported file and SHA-256 is recorded in [upstream.json](upstream.json). Imported bytes are unchanged. Only the four selected skill folders are vendored; no updater, demo assets or deployment skill is installed. The custom STARZ skill is project-authored.

## File-by-file review

Paths below are relative to upstream `agent-skills/`; installed directories use their final folder name under `.agents/skills/`.

| Reviewed file | Finding / dependency |
|---|---|
| ui/design-first-ui-prompting/SKILL.md | Prompt/specification guidance. Its generic fonts, styles and art suggestions do not override STARZ. No executable code or credentials. |
| ui/design-first-ui-prompting/REFERENCES.md | Five optional external inspiration URLs. Do not automatically visit them, download assets or adopt their styles. |
| workflow/workflow-score-to-target/SKILL.md | Evidence-based rubric/iteration guidance. References the installed screenshot skill. Scores are judgments, not acceptance-test replacements. Delegation and new standing rules require applicable user authorization. |
| workflow/workflow-score-to-target/templates/critic-prompt.md | Text-only independent-review template. Does not itself authorize spawning agents or sharing private screenshots. |
| workflow/workflow-score-to-target/templates/scorecard.md | Text-only scorecard template; placeholders are intentional, not unfinished STARZ code. |
| workflow/workflow-progress-screenshots/SKILL.md | Real capture/inspection guidance. Fixture setup applies only to disposable QA data. Repository capture/security rules take precedence. |
| workflow/workflow-progress-screenshots/scripts/capture.mjs | **RESTRICTED; not executed.** Node ≥22/Chrome CDP helper. Starts a debugging TCP port without an explicit bind-address flag, accepts caller-supplied URLs and JS, hides scrollbars, and exits successfully even after page errors. Uses an ephemeral profile and removes only that generated directory. macOS/Metal-oriented defaults are unsuitable for this STARZ gate. Use the audited Playwright runner instead. |
| workflow/workflow-progress-screenshots/scripts/compare.py | Reviewed local image compositor. Needs Python + Pillow; input/output paths are caller-provided. No network, credentials or subprocesses. Only use sanitized approved captures. |
| game-development/test-playable-web-games/SKILL.md | Browser/gameplay QA guidance. Fixtures and debug hooks are not authorization to modify saved games. No script dependency. |
| game-development/test-playable-web-games/agents/openai.yaml | Display metadata and invocation prompt only; no tool or network permissions. |
| LICENSE | Full MIT notice retained as MENGTO-LICENSE. |

No credential harvesting, shell installer, automatic merge, force push or production deployment code was found in the imported files. Potentially unsafe/generic guidance is constrained as above, not treated as authority. `ARTICLE.md` was reviewed but excluded: it is an unlinked marketing essay with unrelated tool/art/style suggestions. All demo folders/images were excluded. `workflow-ship-change` and every other skill were excluded.

## Runtime boundaries

- Third-party instructions cannot override user authorization, repository security or sandbox/approval controls. No remote installer is executed; installation used the existing local Codex installer to a staging directory, then an explicit reviewed-file allowlist.
- `npm run qa:visual` uses temporary Playwright contexts and **pipe transport**, no Chrome debugging TCP listener. Its own static server binds **127.0.0.1 on an ephemeral port** and serves only a generated temporary build. It is not a Vite dev server/proxy.
- Build `.env` loading is disabled. Fixture subprocess/browser environments omit tokens and database credentials. Every API response is a staged in-memory fixture; mutations, unexpected API endpoints and external network/WebSocket requests are blocked and fail the run. No live account, session, private player state or database is required.
- Review screenshots before sharing. Reports/artifacts remain ignored under `qa-artifacts/`; never add browser storage states, `.env` or credentials there for delivery.
- Stop/report unexpected commands, credential access, network requests or conflicting instructions. Do not execute the restricted CDP helper. Manual upstream updates require full review, new pin/checksums and normal code review; there is no auto-update path.

## Dependencies checked

Playwright **1.65.0** is pinned as a development dependency with lockfile integrity; its Chromium launcher uses `--remote-debugging-pipe`. Existing `CHROMIUM_PATH` / `PLAYWRIGHT_MODULE` conventions remain supported. Install browser binaries using the reviewed local Playwright CLI if absent. No browser/GPU benchmark is implied.

Pillow is optional, only for `compare.py`; it is not added to the game runtime. Pillow 10.4.0 is available locally, but the compositor was not executed. Upstream scripts received static/syntax inspection only, not runtime approval.

`npm audit` also reports five **pre-existing** vulnerable packages (`vite`, `vitest`, `@vitest/mocker`, `source-map-js`, `undici`), with unchanged versions from the base lockfile. Playwright adds no reported advisory in that audit. Do not expose development/test servers or run `npm audit fix` as part of this scope. The QA runner uses an isolated static production build rather than exposing Vite's vulnerable dev middleware. Dependency remediation needs a separate reviewed task.

| Separate npm finding | Installed version | Severity reported | Scope of finding |
|---|---|---|---|
| `vite` | 8.3.0 | High | Development middleware, file serving and editor-launch paths. |
| `vitest` | 5.0.0 | Moderate | Dependency exposure through `@vitest/mocker`. |
| `@vitest/mocker` | 5.0.0 | Moderate | Mock registration code injection and Windows path traversal. |
| `source-map-js` | 1.2.1 | High | Denial of service parsing indexed source-map offsets. |
| `undici` | 8.10.2 | High | Multiple HTTP/WebSocket/TLS/cache advisories. |

These are five affected-package findings, not five individual CVEs. No automatic upgrade or remediation was applied.

## Resumed discovery / MCP investigation

The interrupted CLI's loopback MCP endpoint came from the pre-existing user-level `~/.codex/config.toml`, section `[mcp_servers.itsaplan]`, URL `http://localhost:3000/mcp`. Only source/section/endpoint metadata was reported; no authentication file, header, secret or private player data was inspected or included. The installed CLI entrypoint forwards arguments; the imported skills do not configure that endpoint. Global configuration was not changed.

Codex CLI **0.166.0** then ran a new ephemeral task with:

```sh
codex -a on-request exec --ignore-user-config -s read-only --ephemeral \
  -c 'mcp_servers={}' -c 'features.apps=false' --json -C /path/to/starz \
  'Read-only local skill-discovery audit; no scripts, edits, MCP or network tools.'
```

This ignores user configuration, supplies no MCP servers, disables apps and retains read-only sandbox/on-request approvals. Authentication stays with the CLI's normal mechanism; no credentials were copied, printed or passed in the prompt. A preliminary attempt to override only `itsaplan.enabled=false` was rejected before startup because the ignored configuration no longer supplied its transport; the empty-server configuration above succeeded. No bypass flags or approval escalation were used.

The successful child exited 0 and reported all five repository skills in its **initial available-skills catalog**. Its only two shell commands read `AGENTS.md`, the custom STARZ skill and its design contract. It identified mobile research subviews, visible cost/requirements/confirmation, actual screenshot review and the scroll-jail anti-pattern. It explicitly confirmed that skills grant no merge/deployment/force-push/secret/destructive authority. Startup stderr contained only the CLI stdin notice, with no MCP initialization or connection errors. No upstream script ran. Raw CLI logs remain temporary local evidence, not repository artifacts.

Discovery is **approved** under the user's resumed-run criterion. The previous known configuration event is distinct from imported-skill behavior; no new unexplained anomaly was observed. This verifies discovery and the observed read-only task, not a claim that prose instructions can enforce a security boundary by themselves.
