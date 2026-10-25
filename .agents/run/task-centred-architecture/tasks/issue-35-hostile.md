<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh
Branch fix/issue-35-write-refresh; candidate 6b4032d, clean at dispatch. Base 12cb9c6 on feat/v2-binding-and-ratelimit (merged #28, #36, #34). No active worker.
Key paths panel/main.ts (admission helpers, fetchAllProjectIssues, listed mutation handlers, creation paths), panel/main.js (generated), test/issue-35-write-refresh.test.js, test/test-app-harness.js, verifications/issue-35/**.
Commands node --test test/issue-35-write-refresh.test.js; npm test; npm run typecheck; npm run build. Root dependencies via existing node_modules symlink; no installs.
Own writes only .agents/run/task-centred-architecture/outputs/issue-35-hostile.md and verifications/issue-35-review/**. Product/tests read-only; disposable probes under /tmp/opencode.
Do not touch web/**, service/**, panel/core.ts, shared skills/config, credentials, real GitHub, installed extension, other worktrees, master, push/merge/deploy/closure. No env copy. Preflight authoritative; skip initial git status/pwd/ls discovery, targeted commit/action-failure checks allowed.
</env_preflight>
<goal>
Give an independent hostile verdict on whether every board write the panel offers survives an older refresh, without regressing the earlier answer, freshness and human-only-Done guarantees.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-35-refresh-write-coverage.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-28-fix-adjudication.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review-8625b0a.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-34-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh/.agents/run/task-centred-architecture/outputs/issue-35-fix.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not implement this. Fix nothing. Read the entire 12cb9c6..6b4032d diff including tests; distrust every builder claim of coverage.
Independently reproduce the three target defects against the base and the candidate using the synthetic host harness with deterministic deferred barriers, not sleeps: (1) created issue dropped when a pre-create full refresh publishes, both creation paths; (2) archive, tag add, tag remove, priority, status-none and complexity label writes regressed by a pre-edit snapshot; (3) All Projects aggregate refresh clobbering a successful local write.
Then attack beyond the listed cases:
- Repository-qualified identity: equal issue numbers in two repositories must never share protection or pin each other; repo switching mid-write must not transfer protection.
- Superseded/obsolete epochs, incremental versus full snapshot ordering, refresh failure, partial aggregate with one repository rejecting, empty completed snapshot, and repeated refresh loops must not silently drop a confirmed local issue or field.
- Tracker settlement: rejection, thrown exception, hang and post-send ambiguity must settle; unclosed trackers must not pin forever or leak. Check the tracker cap and eviction interaction with pinned records.
- Interaction with #34: an UNKNOWN answer write marks the issue unconfirmed and blocks dependent writes; verify #35 did not bypass or weaken that. A dependent label/status write during an unconfirmed state must not be silently admitted.
- Truthfulness of failure restoration: the new handlers roll back displayed labels/state on error. Determine whether a post-send failure (network drop, 5xx, timeout, redirect-refused write) can now be displayed as a definite failed/rolled-back write when the server may have committed. If so, that is a real ambiguity misreport, not a stylistic nit. State severity and minimal correction; do not demand an atomic-GitHub guarantee.
- Creation path: repo attribution uses repoForIssue(created) fallback; check a created issue never lands in the displayed repository when the API response names another, and that it is not duplicated by a later snapshot.
- All Projects aggregate: per-repository cache writes, watermarks and the combined cache must stay consistent; a repository that fails must not look empty, and stale per-repo caches must not resurrect deleted issues.
- Rebuild parity and no other write path left unprotected: inventory every local mutation the panel offers and state explicitly which are covered, which are unchanged and why that is correct.
Do not invent new features, do not propose a second admission system, and do not edit shared panel/core.ts. Synthetic fixtures only; no real GitHub writes.
</scope>
<criteria>
Two verdicts: Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES. Per-defect table with exact probe input, observed result on base and candidate, and the file:line involved. Any newly discovered defect ranked with severity, concrete reproduction and minimal correction. Full targeted and full suite, typecheck and bundle parity reproduced yourself, with counts and hash. State explicitly what is NOT proven: installed-host behavior, real GitHub network races, real-time UI behavior.
</criteria>
<output>
Commit report/proof only. Return <=12 lines: verdicts, three-defect result, ranked new findings, test counts, bundle hash, report commit, blind spots, actual provider/model. No product fix, no merge/push/closure/deploy.
</output>
