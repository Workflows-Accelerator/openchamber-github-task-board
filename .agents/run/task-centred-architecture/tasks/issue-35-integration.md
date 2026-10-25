<env_preflight>
BLOCKED DRAFT. Dispatch only after ses_efe868d487a6439e5ba4bfc5 returns Spec PASS and Quality APPROVED and manager inspects reviewed diff/report. Fill source/report HEAD, integration HEAD and clean state then. A failed bounded re-review must return to owner, not use this release brief.
Repo /workspace/extensions/github-task-board
Dispatch worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh, branch fix/issue-35-write-refresh, reviewed source FILL_AT_DISPATCH (product0af35ae).
Root integration feat/v2-binding-and-ratelimit, HEAD FILL_AT_DISPATCH; all owned tracked state must be clean. Unrelated/private untracked files not owned: .agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs, .agents/run/task-centred-architecture/outputs/{deployment-preflight-private,devops-board-deployment}.md, tasks/issue-34-hostile-review.md. NEVER stage/read/delete/copy them. Never git add -A.
Root dependencies already present. Tests node --test test/issue-35-write-refresh.test.js test/current-board.test.js test/issue-34-answer-integrity.test.js test/autonomous-closure.test.js; npm test; npm run typecheck; npm run build.
No master/credentials/installed extension/real GitHub writes/shared config/skills/unrelated worktrees/reset/rebase/force/deployment/closure. Feature push manager-only. Do not remove this worktree from inside itself.
Preflight authoritative; targeted root/source checks immediately before merge are required to detect concurrent branch or dirty-state changes.
</env_preflight>
<goal>
Integrate the accepted write-refresh correction into the working review branch and prove the merged tree without changing product behavior.
</goal>
<context_files>
Manager review gate FILL_AT_DISPATCH: .agents/run/task-centred-architecture/outputs/issue-35-review-gate.md in root.
Independent report FILL_AT_DISPATCH: .agents/run/task-centred-architecture/outputs/issue-35-correction-hostile.md in source worktree.
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Keep session located in source worktree; run root merge/tests using explicit workdir. Confirm source tip matches accepted review, root on integration and tracked clean. Unexpected dirt/branch/source/remote movement => STOP, never overwrite.
2. Merge --no-ff fix/issue-35-write-refresh into feat/v2-binding-and-ratelimit. Conflicts outside generated panel/main.js => STOP/report; generated-only conflict may use legitimate fresh build. No source fix, no rebase/reset/force.
3. Reproduce focused regressions, full suite, types, build, generated panel bundle parity/hash. Preserve #28/#34/#36 proof. Check no unexpected tracked diffs. Any failed test => STOP with exact failure, no product patch.
4. Own root outputs/issue-35-integration.md and verifications/issue-35-integration/** only. Report merge/proof commits, test counts/commands/exits/hash, conflicts, scope and blind spots. Stage explicit proof paths only and legitimate generated bundle if required; commit release proof. Do not modify manager mission/tasks/continuation.
5. No push, PR, issue edits, Done or cleanup. Manager accepts proof then pushes review branch and removes/prunes source worktree after confirming all reports preserved. Local feature branch retained by portfolio policy; no remote deletion. DB deregistration only if registered and after separate authorised cleanup.
</scope>
<criteria>
Reviewed source ancestry present in working branch; merged focused/full/types/build green and bundle parity real; private/unrelated files untouched; accepted report/proof preserved before teardown. L5 remains pending, no master/deploy/closure.
</criteria>
<output>
At most10 lines: merge/proof commits, conflicts, counts/exits/hash/parity, tracked state/untracked preserved, actual provider/model, blind spots. Stop on failure; no cleanup from this worktree.
</output>
