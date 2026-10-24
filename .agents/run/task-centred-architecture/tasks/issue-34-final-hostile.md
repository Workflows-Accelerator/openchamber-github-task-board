<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity. Base dd5cb2f; builder 309f9f1; reviews 7accbf8 + ef9710b; remediation commit = HEAD at dispatch (manager fills in). No other worker owns this worktree at dispatch.
Owned: review/proof only: .agents/run/task-centred-architecture/outputs/issue-34-final-hostile.md and verifications/issue-34/. No product edits.
Tests: node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Root node_modules symlink. Disposable probes under /tmp/opencode.
Do not touch web/**, service/**, shared skills/config, credentials, opencode.db, installed extension, real GitHub, master, other worktrees. No push, merge, issue closure, deployment.
Preflight authoritative; targeted checks for commit verification only.
</env_preflight>
<goal>
One bounded, final hostile pass: prove or disprove that all seven findings are closed and nothing new broke.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-remediation-dispatch.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-answer-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not write this. Review the remediation diff (ef9710b..HEAD) and re-run every reviewer probe. For each of the seven findings: confirm red-before (on 309f9f1) and green-after with your own run.
Rule to enforce: only a definitive pre-commit rejection may roll back and say "failed"; any failure possibly after send (5xx, gateway, parse, timeout, abort, readback) is UNKNOWN, never rollback-as-truth, never auto-repeated. After UNKNOWN the issue is visibly unconfirmed and dependent writes are blocked until a successful refresh.
Also attack: the unconfirmed marker clears only on a real reconciling read; blocked writes cannot be bypassed via another entry point (drawer, card, dependency, checkbox); typed answer survives refusal in all three entry points; exactly one request per click including Enter key; a throwing notification cannot change the verdict; #36 human-close guards untouched; no new identity/hash scheme.
Fix nothing. Rank only real findings with file:line, input, observed result, minimum correction.
</scope>
<criteria>
Spec Compliance PASS/PARTIAL/FAIL; Quality APPROVED/NEEDS-FIXES. Per-finding closed/open table. Full suite, typecheck, build, bundle parity reproduced. Installed-host E2E stays NOT RUN unless actually executed.
</criteria>
<output>
Commit the report only. Return at most 12 lines: verdicts, per-finding table summary, new findings ranked, test counts, bundle sha256, commit, actual provider/model. Never merge or close #34.
</output>
