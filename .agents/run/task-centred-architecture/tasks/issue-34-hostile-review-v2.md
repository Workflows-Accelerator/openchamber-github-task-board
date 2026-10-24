<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity; base dd5cb2f; builder commit 309f9f1. Server restarted after dispatch; manager checked: HEAD still 309f9f1, no uncommitted changes, no earlier review report present, so the previous review child produced nothing durable. No active worker owns this worktree.
Owned: review/proof only under .agents/run/task-centred-architecture/outputs/issue-34-hostile-review.md and verifications/issue-34/. Read application/test source; no fixes.
Tests: node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Existing root node_modules symlink. Synthetic harness probes allowed; disposable files under /tmp/opencode.
Do not touch web/**, service/**, shared skills/config, credentials, opencode.db, installed extension, real GitHub, master or other worktrees. No push, merge, issue closure, deployment or live issue writes. Do not weaken tests.
Preflight authoritative; skip startup discovery. Targeted checks allowed for action failure or commit verification.
</env_preflight>
<goal>
Independently prove or falsify the #34 answer-integrity fix at its real failure boundaries.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-answer-integrity.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-recovery.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-answer-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent of the builder. Review diff dd5cb2f..309f9f1, not only tests/report. Reproduce the claimed red-before/green-after evidence. Inspect every call site of changed reloadIssueBeforeMutation and updateIssueBody: a shared helper can regress non-answer edits.
Verify exact source-question matching including Markdown link destinations, case, punctuation; duplicate unresolved questions refuse; completed vs unresolved indexing cannot misattach. Changed, withdrawn and already-answered questions must refuse and show current text. Check all three UI entry points and whether a typed answer survives a refusal.
Verify ambiguous outcomes: response headers received then body read fails; SDK/proxy 5xx after a committed write; transport timeout after send and failed readback. Do NOT accept status>=400 or matching error text as proof of rejection when the request may already have been applied. No automatic repeat. A locally restored old body is not authoritative after an ambiguous commit; it must be visibly unconfirmed or reconciled before further dependent writes. Check caller catches, refresh races and double-click paths for a false success.
Confirm no label/phase/status change and #36 human-close guards untouched. Owner accepted the #31 limit: an identical delete-and-re-ask wholly between observations may be missed; absence of a generation/revision store is future scope, not a bug in this bugfix.
Report only real findings with exact file:line, concrete input/interleaving, observed behavior, severity and minimum correction. No product edits.
</scope>
<criteria>
Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES. Reproduced test counts and bundle parity. Synthetic DOM harness is not installed-host proof; installed-host E2E remains NOT RUN. Human validation remains pending.
</criteria>
<output>
Write/commit only the review report. Return at most 12 lines: verdicts, ranked findings, reproduced counts, bundle parity, unverified items, commit, actual provider/model. Never close #34 or merge.
</output>
