<env_preflight>
Read-only hostile recheck. Repo /workspace/extensions/github-task-board.
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo.
Branch feat/issue-37-multi-repo. Candidate cdc48b1 tracked-clean on top of review proof 8a958fe; product base 5b231ff. Untracked review evidence and verifications/issue-37-review/** and verifications/issue-37-build/** are immutable: do not modify, stage or commit them.
You own only one new untracked report and optional untracked verification logs: .agents/run/task-centred-architecture/outputs/issue-37-fix-recheck-private.md and verifications/issue-37-fix-recheck/**.
No product edits, no new commit on the product, no push, no merge, no deployment, no real GitHub writes, no credentials, no installed extension, no other worktree. Scratch /tmp/opencode.
Tests available: node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npm run typecheck; esbuild bundle to a scratch output (not web/dist unless needed for parity) and compare with the committed source.
</env_preflight>
<goal>
Decide whether cdc48b1 really closes F1, F2, F3 and the minimal F4, without a new defect or a weakened boundary. Re-derive each proof yourself; do not trust the builder's mutation table.
</goal>
<context_files>
Builder report (claims, unverified): [@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/.agents/run/task-centred-architecture/outputs/issue-37-hostile.md]
Fix contract: [@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-37-fix.md]
Owner decisions: [@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
Diff to audit: `git diff 8a958fe cdc48b1` and `git diff 5b231ff cdc48b1 -- web/`.
</context_files>
<scope>
1. F1 — stale allowlist during refresh. Read web/server/repositories.ts at cdc48b1 and prove the authorisation decision cannot use the pre-refresh allowlist. Reproduce the gated case yourself: warm the registry, start a discovery refresh that revokes `owner/alpha`, issue a write to alpha while the refresh is in flight, and count upstream calls. Required: the write is refused definitively (400/503 class), zero GET/PATCH for alpha, no state change, and a repository present in both snapshots still reads and writes. Also probe these edges and classify them: an initial empty `known` map while the first discovery is in flight; a repository newly granted mid-refresh; a refresh that fails (the write must not silently proceed on a stale allowlist); and two concurrent resolves during one refresh.
2. F2 — cross-repository client race. Audit web/public/app.js at cdc48b1. Prove a write issued against alpha can no longer cancel or republish a load for a freshly selected beta, that the rendered repository label and rows match the selection after resolution, and that Refresh returns to enabled. Test the counter and state edges: a load superseded by a write, two loads overlapping, a load that rejects, a write during the combined `all` view, and a write whose issue belongs to neither the current selection nor `all`. Confirm no path leaves Refresh disabled with no in-flight load, and no path renders one repository's rows under another's label.
3. F3 — false UNKNOWN. Prove a pre-dispatch 503 `discovery_unavailable` is a definite refusal with retry guidance and never adds to the uncertain set, for section, answer and status paths. Then prove the boundary was not widened: a 502 `write_outcome_unknown`, a network failure after dispatch, a malformed 200, or a proxy 503 without that error code must still be UNKNOWN and never auto-repeated. Flag any mapping that could turn a genuinely ambiguous outcome into a definite refusal.
4. F4 — bounded aggregate. Verify the 500-issue cap applies to the combined view, that `truncatedByIssueCap` and `truncated` are truthful at exactly 500 and at 501, that a page of only duplicates reports truncation, and that the startup log no longer prints empty values. Check that per-repository pagination semantics were not changed beyond the duplicate-page truncation flag.
5. Regression and mutation audit. Re-run the builder's red-before on 5b231ff in a scratch copy and confirm each failure is for the intended reason, then confirm the fix passes. Independently re-apply at least these mutations and report which test fails: (a) restore the early cached return in repositories.ts before the inFlight check; (b) let a write invalidate a board load for another repository; (c) map the 503 discovery_unavailable response back to the generic unknown path; (d) remove the aggregate cap or the duplicate-page truncation flag. A test that still passes with its guard removed is a defect.
6. Scope and boundary audit. Confirm the change is limited to the nine files shown by `git diff 8a958fe cdc48b1`, that no authentication, CSRF, origin, redirect, conflict-detection, UNKNOWN-never-repeat or answer-binding behaviour changed, and that no review evidence was rewritten. Check the two-line change in web/tests/github.test.mjs is a genuine assertion and not a weakened one.
7. Verification: run the web suite, root suite, both typechecks, build the bundle and check source/bundle parity, and report actual counts and the bundle hash. Check that `web/README.md` statements match the implementation, including the cap, restart-lost unavailable history, digest limitation, synthetic-only proof and no hidden-private enumeration.
</scope>
<criteria>
Verdicts: Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, and overall PROCEED/HALT. Every finding has file:line at cdc48b1, a reproduction command, the observed result and the smallest correction. A required finding means HALT. Distinguish required from low/residual. Do not self-approve, do not edit product files.
</criteria>
<output>
At most 18 lines: the four verdicts; F1-F4 closure with your own evidence (including the zero-upstream call count); the independent mutation table; any new defect with file:line and reproduction; residual lows; test/bundle counts; what you could not verify; actual provider/model.
</output>
