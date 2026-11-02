<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look (branch feat/issue-53-openchamber-look, base 4606b45d171aec28198cc0437d9b929b035c775b which already contains accepted #54).
Dependencies: symlink `/workspace/extensions/github-task-board/node_modules` -> `<worktree>/node_modules` and `/workspace/extensions/github-task-board/web/node_modules` -> `<worktree>/web/node_modules` before running tests.
Test commands:
- Web unit suite: `node --test web/tests/*.test.mjs`
- Root suite: `npm test`
- Typechecks: `npx tsc --noEmit` and `npx tsc -p web/tsconfig.json --noEmit`
- Browser/Obscura harness: Chromium headless fails in this container (`libglib-2.0.so.0` missing); use Obscura (`obscura-bin` / CDP) as in `.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/harnesses/run-exploration.mjs` and `.agents/run/issue-54-build/harnesses/verify-no-flash.mjs`.
Do not touch: `panel/**`, `service/**`, `web/server/**` (unless strictly needed, prefer `web/public/**` + `web/tests/**`), `/workspace/releases/board/**`, live processes, port 3000, `/workspace/.openchamber-data/**`, `.env*`, credentials, `/proc/*/environ`, or live GitHub. Never run `git remote -v`. No git push. Zero emojis in code, comments, tests, or proof.
</env_preflight>
<goal>
Implement Issue #53 per aligned decisions D63 and D64 so the online board (`web/public/{index.html,theme.css,app.js}`) looks and feels like the OpenChamber Task Board panel across desktop (1280px) and mobile (360px), in dark and light themes, while preserving every existing web board capability and test contract (including #47 persistent sign-in, #48 simplified views/filters/sorts/draft reorder/confirmed native transfer, #49 sr-only login username label, and #54 no sign-in flash).
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish/.agents/run/online-board-polish-explore/findings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-54-no-signin-flash/.agents/run/issue-54-audit/verifications/proof.md]
panel/index.html
panel/main.ts
web/public/index.html
web/public/theme.css
web/public/app.js
web/tests/simple-views-client.test.mjs
web/tests/multi-repo-client.test.mjs
web/tests/protocol-corrections.test.mjs
web/tests/app.test.mjs
web/tests/login-label.test.mjs
web/tests/issue-54-no-signin-flash.test.mjs
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/implementation/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/domain/frontend-ui-engineering/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. First inspect all existing web tests (`web/tests/*.test.mjs`) to catalog every DOM ID, class, attribute, and text string asserted by the existing 464 web tests (for example `#login-view`, `#board-view`, `#detail-view`, `#board-toolbar`, `#repo-select`, `#scope-status`, `#discovery-status`, `#refresh-policy`, `#board-count`, `#task-list`, `#no-issues`, `#done-drop-zone` or equivalent if tested, `.simple-row`, `.simple-dot`, etc.).
   - CRITICAL: Preserve all required DOM IDs, hooks, and accessibility attributes expected by existing tests, or hide verbose diagnostic nodes (`#discovery-status`, `#refresh-policy`, `#done-drop-zone` when not dragging) visually/cleanly so existing unit/protocol tests remain 100% green without weakening any existing test assertion.
