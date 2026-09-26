<goal>Build the three simplified views in the github-task-board panel — Human Tasks, All Tasks, Questions — friendly-title-first, fast to scan for intake, on top of the contract v1 extraction API, without touching the contract's own frontier files.</goal>
<context_files>
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/issue-body-contract-v1.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/decisions.md
/tmp/opencode/issue-lifecycle-explore-board/.agents/run/board-lifecycle/explore/board-map.md
/tmp/opencode/issue-lifecycle-issue-views-v1/docs/issue-body-contract.md
/tmp/opencode/issue-lifecycle-issue-views-v1/panel/core.ts
/tmp/opencode/issue-lifecycle-issue-views-v1/panel/main.ts
/tmp/opencode/issue-lifecycle-issue-views-v1/panel/index.html
/tmp/opencode/issue-lifecycle-issue-views-v1/test/layout-and-views.test.js
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/build/domain/frontend-ui-engineering/SKILL.md
/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md
/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md
</skills>
<scope>Code changes only in /tmp/opencode/issue-lifecycle-issue-views-v1 (github-task-board repo, branched from the contract work). Files you own: panel/main.ts (render/state for the new views only), panel/index.html (markup + styles), test/** (new + updates), panel/main.js (regenerate via the repo build script only). Files you must NOT touch: panel/core.ts, panel/labels.ts, panel/types.ts, docs/issue-body-contract.md — the contract layer is under hostile review on its own branch and your merge will be reconciled later; if you need a change there, report it instead of making it. Never push.</scope>
<criteria>Three view modes render correctly from real issue state and honor existing filters; Human Tasks view renders collectHumanTodos output per needs-human issue with working checkbox write-back through the existing checkbox mutation path; All Tasks view shows friendly titles only (no technical titles except at most a quiet mono subtitle) grouped by status with counts; Questions view lists every unanswered open question across all statuses grouped by issue; empty states are clear and quiet; keyboard accessible; no emoji in UI copy; full suite green and bundle regenerated; visual hierarchy is clean and generous (this must look considered, not bolted on); every claim in the summary carries a file:line anchor.</criteria>
<steps>
<step>Baseline: run the full suite (node --test test/*.test.js) and record counts (213 passing expected). Read docs/issue-body-contract.md sections 2-4, the board-map.md view/render architecture section, and the existing render pipeline (renderViews, renderListView, renderKanbanView, updateViewModeButtons, the #viewModeGroup switcher in index.html) before designing anything.</step>
<step>File one GitHub issue for this work via the REST API (token extracted from /workspace/.git-credentials — never print or commit it) against Workflows-Accelerator/openchamber-github-task-board: "feat(board): Human Tasks, All Tasks, and Questions views", body following the contract (### Friendly Title:, Overview, ### Acceptance Criteria: checklist mirroring this brief's criteria). Record the number for commits.</step>
<step>Design the three views on paper first (a short section in your final report): layout, grouping, density, what each click does. Then TDD: pure render-helper functions tested DOM-free where possible (follow test/layout-and-views.test.js patterns), then wiring.</step>
<step>Human Tasks view: one section per needs-human issue showing its collectHumanTodos items (source badges: human-task / open-question / session-waiting). Toggling an item goes through the existing checkbox write-back path used by the drawer checklists so GitHub is updated and the body stays canonical. Clicking the issue opens its drawer. Group by repository when in all-projects mode.</step>
<step>All Tasks view: every issue, friendly title only, grouped by the eight status columns with per-group counts, honoring the existing filter machinery (search, repo, label, status tabs). Fast intake: no subtasks, no checklists, no chrome beyond the title, a quiet status marker, and the minimum needed to filter.</step>
<step>Questions view: every unanswered Open Question in any status, grouped under its issue's friendly title; answering/toggling uses the existing question mutation path; clicking through opens the drawer at the questions section.</step>
<step>Visual bar: generous whitespace, comfortable type scale for friendly titles, subtle mono for meta, sticky group headers, obvious checkbox affordance, quiet empty states ("Nothing is waiting on you" style copy, no emoji), consistent with the panel's existing CSS variables and theme handling. Do not restyle the existing views in this pass.</step>
<step>Watch performance: render the new views from the same cached state as the others; do not add extra fetches per render; do not worsen the filed re-render/focus issue (#19) — if a new view would re-render on every streamed page, throttle the same way the existing views do or better.</step>
<step>Run typecheck, full suite, regenerate panel/main.js via the repo build script, confirm shipped-parity passes. Then hostile self-review of your diff: what happens with zero issues, 500 issues, issues with no friendly title, all-projects mode, filters that match nothing mid-typing, rapid view switching, checkbox toggles racing? Fix what you find in scope; note the rest.</step>
<step>Commit in logical commits referencing the filed issue number. Nothing is pushed.</step>
</steps>
<output>Return a structured block: status; results (new view modes and render functions with file:line, filed issue number); evidence (test names first written, then full-suite counts, build result); learnings (UX and integration risks the manager must weigh before merge).</output>
