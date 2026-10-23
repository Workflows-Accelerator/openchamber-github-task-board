<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-36-autonomous-closure
Branch: fix/issue-36-autonomous-closure, created from feat/v2-binding-and-ratelimit at 9c235a9 after #28 merge 3109935; clean tracked state. Preflight authoritative at dispatch; no startup discovery, targeted checks allowed before commit or after errors/resume.
Files owned: panel/labels.ts, panel/main.ts, panel/core.ts (one prompt line only), generated panel/main.js, relevant test files, .agents/run/task-centred-architecture/ report/proof.
Tests: targeted reconciler/status/shipped-bundle suites, then npm test; npm run typecheck; npm run build. If node_modules is missing, symlink /workspace/extensions/github-task-board/node_modules. Do not copy environment files, no DB registration.
Do not touch: service/**, web/**, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, other worktrees/branches. No push, merge or close. Synthetic fixtures only.
Efficiency: locate StatusReconciler, updateIssueStatus, resolveIssueColumn with grep; read only those regions.
</env_preflight>
<goal>
Make it impossible for any automatic path to close a GitHub issue. Only an explicit human action may set an issue to closed.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/36
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/draft-issue-answer-integrity.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Confirmed defect: an agent setting phase:done or phase:archive makes resolveIssueColumn return 'done' (panel/core.ts:3339-3341, :3369-3371); for an issue with an active session, StatusReconciler (panel/labels.ts:616-640, panel/main.ts:2591-2597) calls updateIssueStatus(issue,'done'), which PATCHes state:'closed' (panel/main.ts:2114-2141). toggleArchiveIssue also closes on archive (panel/main.ts:2262).
Required:
1. Reproduce first with the existing shipped-bundle harness: an issue whose body carries phase:done (and separately phase:archive) with an attached session, run through the reconciliation path, currently produces a closure PATCH. Record the failing test output.
2. Cut every automatic closure path. The reconciler must never request 'done' and must never send state:'closed'. Prefer an explicit signal on updateIssueStatus so a closure requires a human gesture, plus a reconciler guard; choose the smallest correct combination and explain it.
3. Preserve legitimate human actions: a person moving a card to Done or using the close/archive control must still close the issue, with the same UX.
4. Do not automatically write status:done or archived labels either. Existing read-only phase projection need not change in this narrow patch, but do not add a new route by which an agent or reconciler moves an issue to Done. Preserve non-terminal automatic status reconciliation. Do not invent a new status or label. If the reported close path cannot actually be reproduced, stop and report the missing condition rather than fixing a hypothetical.
5. Guard agent instructions: add one line to the issue prompt constant stating that an agent never sets phase:done, phase:archive or status:done and never closes an issue. Keep the wording short.
6. Regressions: agent-set phase:done does not close; agent-set phase:archive does not close; a human Done action still closes; human archive still closes; existing reconciler tests still pass. Tests must fail on the pre-fix code for the automatic paths.
No unrelated refactors. If the fix requires touching a fourth function, say why.
</scope>
<criteria>
No automatic path can produce a state:'closed' PATCH; the two agent-phase regressions fail before and pass after; human closure and archive still work; full suite, typecheck and build green; generated bundle matches a fresh build; diff limited to the closure paths and the one prompt line.
</criteria>
<output>
Commit on fix/issue-36-autonomous-closure. Report .agents/run/task-centred-architecture/outputs/issue-36-closure-fix.md and proof entries under verifications/issue-36/. Return at most 12 lines: commit, exact automatic paths cut, what still closes and how, red-first evidence, test counts, bundle parity, actual and supplied model. No push, merge or close. A fresh hostile review follows.
</output>