2. Write failing (red) unit tests first in `web/tests/issue-53-openchamber-look.test.mjs` covering D63 & D64:
   a. **Full-width edge-to-edge layout (D63.1):** `.shell` / `#board-view` uses full-width layout (`max-width: none` or `100%`, compact OpenChamber padding `8px 16px`), not the narrow `860px` column. Verbose helper paragraphs (`#discovery-status`, `#refresh-policy`) and the empty bottom `#done-drop-zone` box are not cluttering the default Simple list view (hidden by default; if `#done-drop-zone` is needed for drag-to-done, only show it during active drag or style it unobtrusively).
   b. **Unified compact OpenChamber toolbar (D63.2):** Top toolbar (`#board-toolbar`) arranges Project selector pill (`#repo-select` styled like OpenChamber's compact repo pill with short project name and full `owner/repo` tooltip), Search input (`#board-search` if added or compact filter/search control), View selector (`#view-select-btn`), Filter button (`#filter-btn`), Sort selector (`#sort-select`), Settings button (`#settings-btn`), Refresh (`#refresh-btn`), and Sign out (`#signout-btn`) in a single compact OpenChamber-style header bar with a sub-header status strip (`Task Board · <scope> · <count> · <freshness>`).
   c. **Linear-style compact Simple list rows (D63.3):** In Simple list view, each `.simple-row` renders in OpenChamber's compact Linear-style row format: a status-colored dot (`.simple-dot` with status tone class / color matching OpenChamber status colors: draft purple `#a855f7`, todo blue `#3b82f6`, in-progress/active green `#10b981` or amber `#f59e0b`, needs-human/blocked amber/red, done green/muted), the task title (`.simple-row-title`), a muted 1-line description/subtitle preview (`.simple-row-desc` / `.simple-row-meta`), compact right-aligned metadata (`#<number>`, compact repo/attention chip only when needed), and the inline quick-add row at the bottom — without the bulky 64px 4-pill card stack.
   d. **Right-side 480px slide-over detail drawer over visible task list (D63.4):** Opening a task detail (`showDetail()` / `#detail-view`) keeps `#board-view` visible underneath (`#board-view.hidden` stays `false` while `#detail-view.hidden` is `false` and `body` / `.shell` has class `drawer-open`), rendering `#detail-view` as a fixed right-side `480px` (`100vw` on 360px mobile) slide-over panel with a backdrop/close button (`#back-btn`), structured OpenChamber-style property sections (Status, Acceptance criteria, Actionable subtasks, Overview, Open questions, Human tasks), and NO agent-start or `Align Drafts` controls on web. Closing the drawer (`showBoard()` / `#back-btn` / Escape / backdrop click) hides `#detail-view` and keeps `#board-view` open.
      - Check existing tests that assert `get('board-view').hidden` when `showDetail()` is called! If any existing test in `web/tests/*.test.mjs` asserts `board-view.hidden === true` during detail view, inspect it carefully: either update that specific test expectation if it was testing the old push-view behavior, OR check if keeping `#board-view` visible breaks any existing test. (Check with `grep` first and document any test updated for the new D63.4 slide-over drawer behavior.)
   e. **OpenChamber color tokens & Theme mode Auto / Dark / Light (D64):**
      - `web/public/theme.css` uses OpenChamber's exact dark tokens (`--bg: #0f1012`, `--surf: #16181b`, `--surf-muted: #1c1f24`, `--surf-subtle: #23272e`, `--surf-hover: #2a2f38`, `--border: rgba(255, 255, 255, 0.08)`, `--fg: #f0f2f5`, `--fg-muted: #8c929d`, `--prim: #3b82f6`) and light tokens (`--bg: #f4f5f7`, `--surf: #ffffff`, `--surf-muted: #eaedf0`, `--surf-subtle: #e2e6ea`, `--surf-hover: #eef1f5`, `--border: #d0d5dd`, `--fg: #1f2328`, `--fg-muted: #59636e`, `--prim: #2563eb`).
      - Supports `data-theme="dark"` and `data-theme="light"` on `document.documentElement` (`<html>`), defaulting to `auto` (which follows `prefers-color-scheme`), with a Theme selector (`Auto`, `Dark`, `Light`) in `#settings-popover` persisted in `localStorage` under `tb_theme_mode` (`'auto' | 'dark' | 'light'`) and applied immediately on boot and on change.
3. Implement the changes cleanly in `web/public/index.html`, `web/public/theme.css`, and `web/public/app.js`.
4. Run an Obscura browser verification harness (`.agents/run/issue-53-build/harnesses/verify-openchamber-look.mjs`) that:
   - Captures screenshots at `1280x800` and `360x640` in both `dark` and `light` themes, plus the open slide-over detail drawer at `1280x800` (proving the task list remains visible on the left while the 480px drawer is open on the right).
   - Verifies computed styles and bounding boxes: full-width board container (`width >= 1200px` at 1280px viewport), compact unified toolbar height (`<= 56px` at 1280px), compact Simple list row height (`<= 52px` for a 1-line row at 1280px), slide-over drawer width (`440px..500px` at 1280px, `360px` at 360px) with `#board-view` still visible on the left, zero horizontal overflow (`scrollWidth <= innerWidth`) at both 1280px and 360px, and theme toggle switching computed `--bg` between `#0f1012` (dark) and `#f4f5f7` (light).
   - Re-runs `.agents/run/issue-54-build/harnesses/verify-no-flash.mjs` to prove #54's 0ms flash guarantee still passes 13/13.
5. Write `<worktree>/.agents/run/issue-53-build/verifications/proof.md` and commit all changes on `feat/issue-53-openchamber-look`.
</scope>
<output>
Return <=12 lines: files changed; red-green test summary; full web + root test counts + typecheck results; Obscura layout/theme/drawer/no-flash check counts + screenshot paths; commit hash; actual provider/model.
</output>
