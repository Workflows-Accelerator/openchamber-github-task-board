<env_preflight>
repo: /workspace/code/openchamber-github-task-board
worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
branch: feat/chamberos-board-v2
base_commit: 4a122bd
state: clean worktree on feat/chamberos-board-v2
files_in_scope:
- web/public/app.js
- web/public/theme.css
- web/server/app.ts
- web/tests/a5-sections.test.mjs
- scripts/audit-a5-packaged.mjs
- .agents/run/chamberos-board-v2/verifications/A-delivery/proof.md
- .agents/run/chamberos-board-v2/verifications/A-delivery/human-review.md
- .agents/run/chamberos-board-v2/verifications/A-delivery/live-switch.md
- .agents/run/chamberos-board-v2/verifications/A-delivery/smoke.json
- .agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/
test_command: npm test && node --test web/tests/*.test.mjs && npm run typecheck && node scripts/audit-a5-data.mjs && node scripts/audit-a5.mjs
do_not_touch:
- /workspace/releases/board/ (live production releases and current symlink — read-only inspection only)
- /workspace/.openchamber-data/board/ (live production state and PIDs)
- Live GitHub API (use only synthetic fake GitHub in tests and preview)
- Do not push to origin or merge to master
</env_preflight>

<goal>
Fix two manager-identified defects in the staged A1–A5 foundation bundle before human validation, refresh the staged foundation release artifact and isolated preview on `http://127.0.0.1:4041`, and update the `A-delivery` verification artifacts and screenshots.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/web/public/app.js]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/web/public/theme.css]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/web/server/app.ts]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/scripts/audit-a5-packaged.mjs]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/human-review.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2/.agents/run/chamberos-board-v2/verifications/A-delivery/live-switch.md]
</context_files>

<scope>
1. **`All Projects` routing in `Operations` and `Archive` (`web/public/app.js` & `web/server/app.ts`):**
   - In `web/public/app.js`: `loadAndRenderOperationsView()` (line ~6532) and `loadAndRenderArchiveView()` (line ~6620) currently fall back to `'/api/operations'` and `'/api/archive'` when `!selected` (`state.selected === 'all'`). When `BOARD_REPO` (`config.repo`) is configured on the server, `/api/operations` and `/api/archive` route to the single default repository instead of all discovered repositories (causing `08-operations-1280-dark-en.png` to show only `owner/repo` with `BLOCKED: 3` while the sidebar shows `All Projects` and `Blocked: 4`).
   - Change the `!selected` fallback in `loadAndRenderOperationsView()` to `'/api/combined/operations'` and in `loadAndRenderArchiveView()` to `'/api/combined/archive'` (matching `loadBoard()` at line 5118 which uses `'/api/combined/board'`).
   - In `web/server/app.ts`: inside `archiveData(repository, requestUrl)` and `operationsData(repository)`, when `repository === null`:
     - Check `const discovery = await repositories.view();` and if `discovery.discoveryFailed` is true, throw `new DiscoveryUnavailableError()` (just as `resolveRepository` does). This ensures full upstream outages/401/403/500 where discovery fails still return HTTP 502 error states (so `scripts/audit-a5.mjs` 401/500 section failure checks continue to pass), while partial per-repo failures where discovery succeeds and cached tasks are served (`scripts/audit-a5-data.mjs` line 37) continue to return HTTP 200 with `partial: true, failures: [...]`.
     - Also ensure `audit-a5-packaged.mjs` tests multi-repo `All Projects` aggregation on Operations (verifying both `owner/repo` and `owner/other-repo` appear in `statusPerProject` and `blocked === 4` when `state.selected === 'all'`).

2. **Canvas HUD button wrapping (`web/public/theme.css`):**
   - In `web/public/theme.css` on `.canvas-control-btn` (line ~1613), add `white-space: nowrap; flex-shrink: 0;` so `Fit all`, `Reset view`, and `Arrange` never wrap across multiple lines (`Arrang\ne` in `02-canvas-notes-wires-1280-light-en.png`).

3. **Canvas dot grid & wire count in `A-delivery` smoke/screenshots:**
   - In `web/public/app.js` line ~2268 (`updateCanvasTransform`), `radial-gradient(rgba(var(--canvas-dot-rgb, 24, 22, 19), ' + alpha + ') ' + dotRadius.toFixed(2) + 'px, transparent ' + dotRadius.toFixed(2) + 'px)'` renders crisp 1px dots in Chromium, whereas Obscura's CSS rasterizer ignores `px` color stops unless written with `0px` or percentage stops, or when captured via Obscura. Check whether Playwright Chromium (`chrome-headless-shell`) is available for capturing `A-delivery/screenshots/` or if adding explicit `0px` stop / Playwright capture produces crisp dots in `02` and `03`. (Keep the `dotRadius` and `alpha` expressions in `app.js` intact so `web/tests/canvas.test.mjs` lines 421–424 pass.)
   - Fix the wire-count selector in the `A-delivery` smoke check so `smoke.json` records the actual rendered wire count (`4`) instead of `0`.

4. **Rebuild, re-stage, refresh preview `:4041`, and commit:**
   - Run `npm test`, `node --test web/tests/*.test.mjs`, `npm run typecheck`, `node scripts/audit-a5-data.mjs`, and `node scripts/audit-a5.mjs`.
   - Commit the code + test changes on `feat/chamberos-board-v2` to obtain the new code commit SHA `<new-sha>`.
   - Build and stage `/tmp/opencode/board-v2-staging/<new-sha>-foundation/` (`package.json`, `web/dist/server.mjs`, `web/public/`, and `checksums.sha256` validated with `sha256sum -c --strict`).
   - Run `PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/<new-sha>-foundation node scripts/audit-a5-packaged.mjs` and verify all checks pass.
   - Restart the isolated preview server on `http://127.0.0.1:4041` from `/tmp/opencode/board-v2-staging/<new-sha>-foundation/`, re-capture `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/` and `smoke.json`, update `A-delivery/{proof.md,human-review.md,live-switch.md}` with `<new-sha>`, and commit the updated verification artifacts on `feat/chamberos-board-v2`.
</scope>

<criteria>
- `All Projects` in `Operations` and `Archive` loads `/api/combined/operations` and `/api/combined/archive`, showing both `owner/repo` and `owner/other-repo` and `BLOCKED: 4` in `08-operations-1280-dark-en.png` and `09-operations-1280-light-fr.png`.
- `.canvas-control-btn` has `white-space: nowrap; flex-shrink: 0;` and `Fit all`, `Reset view`, `Arrange` render on a single line without wrapping in `02` and `03`.
- `npm test`, `node --test web/tests/*.test.mjs`, `npm run typecheck`, `node scripts/audit-a5-data.mjs`, `node scripts/audit-a5.mjs`, and `PACKAGED_RELEASE_DIR=... node scripts/audit-a5-packaged.mjs` all pass with 0 failures.
- Preview on `http://127.0.0.1:4041` is live and serving the new staged bundle; live production (`/workspace/releases/board/current` and `:8787`) is untouched.
</criteria>

<output>
Return a concise report with:
- Code commit SHA and verification commit SHA on `feat/chamberos-board-v2`
- Staged release directory path and `sha256sum -c --strict` result
- Test & audit suite counts
- Preview server PIDs and health check status on `http://127.0.0.1:4041`
</output>
