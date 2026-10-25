<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh
Branch fix/issue-35-write-refresh; HEAD e49ddbe (product candidate 6b4032d, review proof on top), clean at dispatch. Base of the whole change is 12cb9c6 on feat/v2-binding-and-ratelimit (merged #28, #36, #34). No other worker owns panel/**; the #33 reviewer works only in web/** in a different worktree.
Root node_modules symlink already present. No installs, no env copy, no DB registration.
Key paths: panel/main.ts (admission helpers, syncRepoIncremental, fetchAllProjectIssues, both creation paths, toggleArchiveIssue, addTagToIssue, removeTagFromIssue, drawer priority/status-none/complexity handlers, isDefinitivePreCommitRejection), panel/main.js (generated), test/issue-35-write-refresh.test.js, test/test-app-harness.js, .agents/run/task-centred-architecture/outputs/issue-35-correction.md, verifications/issue-35-correction/**.
Commands node --test test/issue-35-write-refresh.test.js; npm test; npm run typecheck; npm run build.
Do not touch web/**, service/**, panel/core.ts, shared skills/config, private reports, credentials, real GitHub, installed extension, other worktrees, master. No push/merge/close/deploy. Synthetic fixtures only.
</env_preflight>
<goal>
Close the two High and four Moderate defects the independent hostile review found in the write-protection fix, without widening the fix or adding a second protection system.
</goal>
<context_files>
<file path=.agents/run/task-centred-architecture/outputs/issue-35-hostile.md>
Read the full review inside the worktree: .agents/run/task-centred-architecture/outputs/issue-35-hostile.md. Its anchors, reproductions and "minimal correction" text are authoritative for this task. Do not re-litigate the verdict; implement the corrections.
</file>
<file path=.agents/run/task-centred-architecture/outputs/issue-35-fix.md>
The builder's own report from 6b4032d, so you can see what was claimed and where it diverged.
</file>
GitHub issue #35 (read only): https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/35
</context_files>
<scope>
F1 HIGH — wrong repository attribution on creation during a repo switch.
Both creation paths call repoForIssue(created), which falls back to the mutable current repository. Attribute from the created issue's own response or the captured target repository, never from currentRepo. Assert that the repository used for the cache write and for admission equals the captured target. Regression: defer the POST, switch repository, resolve the POST, then act on the rendered row; the row, the cache entry and any follow-up PATCH must all name the target repository, and the other repository's issue of the same number must stay unclaimed.
F2 HIGH — failed drawer write reverts another issue's labels.
The three drawer handlers read the global activeIssue before the await and again inside catch. Capture the target issue before the optimistic mutation and use that captured reference in the success toast, the rollback and the re-render guard (only re-render when the drawer still shows the captured issue). Regression per handler: defer the PATCH, open another issue's drawer, reject with a definite 422; both issues must keep their own labels and the failed issue must not display the rejected value as applied.
F3 MODERATE — ambiguous outcomes reported as definite failures.
Reuse the existing definitive-rejection classifier. Roll back and say failed only for a definite pre-commit rejection, auth or validation refusal. For a post-send ambiguity (5xx, 408, abort, transport, redirect refusal, unparseable response) keep the attempted local value or mark the issue unconfirmed, say the outcome is unknown and that GitHub must be checked, and do not claim the write did or did not apply. Apply uniformly to archive, tag add, tag remove, priority, status-none and complexity. No atomic-GitHub guarantee is required or allowed to be claimed.
F4 MODERATE — a completed idle incremental sync still overwrites a confirmed write.
The incremental publication assigns the fetched issues directly. Record the incremental request start and publish through the existing field-protection path, or skip fields covered by a pinned write, so a completed incremental response cannot restore a pre-edit body for a write that already succeeded. Regression: start the incremental sync, complete a body PATCH, resolve the older incremental payload, assert board and cache keep the edit.
F5 MODERATE — a repository that fails on the first aggregate fetch looks empty.
Collect failed repositories during the aggregate fetch. When any failed, set the existing sync-error/partial state, surface partial freshness in All Projects, and do not persist the combined snapshot as if complete. Regression: fresh All Projects view where one repository returns 502 must be visibly partial and must not silently show only the other repository as complete; the existing had-issues fallback test must keep passing.
F6 LOW but required by the stated invariant — unconfirmed must block the dependent writes this fix wired.
Apply the same unconfirmed guard updateIssueBody already uses to archive, tag add, tag remove, priority, status-none and complexity, refusing with the existing unknown-outcome wording and sending no PATCH. Regression: mark an issue unconfirmed, then each handler must refuse and dispatch zero upstream mutations.
F7 LOW — settlement and cleanup.
Wrap the synchronous window so that a pending record is always settled even if optimistic mutation, cache delete or rendering throws (no unsettled record that only a cap can shed). Match the aggregate cleanup of the obsolete-epoch set to the single-repo path. Leave the hung-request and hard-cap residuals documented, do not add timeouts or new caps beyond what exists.
F8 LOW — the repository-qualified test performs no write.
Replace it with a real write: create or edit the same issue number in two repositories and assert the other repository's issue is neither protected nor pinned, and that its own write still lands. The test must fail if protection is shared by number alone.
Preserve: the three originally named defects stay green, #28 freshness/cursor rules, #34 unknown/unconfirmed semantics, #36 human-only Done guard. No new UI surface, no new admission system, no panel/core.ts edit, no change to which mutations the board offers.
</scope>
<criteria>
Each of F1, F2, F3, F4, F5, F6, F8 has a regression that fails on product 6b4032d and passes on your correction, proven with the committed test file and stated per test. All prior 16 targeted tests still pass; full suite, typecheck and rebuild green; the generated bundle matches the committed one and its hash is reported. The report states empirically which of the reviewer's findings are closed, which residual remains and why, and does not claim installed-host, real GitHub or real browser proof.
</criteria>
<output>
Commit product, tests and proofs on fix/issue-35-write-refresh, not on an integration branch. Write .agents/run/task-centred-architecture/outputs/issue-35-correction.md with the finding-by-finding table, exact red/green commands and exit codes, test counts and bundle hash. Return at most 12 lines: findings closed, residual, counts, hash, commit, blind spots, actual provider/model. One bounded re-review follows; do not self-approve.
</output>
