<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch fix/issue-34-answer-integrity, HEAD 7f7e8cc clean; product a8f55c2. Prior final review 72f3f76 seven findings PASS, followed by draft isolation FAIL 7f7e8cc. No active worker. Key paths panel/main.ts draft helpers and three question UIs; test/issue-34-answer-integrity.test.js and test/test-app-harness.js; generated panel/main.js. root node_modules symlink already present.
Commands node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. No installs.
Do not touch web/**, service/**, panel/core.ts, shared skills/config, credentials, real GitHub, installed extension, other worktrees, master, push/merge/closure/deployment. No env copy or DB access. Synthetic fixtures only.
Preflight authoritative at startup, skip git status/pwd/ls discovery. Targeted mutation/commit verification allowed.
</env_preflight>
<goal>
Keep answer drafts recoverable without ever attributing them to another repository or another source question.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/final-review-rulings-2026-10-25.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-draft-isolation-check.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/verifications/issue-34-draft/draft-isolation-probe.test.js]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-final-hostile.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Owned panel/main.ts only draft helpers/calls/three answer views and removal of collateral renderer assignments; panel/main.js fresh build; focused tests/harness minimal changes; .agents/run/task-centred-architecture/outputs/issue-34-final-draft-correction.md and verifications/issue-34-final-draft/**.
Owner decision14 authorizes exactly this final focused pass:
1. Keys include repoForIssue(issue), number, exact source question text. No issue-number fallback. If repo unknown, do not guess a repository or cross-attach a draft.
2. Draft only prefills the EXACT question it was typed for in that repo. Never auto-reassign to a changed/replaced question, even when only one open question exists. Reviewer single-question fallback proposal is rejected.
3. After refusal due to changed/deleted/already-answered source, show draft separately and clearly labelled with its ORIGINAL question on the same repository issue, including when zero current questions remain. Keep current question input empty. Let user select/copy recoverable draft; explicit discard removes ONLY that original draft. No automatic submission or new storage/history architecture. Minimal reusable UI for three existing entry points, no feature expansion.
4. Cancelling/completing Q2 or another repository cannot delete Q1/A draft. Emptying a field must not resurrect an older cached draft. Preserve drafts across refusal re-renders in all three UIs. Duplicate exact current questions remain ambiguous; refuse to guess rather than falsely claim identity.
5. Remove added userLayoutPreference and data-layout assignments inside renderHumanTasksView/renderQuestionsView; view selection remains owned by normal toolbar/layout control. Fix tests to invoke/select normal paths rather than modifying product renderers for test convenience. Do not overclaim prior direct-call side effect as proven production user regression.
Regression tests FIRST: use focused review probes as defect inputs but turn assertions into desired behavior. Cross-repo same-number same/different questions; Q1/Q2; cancel/success isolation; changed/deleted source draft visible/recoverable labelled with original text; three entry points; no-questions rendering; clearing an input. Capture red-before against 7f7e8cc and green-after. Existing Test18 expects changed-text prefill: update that obsolete expectation per decision14 and record why, preserving original-answer draft recovery requirement rather than weakening it.
Preserve all seven prior fixes: UNKNOWN semantics and unconfirmed locks, no auto repeat, double-click guard, exact answer targeting, notification boundary, dependency result guards, human-only Done. No hash/generation/new persistence system. If genuine fork beyond approved behavior appears, stop with report.
</scope>
<criteria>
Empirical red/green on specified cases. No draft leakage, accidental deletion, stale reassignment or loss on refusal. Same-repo original draft remains selectable/copyable after source removal and all three views. Exactly one write on explicit confirmed action. Full suite/typecheck/build green; bundle deterministic. Independent final check follows; this is last authorized correction round, not a loop.
</criteria>
<output>
Commit product/tests/report on feature branch. <=12 line return: commit, cases red/green and paths, changed-file scope, tests/typecheck/build counts, bundle hash, remaining blind spots, actual provider/model. No merge/push/close/deploy.
</output>
