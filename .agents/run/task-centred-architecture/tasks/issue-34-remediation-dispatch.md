<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity. Base dd5cb2f; builder 309f9f1; reviews 7accbf8 and ef9710b. Both reviews finished; no other worker owns this worktree.
Owned: panel/core.ts (question answer functions only), panel/main.ts (answer path, updateIssueBody/reloadIssueBeforeMutation, dependency add/remove handlers, save-button in-flight guards), generated panel/main.js, tests, .agents/run/task-centred-architecture/ report and verifications/issue-34/. Nothing else.
Tests: node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Root node_modules symlink.
Do not touch web/**, service/**, shared skills/config, credentials, opencode.db, installed extension, real GitHub, master or other worktrees. No push, merge, issue closure or deployment. Synthetic harness only.
Preflight authoritative; targeted checks allowed for commit verification.
</env_preflight>
<goal>
Close all seven independent-review findings so no answer path can show success or a definite failure when the remote outcome is uncertain, and refusing never costs the person their typed answer.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-remediation.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-answer-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Execute every item in the remediation brief exactly, test-first, including the two added by the second review: preserve the typed answer across refusal re-renders, and move post-mutation notifications outside the write's error boundary so a toast error cannot cause a false rollback. Both reviews agree on the two Criticals: (a) 5xx/gateway/parse/timeout after send is UNKNOWN, never a definite failure or rollback-as-truth; (b) a restored previous body after an ambiguous outcome is unconfirmed and must block dependent writes until a successful refresh reconciles it.
Reproduce each finding with its reviewer probe before fixing. One request per user action. No automatic retry. No new identity/hash system. No unrelated refactor. Keep #36 human-close guards.
</scope>
<criteria>
Seven findings, each with a failing-before/passing-after test. No success without confirmed apply; no definite failure when outcome may be unknown; typed answer preserved on refusal; one request per click; notifications cannot alter a write verdict. Full suite, typecheck, build green; bundle parity.
</criteria>
<output>
Commit on fix/issue-34-answer-integrity. Append a per-finding table to the report keyed to both reviews. Return at most 12 lines: commit, per-finding status, other callers fixed, red/green evidence paths, test counts, bundle sha256, remaining blind spots, actual provider/model. One final bounded hostile pass follows; no merge.
</output>
