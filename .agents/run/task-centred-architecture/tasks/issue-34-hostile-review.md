<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity; base dd5cb2f; builder commit 309f9f1. Builder reports clean tracked state. No active worker owns this worktree. Authoritative at dispatch: skip startup pwd/ls/status; inspect targeted state only for action failures, resume or commit verification.
Owned: review/proof only under .agents/run/task-centred-architecture/outputs/issue-34-hostile-review.md and verifications/issue-34/. Read application/test source; no fixes.
Tests: node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Existing root node_modules symlink. Browser/DOM probes on synthetic host harness allowed; use /tmp/opencode for disposable probes/screenshots.
Do not touch web/**, service/**, shared skills/config, credentials, opencode.db, installed extension, real GitHub, master or other worktrees. No push, merge, issue closure, deployment or live issue writes. Do not weaken tests or manufacture proof with simulated errors not representative of actual SDK behavior.
</env_preflight>
<goal>
Independently falsify or prove the #34 fix through each actual answer entry point and failure boundary.
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
You are independent of the builder. Diff dd5cb2f..309f9f1, not just tests/report. Reproduce red-before/green-after claims. Inspect all call sites of changed reloadIssueBeforeMutation/updateIssueBody: a shared-helper change may regress non-answer edits. Test realistic SDK error objects/envelopes against actual source; harness changes cannot define the desired reality.
Check exact question source including Markdown link targets, case, punctuation, duplicate refusal, completed-vs-unresolved ordering; changed/withdrawn/already-answered questions must refuse and show current text. Probe all three UI controls and preserve typed answer on refusal if current behavior promises that. Confirm no labels/phase/status changes and #36 guards remain.
Unknown outcomes: response-header success then body-read drop, proxy/SDK 5xx after commit, transport timeout after send and failed readback. Do NOT accept status>=400 or matching HTTP text as proof of rejection: potentially post-send 5xx/parse errors are UNKNOWN unless proven otherwise. No automatic repeat. A local body restored to old data is not authoritative after ambiguous commit; it must be visibly unconfirmed or successfully reconciled before further dependent writes. Confirm false success cannot reappear via caller catches/logs/refresh races/double click.
New owner limit for #31: identical delete/re-ask entirely between observations may be missed; no generation/history guarantee. #34 narrow fix is not required to add #31 full-revision/hash storage. Record whether issue revision binding is absent as future scope, not false completed work.
Report no more than actual ranked findings. No product edits; manager will adjudicate remediation bounds.
</scope>
<criteria>
Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES. For each defect: exact file:line, concrete input/interleaving, observed output, minimum correction and severity. Full suite/types/build and byte parity verified. L3 installed host NOT RUN unless really executed; synthetic DOM harness is not installed-host proof. Human validation remains pending.
</criteria>
<output>
Write/commit review report only. Return at most 12 lines: verdicts, ranked findings, reproduced counts, bundle parity, remaining unverified, commit, actual provider/model. Never close #34 or merge.
</output>
