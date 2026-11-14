<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-overhaul
Branch: feat/wave7-overhaul
Base: feat/wave7-overhaul (first run `git merge --ff-only feat/wave7a-server-wiring-l4` so HEAD is at `4fba1fd`)
Test commands:
- node --test --test-timeout=60000 web/tests/wave7b-canvas-flow.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave7b-app.js
Forbidden:
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- Keep ALL existing product invariants: infinite canvas with non-growing two-stop dot grid (`app.js:2268`), Markdown sticky notes under cards, strict CSP `style-src 'self'` (ZERO inline `style=` attributes — use CSS classes / `--var` only if computed or CSS rules in `theme.css`!), zero `"n8n"`, zero `"mobile"`, zero emojis, no `+` icon + `"+"` text duplication, nothing fake/simulated, sidebar navigation with Canvas/List, defer Triggers launch buttons ("Pas encore").
- NEVER push, deploy, or spawn subagents.
</env_preflight>

<goal>
Implement **Wave 7b — Canvas Flow Overhaul** in `web/public/index.html`, `web/public/app.js`, and `web/public/theme.css` (using `web/public/flow-layout.js` and `/api/layout` + `activeSession` from Wave 7a): replace status columns on Canvas with a calm, legible, collapsed-by-default execution + mind-map flow graph grouped by repository and parent issue.
</goal>

