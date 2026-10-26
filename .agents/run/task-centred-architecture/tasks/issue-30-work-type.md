<env_preflight>
Panel frontier is free: #35 is PARKED (recheck HALT, candidate 3b4eced unaccepted and unmerged), so panel/** and the issue templates are at the review-branch state. #37 owns web/** in its own worktree and the supervisor build is in another repository: no file overlap with this slice.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type
Branch feat/issue-30-work-type; base c337901a81d5eca08ea39372ed49a3e55be0b79e on feat/v2-binding-and-ratelimit, tracked-clean, node_modules symlink already created to the installed root dependencies. No other worker owns panel/**, .github/ISSUE_TEMPLATE/** or docs/issue-body-contract.md at dispatch.
Key paths: panel/core.ts (resolveIssueSkills label routing, issue prompt text, issue template constants), panel/main.ts only where it composes those prompts (no admission or refresh logic), .github/ISSUE_TEMPLATE/** if present, docs/issue-body-contract.md, test/** for prompt/template contract tests, generated panel/main.js.
Tests: node --test test/issue-30-work-type.test.js (create it); npm test; npm run typecheck; npm run build (regenerates panel/main.js — commit it). Verify the new contract tests fail on base c337901 before your change (run them in a scratch copy or with the change reverted), then pass after.
Root dependencies via the existing node_modules symlink; no installs, no env copy, no DB registration.
Do not touch web/**, service/**, the #35 admission/tracker helpers, shared skills/config, private reports, credentials, real GitHub, installed extension, other worktrees, master, deployment. No push/merge/close/deploy. Synthetic fixtures only.
</env_preflight>
<goal>
The board's own work instructions pick one work type from the existing label and record why, so bug work and feature work follow proportionate paths without a second source of truth.
</goal>
<context_files>
GitHub issue: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/30 (read with gh issue view; do not edit or close it)
<file path=.agents/run/task-centred-architecture/decisions-2026-10-24.md>
Decision 4 is binding: existing `bug` / `enhancement` labels are the single source of bug versus feature, plus one justification sentence in the Work Log. No body field, no `type:*` label.
</file>
<file path=.agents/run/task-centred-architecture/outputs/issue-30-31-correction-ruling.md>
Accepted constraints from the failed design review. Read it before proposing anything about history, counters, or notification detection; none of that is in scope here.
</file>
</context_files>
<scope>
1. Audit first, then implement only the gaps. Existing code already routes bug/feature prompts by label through resolveIssueSkills and already asks for reproduction in the issue prompt. Report a short gap table: requirement, current state (exists / partly / missing), file:line. Do not rewrite working instructions you cannot show are inconsistent.
2. Work type from the label. The work instructions must state, once and unambiguously: `bug` and `enhancement` are the only work-type source; when both or neither are present the work type is undecided and must be asked about, not guessed; never infer a type from the title, the mood of the report, or the area of the code.
3. Work Log justification. Add exactly one required sentence to the Work Log contract: which work type applies and the concrete reason for it (for example the observed behaviour that contradicts a stated expectation, or the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.
4. Proportionate paths, stated briefly. Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review. Feature path: desired outcome, research and alternatives, user decisions, then implementation. Both paths keep existing evidence rules and existing human authority over release and closure; do not add or duplicate that guard.
5. Questions. Only block work that depends on the unanswered question; independent authorised work continues. Undecided work type is an alignment question to the user, not a default.
6. Bug template. If .github/ISSUE_TEMPLATE contains a bug template, make sure it asks for observed versus expected behaviour and reproduction, and that it does not add a second work-type field. Change nothing cosmetic.
</scope>
<criteria>
Prompt and template changes are covered by contract tests that fail before and pass after, asserting the required instructions exist and that no `type:*` label or body work-type field was introduced. Existing label routing behaviour is unchanged except where the audit proves it contradicts decision 4. `npm test`, typecheck and build green, generated bundle fresh. No change to write admission, refresh publication, answer handling, Done guard or repository selection.
</criteria>
<must_not_do>
Do not interpret, implement, schedule or imply "expiration" of bugs. Its meaning is still unconfirmed by the owner. That stays an open question on the issue and must never become deletion, closure, scheduling or auto-expiry.
Do not create labels, rename labels, migrate backlog issues in bulk, or edit any real GitHub issue.
Do not add a second source of truth for work type.
</must_not_do>
<output>
Commit the slice and tests on the feature branch. Report: the audit gap table, files changed, red-before and green-after commands with exit codes, test counts, bundle hash, what remains an open owner question, blind spots, actual provider/model. Return at most 12 lines. Independent hostile review follows; do not self-approve.
</output>
