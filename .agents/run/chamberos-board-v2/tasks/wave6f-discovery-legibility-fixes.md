<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base: 07b8435 (on top of baba530, e1f90aa, 07b8435)
Test commands:
- node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave6f-server.mjs
- npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave6f-app.js
Forbidden:
- NEVER stage or commit untracked `.agents/run/chamberos-board-v2/verifications/V4-1-L4/` (always `git add <explicit files>`, never `git add -A` or `git add .`).
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER push, deploy, delete files outside task scope, or spawn subagents.
</env_preflight>

<goal>
Fix all 4 P1 defects and 1 P2 test/proof defect identified in `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4/README.md` (`07b8435`), with failing tests first, full suite + typecheck + bundle verification, and updated Chromium proof.
</goal>

<context>
Read first:
1. `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4/README.md` (exact file/line citations and empirical failures).
2. `web/server/github.ts`, `web/server/repositories.ts`, `web/server/app.ts`, `web/public/app.js`, `web/public/theme.css`, `web/public/index.html`.
3. `web/tests/discovery-legibility.test.mjs`, `web/tests/fake-github.mjs`, `.agents/run/chamberos-board-v2/verifications/discovery-legibility/verify.mjs`.
</context>

<requirements>
1. **P1 — Status-first HTTP classification (`web/server/github.ts`, `web/server/repositories.ts`)**:
   - In `kindForStatus()` (`github.ts`), classify `401` -> `'unauthorized'`, `429` or `x-ratelimit-remaining === '0'` -> `'rate_limited'`, and `403` -> `'forbidden'` (unless rate-limit header/body indicates `'rate_limited'`) BEFORE returning `'server'` when response body is non-JSON or empty.
   - In `discoveryFailureKind()` (`repositories.ts`), map both `'unauthorized'` AND `'forbidden'` to `'auth'` (never `'server'`), so token scope / SAML SSO / fine-grained PAT refusals tell the user the token/permissions need attention.

2. **P1 — Propagate cause through `DiscoveryUnavailableError`, refresh bypass, combined discovery failure, and clear Canvas (`web/server/repositories.ts`, `web/server/app.ts`, `web/public/app.js`, `web/public/theme.css`)**:
   - Attach `errorKind` (`DiscoveryFailureKind`) and `errorResetAt` (`string | null`) to `DiscoveryUnavailableError` and return consistent HTTP `503` (including `archiveData`/`operationsData` catch path in `app.ts`) with `{ error: 'discovery_unavailable', errorKind, errorResetAt, message }`.
   - Pass `{ forceRefresh }` through `resolveRepository()` in `app.ts` so `GET /api/repos/:owner/:name/board?refresh=1` (and `/api/board?refresh=1`) re-checks GitHub immediately instead of staying stuck on the 60s latch.
   - In `app.js` `loadBoard()`: if `board.discoveryFailed` is true after `/api/combined/board` (mid-refresh failure), handle it as discovery failure (do NOT overwrite `localStorage` cached tasks with `issues: []`, do NOT show `'No tasks yet in All Projects'`).
   - In `app.js` `api()`, `openIssue()`, `canvasMoveFailureMessage()`, and quick-add: when server returns `503` `discovery_unavailable`, render localized EN/FR `discoveryFailureMessage(errorKind, errorResetAt)` (no hardcoded English, no `"unknown outcome"` on definite 503).
   - In Canvas mode (`app.js` + `theme.css`): on discovery failure (`state.board === null`), clear `#canvas-cards` (and canvas edges/headers) and make `#empty-state` visible (or present the failure state cleanly) so zero stale cards remain visible or clickable.