<context>
Read first:
- `web/public/flow-layout.js` (`arrangeFlowGraph` contract and options)
- `web/server/layout.ts` & `web/server/app.ts` (`/api/layout` GET/PATCH and board payload `layout` + `activeSession` + `parentKey` / `parentTitle`)
- `web/public/index.html`, `web/public/app.js` (canvas rendering, pan/zoom, notes, wires, arrange/reset, `localStorage`), `web/public/theme.css`.
- `verifications/usability-audit-2026-11-13/README.md` (finding #1: 20% 2.02px unreadable phone canvas; finding #17: Arrange/Undo).
</context>

<requirements>
1. **Replace status columns on Canvas with Flow Graph (`arrangeFlowGraph`)**:
   - Serve & load `web/public/flow-layout.js`:
     - Register `'/flow-layout.js': { body: loadStatic('flow-layout.js'), type: 'text/javascript; charset=utf-8' }` in `web/server/app.ts` `STATIC` (and `shellAssets` if applicable).
     - Add `'/flow-layout.js'` to `SHELL_ASSETS` and `pathname === '/flow-layout.js'` in `web/public/sw.js` (and keep `web/tests/sw.test.mjs` passing/updated).
     - Add `<script type="module" src="/flow-layout.js"></script>` in `web/public/index.html` next to `markdown.js` / `arrange.js` before `<script src="/app.js" defer></script>` (module scripts execute in document order before `defer` classic scripts and populate `globalThis.arrangeFlowGraph`). Also check `web/tests/helpers.mjs` or any DOM harness in tests if needed so `arrangeFlowGraph` is available in JS unit/browser tests too.
   - Remove the status-column backdrop headers on Canvas; replace with **repository + parent-issue flow graph**:
     - Group cards by `repo` and `parentKey` (unparented bucket per repo).
     - **Collapsed by default** (especially critical for 345 issues across 27 repos): render each collapsed group as a calm, scannable group card showing: repo short name + parent title (or "Standalone" / "Sans parent"), and clear counts (`total`, `running`, `needs me`, `done`), plus an expand/collapse toggle button.
     - **Search / active filter auto-expand**: when a search query or filter matches cards inside collapsed groups, auto-expand those matching groups temporarily (without permanently clobbering user's saved `expandedGroups` unless they click a group toggle), OR clearly surface matching groups so filtered tasks are immediately visible!
     - **Readable default framing (fix usability audit #1)**: at 390px and 1280px, initial canvas framing with collapsed groups (or expanded subset) must keep text legible (never crushing 345 items into 20% 2px zoom!). Keep `Show all (N)` / zoom controls working cleanly.
2. **Configurable Flow Direction (`LR` / `TD`)**:
   - Add a clean flow-direction control on Canvas toolbar/settings (`Auto` / `LR` / `TD`):
     - `Auto` resolves to `'LR'` when viewport width `>= 768px` and `'TD'` when `< 768px`.
     - Explicit `'LR'` or `'TD'` overrides viewport width.
   - Persist `direction`, `expandedGroups`, and manual dragged card `positions` to the server via `PATCH /api/layout` (using current board scope `'all'` or `owner/repo`) — **ZERO GitHub issue writes on arrange or drag-position**!
3. **Manual order override (`<!-- board-order: N -->`) + Reset to auto**:
   - Auto-layout uses `dependencies -> board-order -> priority -> createdAt`.
   - When the user explicitly sets/reorders a task's execution order (e.g. from drawer or reorder control), allow setting numeric `order` AND resetting to auto (`PATCH /api/.../issues/:n` with `{ order: null }`), while dragging on Canvas saves coordinates to `/api/layout` only.
   - Keep `Arrange` button ("Auto-arrange" / "Réorganiser") calling `PATCH /api/layout` with `resetPositions: true` (plus Undo support!).
4. **Active Agent Session vs Steady `in-progress` Indicator (CSP-safe CSS in `theme.css`)**:
   - When `issue.activeSession && issue.activeSession.active === true`: render an **animated rotating green border** (`@keyframes` CSS animation in `theme.css`, respectful of `prefers-reduced-motion: reduce`) + subtle "Agent running" / "Agent actif" indicator.
   - When `stageOf(issue) === 'in-progress'` WITHOUT an active `activeSession`: render a **steady distinct green border/tag** (no rotation animation) so the user immediately tells live running work apart from idle `in-progress`.
   - Zero Triggers launch buttons ("Pas encore").
5. **Preserve all existing Canvas features**:
   - Non-growing two-stop dot grid, pan/zoom, Markdown sticky notes attached to cards (moving with cards), dependency wires (`edges` from `arrangeFlowGraph`), click-to-open task drawer, and clean failure state when `state.board === null`.
   - Check CSP: NO inline `style="..."` added anywhere in `index.html` or `app.js` (note existing canvas transform/position uses CSS classes or `.style` property only if already allowed; wait — strict `style-src 'self'` blocks `style="..."` HTML attributes AND inline `<style>` tags! Use `.style.transform` / `.style.left` / CSS classes consistently with existing `app.js`!). Check existing canvas tests (`canvas.test.mjs`, `v4-2-notes.test.mjs`, `issue-54-no-signin-flash.test.mjs`, `a5-sections.test.mjs`) stay 100% green.
</requirements>

<steps>
0. First run `git merge --ff-only feat/wave7a-server-wiring-l4` in this worktree and confirm `HEAD` is `4fba1fd` and `web/tests/wave7a-server-wiring.test.mjs` (16/16) passes.
1. Write failing tests first in `web/tests/wave7b-canvas-flow.test.mjs` testing: flow-layout integration, `/flow-layout.js` served with 200, collapsed-by-default group rendering with counts, expand/collapse persisting via `PATCH /api/layout`, LR/TD auto direction by viewport width + explicit override persisted via `/api/layout`, canvas drag saving to `/api/layout` (0 GitHub PATCH calls!), `order: null` reset to auto, activeSession animated class vs idle `in-progress` steady class, search auto-expanding matching groups, and EN/FR I18N parity + zero forbidden tokens.
2. Implement changes in `web/server/app.ts` (`/flow-layout.js` static route), `web/public/sw.js`, `web/public/index.html`, `web/public/app.js`, `web/public/theme.css` (and `web/tests/sw.test.mjs` if needed).
3. Run `node --test --test-timeout=60000 web/tests/wave7b-canvas-flow.test.mjs`, `web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, `tsc`, and `esbuild`.
4. Commit cleanly as `feat(canvas): replace columns with flow-graph layout and active session rings`.
</steps>

<output>
At most 12 lines: STATUS, COMMITS, TEST_COUNTS (focused, web, npm, typecheck, esbuild exit codes), IMPLEMENTED_ITEMS, INVARIANTS_CHECK (EN/FR parity, CSP, dot-grid, zero GitHub writes on drag), NOT_VERIFIED.
</output>
