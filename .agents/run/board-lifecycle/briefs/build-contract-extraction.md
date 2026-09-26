<goal>Implement Issue Body Contract v1 in the github-task-board extension: the `### Human Tasks:` parser and `collectHumanTodos` extraction, the D3 status-semantics change (review = AI step; idle sessions land in needs-human), the canonical contract doc, and the AI prompt update — all behind tests, with the shipped bundle regenerated.</goal>
<context_files>
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/issue-body-contract-v1.md
/workspace/extensions/github-task-board/.agents/run/board-lifecycle/decisions.md
/tmp/opencode/issue-lifecycle-explore-board/.agents/run/board-lifecycle/explore/board-map.md
/tmp/opencode/issue-lifecycle-issue-contract-v1/panel/core.ts
/tmp/opencode/issue-lifecycle-issue-contract-v1/panel/labels.ts
/tmp/opencode/issue-lifecycle-issue-contract-v1/panel/types.ts
/tmp/opencode/issue-lifecycle-issue-contract-v1/test/
</context_files>
<skills>
/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md
/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md
/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md
</skills>
<scope>Code changes only under /tmp/opencode/issue-lifecycle-issue-contract-v1 (github-task-board repo): panel/core.ts, panel/types.ts, panel/labels.ts, the DEFAULT_AI_ISSUE_PROMPT region of panel/main.ts, panel/main.js (build artifact — regenerate via the repo build script, never hand-edit), test/**, and docs/issue-body-contract.md (new). Do NOT touch render/view code paths in main.ts (renderViews/renderListView/renderKanbanView/renderGraphView/renderIssueCard/index.html) — a follow-up issue builds the views on top of your API. Never push.</scope>
<criteria>Spec sections 2.6, 3, 4 are implemented exactly; new tests fail against the old code and pass against the new; the full suite (node --test test/*.test.js) is green from a clean checkout state; the rebuilt panel/main.js passes shipped-parity; DEFAULT_AI_ISSUE_PROMPT instructs the exact section spellings and test/ai-prompt.test.js asserts them; every claim in the summary carries a file:line anchor.</criteria>
<steps>
<step>Baseline: run node --test test/*.test.js and record counts (explorer measured 202 passing). Read the contract spec and board-map.md sections on the issue-body contract, StatusReconciler, and the build pipeline before editing.</step>
<step>File one GitHub issue for this work via the REST API (token extracted from /workspace/.git-credentials — never print or commit it) against Workflows-Accelerator/openchamber-github-task-board: title like "feat(board): Human Tasks contract, human to-do extraction, and status semantics v1"; body following the contract itself (### Friendly Title:, Overview, ### Acceptance Criteria: checklist covering the criteria above). Record the number for your commit messages.</step>
<step>TDD, one red-green loop per behavior: (a) parseHumanTasks(body) parses unchecked and checked checkboxes under exactly `### Human Tasks:` (reuse the existing section-matching style of parseOpenQuestions, core.ts:136-173; accept the same heading spellings family and no others); (b) collectHumanTodos(issue, session) implements spec section 3 — explicit items first, fallback to open questions, then one synthesized session-waiting item; dedupe; preserve order; (c) the Issue type exposes the parsed human tasks alongside subtasks/queries.</step>
<step>TDD the semantics change (spec section 4): the idle-session transition now resolves an issue to needs-human, not in-review (labels.ts:403-468 and any callers/tests that assert the old behavior); the in-review column description and its constant descriptions are rewritten so in-review means the AI self-review step and needs-human means anything awaiting a human (labels.ts:139-155). Update every test that encoded the old meaning.</step>
<step>Publish docs/issue-body-contract.md: the spec content, adapted to live in the repo (paths relative where sensible), including the section-3 extraction algorithm as pseudo-code matching your implementation exactly.</step>
<step>Update DEFAULT_AI_ISSUE_PROMPT (panel/main.ts) so agents are told to write `### Human Tasks:` with verb-first items at the moment they block on a human or hand off for validation, alongside the existing Friendly Title / Open Questions requirements. Extend test/ai-prompt.test.js to assert the new required strings and their ordering.</step>
<step>Regenerate panel/main.js with the repo's build script (package.json:16 — esbuild IIFE bundle), run the full suite including shipped-parity, and record counts.</step>
<step>Hostile self-review of your own diff: what breaks for bodies that have both Human Tasks and Open Questions? Bodies with a `### Human Tasks:` header but no items? Checked-only items? Windows line endings? Header at the very end of the body? A session object missing or null? Fix what you find; note what you do not.</step>
<step>Commit in logical commits referencing the filed issue number. Nothing is pushed.</step>
</steps>
<output>Return a structured block: status; results (new public functions with file:line, semantics changes with file:line, filed issue number); evidence (red test names first, then green counts before/after, shipped-parity result); learnings (contract edge cases and anything the spec got wrong).</output>