3. **P1 — Eliminate 3x duplication, 1280px `.status-strip` overflow, contradictory CTA, and stale language switch (`web/public/app.js`, `web/public/theme.css`)**:
   - Keep `#scope-status` short (concise status pill/label, NOT the full 150-char sentence) so `.status-strip` never overflows horizontally at `1280px` (`scrollWidth <= clientWidth`) and `#list-group-toggle`, `#new-task-btn`, and `#freshness` stay completely inside the `1280px` viewport.
   - Keep the full localized cause sentence in `#empty-state` (and `#notice` / `#discovery-status` without overflowing `.status-strip`); while `discoveryFailed` is active, hide `.empty-hint` and hide/disable `#empty-create` (Create a task CTA).
   - Store the active discovery failure `{ errorKind, errorResetAt, failures }` in client state and re-render `#notice`, `#scope-status`, `#empty-state`, and `#discovery-status` inside `applyLanguage()` when switching EN <-> FR while `state.board === null`.

4. **P1 — Honest rate-limit reset (`web/server/github.ts`, `web/server/repositories.ts`, `web/public/app.js`)**:
   - Capture rate-limit `reset` ONLY from the failing discovery response itself (never leak stale `sharedRateLimit.current.reset` onto headerless `403`/`429` secondary rate limits).
   - Suppress `errorResetAt` (set `null`) whenever `reset * 1000 <= Date.now()`.
   - In `discoveryResetClock()` (`app.js`), also guard against past timestamps (`date.getTime() <= Date.now()` -> omit time fallback), and include date/day context when the reset falls on a different local calendar day than `now`.
   - Replace `"the board will refresh after {time}"` / `"le tableau s’actualisera après {time}"` with honest manual-refresh wording (`"Refresh after {time}."` / `"Actualisez après {time}."`). Preserve EN/FR `I18N` parity, zero `"n8n"`, `"mobile"`, emojis, or `!`.

5. **P2 — Fix tests, fake-github, and Chromium verification (`web/tests/discovery-legibility.test.mjs`, `web/tests/fake-github.mjs`, `.agents/run/chamberos-board-v2/verifications/discovery-legibility/verify.mjs`)**:
   - Add failing-first tests in `web/tests/discovery-legibility.test.mjs` for: `403 forbidden` -> `'auth'`, non-JSON `401`/`429`, headerless `403` secondary rate limit without stale reset leak, past reset suppressed, `503 discovery_unavailable` carrying `errorKind`/`errorResetAt`, `?refresh=1` bypassing latch on single-repo board, Canvas clearing stale cards on discovery failure, and `setLanguage()` updating discovery error strings.
   - Update `fake-github.mjs` so `setDiscoveryResetAt(null)` cleanly clears reset headers and headerless secondary rate limit mode can be tested.
   - Update `.agents/run/chamberos-board-v2/verifications/discovery-legibility/verify.mjs` to assert `scrollWidth <= clientWidth`, `#list-group-toggle` / `#new-task-btn` / `#freshness` inside viewport bounds at `1280x900`, `#empty-create` hidden/disabled on failure, Canvas clearing stale cards, EN<->FR switch updating text, and re-run it to refresh `report.json` + screenshots.
</requirements>

<steps>
1. Read `discovery-legibility-L4/README.md` and target files.
2. Add failing tests in `web/tests/discovery-legibility.test.mjs` and confirm they fail before production edits.
3. Implement fixes in `web/server/github.ts`, `web/server/repositories.ts`, `web/server/app.ts`, `web/public/app.js`, `web/public/theme.css`, `web/tests/fake-github.mjs`, and `verify.mjs`.
4. Run all verification commands (focused tests, all `web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, `tsc`, `esbuild`, and `verify.mjs` Chromium matrix).
5. Commit cleanly in two commits (app+tests, then verification evidence) using explicit file paths (`git status --short` must leave only untracked `V4-1-L4/` untouched).
</steps>

<output>
At most 12 lines: STATUS, COMMITS, TEST_COUNTS (focused, web, npm, typecheck, esbuild, verify.mjs exit codes), DEFECTS_CLOSED (list P1-1..P1-4, P2), VISUAL_CHECK (confirm 1280px toolbar not clipped and canvas empty on failure), NOT_VERIFIED.
</output>
