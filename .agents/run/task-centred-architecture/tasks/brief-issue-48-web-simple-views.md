<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views
Branch: feat/issue-48-web-simple-views (from fix/issue-47-fresh-app-stay-signed-in @ af9b39c, clean)
Issue: #48 https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/48 (this brief covers the standalone web board / phone app part)
Files in scope: web/public/app.js (board rendering, views, filters, drawer, quick-add), web/public/index.html (board section only), web/public/theme.css, web/server/app.ts and web/server/board.ts and web/server/github.ts (only routes/fields needed for draft order, short names, cross-project draft create/move), web/tests/**, test/** for new web tests.
Do not touch: panel/** (another worker is rebuilding the extension in parallel), web/public/sw.js, web/server/auth.ts, the login form and service-worker registration code added by #47 (keep them exactly working), /workspace/.openchamber-data/**, /workspace/releases/**, /workspace/config/**, the live server.
Tests: npm run typecheck ; npx tsc -p web/tsconfig.json ; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs ; node --test web/tests/*.test.mjs ; node --test --test-concurrency=1 test/*.test.js
Setup: ln -s /workspace/extensions/github-task-board/node_modules node_modules
Git: commit locally in small verified steps. Do not push, merge or deploy.
</env_preflight>

<goal>
On the web board and installed phone app, looking at tasks is simple and matches the extension: one View picker, one Filter control and one Sort control; a Simple list with the Draft filter is a quick-capture list; repos show short project names. It must feel great on a phone first.
</goal>

<context>
User's words (paraphrased): on the phone, wants different ways of viewing plus filters instead of presets; "view, filter (human tasks, questions, status, etc.) and sort (priority, recency, etc.). Needs to be super user friendly yet configurable." Loves the extension's Human Tasks view - offer it as "Pending items". Quick draft list like a minimal to-do app (reference: a plain list, one line per item, an add row at the bottom): title, optional description line under it, reorder easily. The description is inspiration for the AI, not a formal spec. In All Projects, each draft shows which project it belongs to and lets you pick it. Long repo names are hard to read: "Task Board" instead of "Workflows-Accelerator/openchamber-github-task-board".
Decisions and exact shared contracts (short-name rule, draft order marker, defaults): /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md - follow the "Shared contracts" section exactly. The extension implements the same contracts independently; implement them in web/ (do not import from panel/).
Align Drafts must NOT appear on the web board (D42).
Existing web features to keep working: task drawer from #46 (friendly titles, checklists, inline question answers, status/Mark done), offline quick-add queue (localStorage key openchamber_offline_drafts, (offline) badge, auto-sync), repository picker / All Projects, refresh and freshness, conflict-safe edits.
</context>

<scope>
1. Toolbar: View (Simple list [default], Cards, Kanban board, Graph, Pending items), Filter (Needs me, Human tasks, Questions, each stage, project - active filters shown as removable chips, one Clear), Sort (Priority, Recently updated, Recently created, Manual order). Compact on phones (bottom sheet or popover, >=44px targets, safe-area), remembered per device, defaults per contract. Graph may be a simple readable dependency/sub-issue list-tree on phones if a full graph does not fit - say what you chose.
2. Simple list + Draft filter: add row at the bottom (Enter creates a status:draft issue, never starts an agent; optional description line), inline edit title/description, project picker per row in All Projects (moving a draft to another repo = create in target + close source with a link comment, only after create succeeds; say if you choose differently and why), drag reorder with touch support plus up/down buttons for accessibility, persisted with the board-order marker. Offline drafts appear in this list with the (offline) badge and keep working.
3. Short names everywhere a repo shows; full owner/repo on long-press/tooltip. Rename overrides stored server-side in a small JSON file next to the board's data (no board.env edit), with a simple rename UI in a settings sheet. Requires sign-in; validate input; no path injection.
4. Hidden order marker never rendered in drawer/body views.
</scope>

<criteria>
- Tests: short-name rule (incl. Task Board example), order-marker parse/write/midpoint, filter+sort combos, draft create/edit/move/reorder routes (mocked GitHub), rename storage and validation, Align Drafts absent, #47 login/sw tests still pass.
- All suites pass, both typechecks exit 0, server bundle builds.
- Screenshots at 390x844 (phone) and 1280x800 of each view and the draft list via Playwright/Obscura against a locally started server with mocked GitHub data, saved to /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/verifications/screenshots/issue-48-web-*.png. If not feasible, say so plainly.
</criteria>

<output>
STATUS, files changed, commit SHAs, test counts, exit codes, screenshot paths, removed UI and where it went, and a hostile self-review (two devices reordering, offline + reorder, moving a draft between projects failing halfway, long names on a 360px screen, empty states, keyboard and screen reader). List anything not verified.
</output>
