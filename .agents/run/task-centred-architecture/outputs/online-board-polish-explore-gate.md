# Exploration Gate: Online Board Polish (#53 and #54)

- **Explorer session:** `ses_cfb761cb508c8d955ffd9295` (`9router/engineer`)
- **Worktree / commit:** `.worktrees/team-dev-explore-online-board-polish` (`explore/online-board-polish` @ `02d367cee8b2688784816cce4ba76ae11bdfb101`), 0 product files modified.
- **GitHub receipts:**
  - #54: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/54#issuecomment-6581548231
  - #53: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/53#issuecomment-6581548269

## Key Findings Accepted by Manager (after inspecting screenshots & metrics)

1. **#54 Sign-in screen flash (1.2s–1.8s on WAN, 158ms on loopback):**
   - `web/public/index.html` leaves `#login-view` visible by default.
   - `boot()` in `web/public/app.js` waits not only for `GET /api/session` (~13ms on live WAN), but also for `GET /api/repos` and `GET /api/combined/board` (1.2s–1.8s over WAN) before calling `showBoard()`.
   - Fix: hide `#login-view` by default in HTML, show the board shell immediately when signed in (using a non-secret client hint for first paint + flipping to `#board-view` as soon as `/api/session` resolves instead of waiting for GitHub issues to finish loading), and only show `#login-view` when `/api/session` returns 401.

2. **#53 Visual & structural gap vs OpenChamber Task Board panel:**
   - Inspected `panel-1280-dark.png` vs `web-1280-dark.png`, `panel-360-dark.png` vs `web-360-dark.png`, and `panel-drawer-1280-dark.png` vs `web-drawer-1280-dark.png`.
   - The web board looks like a separate prototype because of 5 structural differences plus color tokens:
     1. Centered 860px column vs OpenChamber's full-width layout.
     2. Two-tier header + giant full-width Project `<select>` + technical boilerplate paragraphs ("Only repositories visible to the bot token are listed...") + 4-column big button bar vs OpenChamber's single compact top toolbar (Project pill, Search, Filter, Sort, Refresh icon, View picker, Settings/Sign out).
     3. Chunky 64px task rows with 4 badge pills underneath and a giant empty "Done" drop-box vs OpenChamber's compact Linear-style rows (colored status dot, title, muted 1-line description preview, inline quick-add at bottom).
     4. Detail view hides the entire board (leaving the left side of the screen blank black) vs OpenChamber's right-side slide-over drawer over the visible task list.
     5. Fallback `:root` colors (`#09090b`) vs OpenChamber's dark (`#0f1012` / `#16181b`) and light (`#f4f5f7` / `#ffffff`) theme palette.

## Next Step
Present bundled alignment questions to user via `question`. No implementation until user aligns.
