<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board
Branch: fix/issue-28-current-board; HEAD e3fb381 (review docs); code under repair 8625b0a; base 88d3970; tracked state clean; bundle matches a fresh build.
Files owned: panel/main.ts, generated panel/main.js, test/current-board.test.js, run report/proof only.
Tests: node --test test/current-board.test.js; npm run typecheck; npm run build; npm test.
Do not touch: other worktrees/branches (a competing fix exists in .worktrees/team-dev-issue-28-review-races — do not read it), service/**, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, root checkout. No push, merge or close. Prove with synthetic fixtures only.
Efficiency: locate the exact functions with grep (issue-write tracker map, admission/eviction, syncRepoIncremental, publishIssueSnapshot), read only those regions, then edit. Do not page through whole files.
</env_preflight>
<goal>
Close the one gating defect from the independent review of 8625b0a: the admission-record cap can defeat its own protection during a large incremental scan.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review-8625b0a.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-28-current-board/.agents/run/task-centred-architecture/verifications/issue-28/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Reviewer finding F1 (Moderate, gating): the tracker cap (400) is smaller than one full incremental scan can contain (max 1000 issues), and eviction does not spare records with a pending write. A 500-issue incremental during a paged refresh therefore evicts about 100 admissions, and an in-flight successful edit can then be clobbered in display and cache. Anchors: panel/main.ts:1440-1442, 1459-1473, 1493-1505, 1521-1529, 1587-1601, 1951-1959.
Required outcome, not a prescribed implementation:
1. Capacity is at least the maximum number of issues one repository scan can admit (the existing MAX_ISSUES_PER_REPO / 1000 page budget), with headroom for a concurrent scan; state the chosen bound and why.
2. Eviction never removes a record whose write is pending or whose settled admission is still needed by a publication in flight. If every slot is protected, decide and implement a safe overflow behaviour that keeps correctness (for example, a hard ceiling that keeps pending records and lets the oldest fully settled, already-published record go) and prove it.
3. Memory stays bounded; repository and issue keys cannot collide; a stale record still expires.
4. Add shipped-bundle regressions in test/current-board.test.js: (a) a paged full refresh plus a 500-issue incremental plus an in-flight edit keeps the edited field; (b) an in-flight write is never evicted under cap pressure; (c) an overflow of protected records does not clobber a successful edit. The suite must fail on 8625b0a for F1 before your change and pass after.
5. Do not change the reviewed behaviour that already passed: membership from completed snapshots, repository switch, empty results, superseded refreshes, watermark, failed-PATCH release. No unrelated refactors or renames.
6. If the reviewer's proposed minimum is insufficient once you simulate it, say so and implement the smallest correct alternative; explain the difference in the report.
</scope>
<criteria>
The three new regressions fail on 8625b0a for the F1 reason and pass after; a 500-issue scan during a paged refresh cannot clobber a successful edit; no admission for a pending write is ever evicted; memory bounded and stale records expire; all previous #28 tests unchanged and green; full suite, typecheck and build green; bundle matches a fresh build; diff limited to F1.
</criteria>
<output>
Commit on fix/issue-28-current-board. Report .agents/run/task-centred-architecture/outputs/issue-28-f1-fix.md and append proof entries in verifications/issue-28/proof.md. Return at most 12 lines: commit, chosen bound and eviction rule, red-first evidence, test counts, residual risk, actual and supplied model. Do not merge, push, close or deploy. A bounded independent re-review follows.
</output>
