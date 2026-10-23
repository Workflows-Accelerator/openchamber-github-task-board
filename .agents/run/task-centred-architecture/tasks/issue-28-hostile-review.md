<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board
Branch: fix/issue-28-current-board; base 7013bd9; builder completed commit 29d1634 and reports 475 tests/typecheck/build green. Verify targeted diff and current status when required, not a general discovery spin.
Files: panel/main.ts, panel/index.html, panel/main.js, refresh test changes in 7013bd9..29d1634, report and canonical issue #28.
Tests: npm run typecheck; npm run build; npm test; targeted tests from implementation report plus independent deferred-response probes.
Do not touch: application implementation (review only), service/**, secrets/credential files, opencode.db, host settings, installed extension activation, production, master, live issue mutations. Disposable browser fixtures under /tmp/opencode only. No real-token panel opening that might trigger reconciliation writes.
</env_preflight>
<goal>Conduct a hostile independent review of #28's board-refresh correction against the canonical issue and the actual shipped panel bundle.</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-28-current-board.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/outputs/issue-28-current-board.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/verify-user-workflow.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/browser/playwright-verification/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Review-only, no code fixes or merge permission. Distrust builder report and test assumptions. Inspect diff and replay shipped-bundle startup with settings same repo, reactivation, zero members, full vs incremental membership, pagination including failures/304, overlapping refresh epochs, A->B->A selection races, cache/watermark mutation, failure then retry, empty and stale notice. Check body/row/session edits while refresh in flight aren't unintentionally clobbered. Ensure request admission guards all awaited publication paths; both caches and displayed state remain repository-correct. Revalidate ordinary editing features preserved. Existing automatic reconciliation is a separate known boundary; don't claim opening is read-only. With recording fixtures assert no new unintended mutations from refresh logic. Never enable real live writes.
Exercise real browser DOM and inspect screenshots of actual built panel with deterministic recording host/network fixture if browser tool available, using no production credentials. Fixture browser proof is not authenticated installed-host E2E; state distinction clearly. Inspect desktop/narrow freshness notice, focus retention, console errors, layout and recovery. If browser unavailable record NOT RUN, do not replace with a static test claim. May write disposable probe harness and screenshots under /tmp/opencode; persistent report only in run path. Rebuild should be byte-identical; report unexpected generated drift rather than commit it.
</scope>
<criteria>
Two verdicts: Spec PASS/FAIL/PARTIAL; Quality APPROVED/NEEDS-FIXES. Severity, exact source anchors, reproducible evidence for defects. Tests/typecheck/build rerun, independent edge probes, actual visual proof where possible. No final completion, closure, master or human approval inference. If unresolved Moderate+ defects return concrete minimum remediation; stop rather than fix.
</criteria>
<output>
Commit report only .agents/run/task-centred-architecture/outputs/issue-28-hostile-review.md and canonical proof .agents/run/task-centred-architecture/verifications/issue-28/proof.md (artifact references may point to /tmp/opencode). Return <=15 lines with verdicts, findings, counts, unverified boundary, commit and actual/supplied identity. Stop for manager judgement.
</output>
