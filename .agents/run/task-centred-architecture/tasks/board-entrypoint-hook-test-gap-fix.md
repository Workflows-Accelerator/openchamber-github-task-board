<env_preflight>
Repo /workspace/config/opencode
Worktree /workspace/config/opencode/.worktrees/team-ops-board-entrypoint; branch ops/board-entrypoint-hook; HEAD 180197c1568ea4e725711059397d5f641c4ffb18 tracked clean. Verify before editing; unexpected dirt/branch => STOP/report.
Independent recheck verdict on 180197c: Security APPROVED, Spec PASS, Quality NEEDS-FIXES (test-only), overall HALT. This is the single bounded correction allowed before the merge decision; a failing recheck parks the merge.
No product change is authorised unless a new test exposes a real runtime defect — then STOP and report the defect instead of silently changing behaviour.
Do not touch unrelated config files, shared skills, opencode.json or the untracked devops folder. Do not push, merge to master, deploy, restart anything, or open a PR.
Tests: node --test tests/board-supervisor.test.mjs ; npm test.
</env_preflight>
<goal>
Close the two surviving product guards with discriminating tests so the supervisor's ownership and shutdown guarantees cannot regress green, then hand the branch to the manager for the merge decision.
</goal>
<context_files>
[@/workspace/config/opencode/.worktrees/team-ops-board-entrypoint/.agents/run/board-entrypoint-fix-recheck/evidence/b5-childfd.log]
[@/workspace/config/opencode/.worktrees/team-ops-board-entrypoint/docs/BOARD_SUPERVISOR.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-entrypoint-hook-fix-recheck.md]
Read tools/board/start.sh, tools/board/supervisor.sh, entrypoint.sh and tests/board-supervisor.test.mjs in full before editing.
</context_files>
<scope>
1. Test A — surviving lock-fd guard. `exec 9>&-` in the child wrapper is currently untested: removing it passes 21/21. Add a test that SIGKILLs a running supervisor while its child is alive, then asserts the flock is free (an external flock attempt succeeds), the stale pid record is cleared, and a fresh start.sh run succeeds with exactly one new top-level supervisor and one child. It must fail when `exec 9>&-` is removed from the child wrapper in a scratch copy.
2. Test B — surviving shutdown guard. Child TERM/KILL forwarding is currently untested. Add a test with a child that traps and ignores TERM: TERM the supervisor, assert the child receives KILL, is reaped within about 6 s, the pid file is removed, and no supervisor process survives. It must fail when the child TERM/KILL forwarding is removed in a scratch copy.
3. Keep the existing 21 tests intact and behavioural; do not replace assertions with source greps. Total suite must grow by exactly these tests.
4. Document, in docs/BOARD_SUPERVISOR.md, the accurate manifest exemption rule (only the three root manifest names are exempt by default; a configured manifest inside the release is also exempt) and record the two accepted residuals: a SIGKILLed supervisor leaves the board child running so a restart may briefly have two children contending for the port, and SUSTAINED_HEALTH_SECS=0 defeats a finite restart cap. Documentation only, no behaviour change.
5. Prove the two mutations in a scratch copy outside the repository: each removal must make its new test fail with a clear assertion, and the unmodified tree must pass. Record commands and exit codes.
</scope>
<criteria>
Both new tests exist, are behavioural, and fail under their intended mutation; the full suite passes unmodified; no product/behaviour change; docs state the exemption rule and residuals accurately; tracked tree clean except committed test/doc changes plus your report.
</criteria>
<output>
At most 12 lines: commit hash; the two new test names and what they assert; mutation commands with exit codes; suite counts and exits for node --test and npm test; sh/dash/bash -n results; docs lines changed; anything you could not verify; actual provider/model. No self-approval, no push, no master merge.
</output>
