# Batched L5 Human Review Gate — Repairs #49, #50, #51

- **Date:** 2026-11-02
- **Staging Worktree:** `/workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51`
- **Staging Branch:** `staging/repairs-49-50-51` (`8b7e059`, merge commit `1a6e050`)
- **Live Published Baseline (`origin/master` & `https://board.workflows.ac`):** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (unchanged; nothing from #49/#50/#51 is pushed or deployed yet)

## Candidate Commits & Receipts
1. **#49 (`fix/issue-49-login-label` @ `84d2e39`) — Web sign-in hidden username label bleed:**
   - Fix: `web/public/theme.css` adds `input.sr-only { left: -9999px; top: auto; }` (4 lines), plus `web/tests/login-label.test.mjs` and `web/tests/login-label-browser-verify.mjs`.
   - Reviews: L4 + independent recheck `Spec: PASS` / `Quality: APPROVED`.
   - GitHub: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/49 (`status:needs-human`)
2. **#50 (`fix/issue-50-host-connection` @ `f0dae5b`, code `1863b0d`) — Extension background coordinator service & board-open connection check:**
   - Fix: `service/main.ts` (`GET /health` HTTP server with SHA-256 timing-safe Bearer auth before body buffering, `coordinatorService.start()` before `server.listen`, 503 if not running, owned-lease-only cleanup on `SIGTERM`/`SIGINT` with 3.5s safety timer) + `panel/main.ts` (`checkBackgroundServiceConnection()` probes `/health` once on board open if capability is already granted, shows honest warning banner on disabled/error, never auto-grants or polls, never starts agents or mutates labels).
   - Reviews: Plan rev 2 `83ad27e` (`Spec: PASS` / `Quality: APPROVED`), L4 `1863b0d`, independent audit `f0dae5b` (`Spec: PASS` / `Quality: APPROVED`).
   - GitHub: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/50#issuecomment-6569464296 (`status:needs-human`)
3. **#51 (`fix/issue-51-toolbar-controls` @ `c37ad8b`, code `7b7bbc5`) — Extension toolbar Sort, project label, and View controls:**
   - Fix: CSS-only in `panel/index.html` + `test/toolbar-controls.test.js`: `#selectSort` uses surface/foreground/border tokens with `color-scheme: inherit` and light-theme hover contrast; `#btnRepoSelect` / `#txtRepoLabel` left-aligns with `min-width: 0` and end-only ellipsis while keeping caret and full `owner/repo` `title` tooltip; `#btnViewSelect` / `.toolbar-dropdown-wrap` prevents clipping (`flex-shrink: 0; white-space: nowrap;`) and `.toolbar-right` stays on one row at `>= 768px`.
   - Reviews: L4 `7b7bbc5`, independent audit `c37ad8b` (`Spec: PASS` / `Quality: APPROVED`).
   - GitHub: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/51#issuecomment-6569464224 (`status:needs-human`)

## Combined Staging Verification (`8b7e059`)
- `npm run build && git status --short && npm run typecheck`: PASS (0 bundle drift, 0 tsc errors)
- Extension/root suite (`npm test`): **618/618 PASS**
- Web suite (`node --test web/tests/*.test.mjs`): **453/453 PASS**
- Isolated loopback smoke (#49 Obscura CDP, #50 `service/main.js` on ephemeral port 42777, #51 Obscura CDP 12-viewport matrix): **PASS**

## Unverified Blind Spots Disclosed to User
- Real authenticated OpenChamber parent UI on port 3000 (password-protected): live iframe handshake, host theme injection, and live host toggle of the background service have only been tested against a synthetic `openchamber.sdk` bridge and ephemeral loopback process, not inside the live port-3000 parent shell.
- Chromium 156.0 headless shell could not start in this container (`libglib-2.0.so.0` missing) during the #51/staging runs, so #51's browser layout and screenshots were verified in Obscura 0.2.5 CDP only (#49 was previously verified in both Chromium 156.0 and Obscura 0.2.5).
- Native password manager popups (Chrome/iOS/1Password), real screen readers, physical phone touch feel, and live GitHub issue transfer permissions remain unverified by automation.
