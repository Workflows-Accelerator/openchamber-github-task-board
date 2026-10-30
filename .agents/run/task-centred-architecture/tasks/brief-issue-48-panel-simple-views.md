<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views
Branch: feat/issue-48-panel-simple-views (from master @ cc08379, clean)
Issue: #48 https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/48 (this brief covers the OpenChamber extension part only)
Files in scope: panel/** (main.ts, core.ts, index.html, types.ts, utils.ts, labels.ts, markdown.ts, dropdown.ts, built panel/main.js), test/** for panel tests, and a new shared pure module if useful (for example panel/shortname.ts) that has no DOM dependencies so the web board can copy or import it later.
Do not touch: web/**, service/opencode config, /workspace/config/**, secrets. Another worker is changing web/** in parallel.
Tests: npm run typecheck ; npm run build:panel ; node --test --test-concurrency=1 test/*.test.js ; node --test test/shipped-parity.test.js
Setup: ln -s /workspace/extensions/github-task-board/node_modules node_modules
Git: commit locally in small verified steps. Do not push, merge or deploy.
</env_preflight>

<goal>
In the OpenChamber task board extension, looking at tasks is simple: one View picker, one Filter control and one Sort control replace today's view buttons, status tabs and presets; a Simple list with the Draft filter is a quick-capture list; repos show short project names.
</goal>

<context>
User's words (paraphrased): too many views and tabs (attention, human tasks, questions, board, list, graph) and some views have their own filters, it's a mess. Wants "view, filter (human tasks, questions, status, etc.) and sort (priority, recency, etc.). Needs to be super user friendly yet configurable." Loves today's Human Tasks view - keep its feel as the "Pending items" view. Quick draft list like a minimal to-do app: one line per item, optional description line under it, add at the bottom, reorder easily. The description is inspiration for the AI, not a formal spec. Long repo names are hard to read; wants "Task Board" instead of "Workflows-Accelerator/openchamber-github-task-board".
Decisions and the exact shared contracts (short-name rule, draft order marker, default state): /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md - follow the "Shared contracts" section exactly; the web board will implement the same contracts.
Current code: panel/index.html ~3547-3640 (view select popover + view-mode buttons), ~3780 (status tabs); panel/main.ts renderListView 3845, renderKanbanView 3946, renderHumanTasksView 4202, renderQuestionsView 4852, renderAttentionView 5211, renderGraphView 6120.
Align Drafts stays in the extension (keep the #46 spinner/toast behaviour).
</context>

<scope>
1. Toolbar: View picker (Simple list [default], Cards, Kanban board, Graph, Pending items), Filter control (multi-select chips/popover: Needs me, Human tasks, Questions, each stage, project; active filters visible as removable chips; one "Clear"), Sort control (Priority, Recently updated, Recently created, Manual order). Remove the status tab strip and the duplicated view-mode button group and presets. Every view respects the same filter and sort. State remembered per workspace/device; defaults per contract.
2. Reuse existing renderers where possible (Kanban, Graph, Human tasks -> Pending items, current list -> Cards); the Attention and Questions views become filters (Needs me / Questions) rather than separate views - make sure nothing they showed becomes unreachable (questions must still be answerable).
3. Simple list: minimal rows (checkbox-free title line, optional muted description line, short project name pill in All Projects, status dot). With the Draft filter on: an always-visible add row at the bottom (Enter = create draft as status:draft without starting any agent session, Shift+Enter or a toggle = add description), inline edit of title/description, project picker per row in All Projects, drag-and-drop reorder plus keyboard reorder (Alt+Up/Down) persisted via the board-order marker contract. Optimistic UI with rollback + toast on failure.
4. Short project names everywhere a repo name is displayed (cards, pills, pickers, headers, toasts) using the contract rule; full owner/repo as tooltip. Rename: a small "Project names" section in existing settings stores overrides in extension settings/storage.
5. Hidden marker never renders in issue body views.
</scope>

<criteria>
- Unit tests: short-name rule (incl. the Task Board example and edge cases), order-marker parse/write/midpoint, filter+sort combinations, default state.
- All existing tests pass (update tests that asserted removed tabs/buttons, do not delete coverage silently - list each changed test and why), typecheck exit 0, panel bundle builds.
- Capture screenshots of each view and the draft list (Playwright/Obscura against the built panel if feasible) into /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/verifications/screenshots/issue-48-panel-*.png; if not feasible, say so plainly.
</criteria>

<output>
STATUS, files changed, commit SHAs, test counts, typecheck/build exit codes, screenshot paths, list of removed UI elements and where their function went, and a hostile self-review (reorder races, two devices reordering, drafts with no description, very long names, empty states, keyboard access). List anything not verified.
</output>
