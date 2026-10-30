# Startup supervisor release receipt (immutable pin)

Manager record 2026-10-26. Source of truth: release worker wake (actual9router/engineer) `ses_aef9d14a405a1668c3ab164e`; root config worktree report `.agents/run/board-entrypoint-release/report.md` is private/untracked in the config repository and was not readable from this checkout. Numbers below are the worker's reported evidence, independently gated by two separate reviewers on the candidate; the manager did not re-run config tests (tool boundary).

- Approved candidate: `fb3e175b11b8754978a24f35f462c2bfb8caa98a` on `ops/board-entrypoint-hook` (runtime `180197c`, tests/docs `fb3e175`).
- L4 runtime recheck `ses_77aa404f596d7e46dd72959c` actual9router/genius: Security APPROVED / Spec PASS / Quality NEEDS-FIXES (test-only) / HALT.
- Closing independent recheck `ses_7896cfe1285972c43f256c49` actual9router/engineer on `fb3e175`: Security APPROVED / Spec PASS / Quality APPROVED / PROCEED. Both mutants fail for the intended reason (child lock-fd closure; TERM→KILL forwarding), 23/23 supervisor, 655+19 repo tests, nine shell syntax checks, zero leaked processes, simulator scripts byte-identical to the reviewed runtime.
- Merge into `opencode-config` `master`: `9a23609ab80912c0289a6469d36a048e26d7832e`, zero conflicts, `--no-ff`.
- Published master tip verified by `git ls-remote origin refs/heads/master`: `abd6d6b7065a37de5f8ce7c09ab642a1e3b6b32f` (release proof commit). Fetch/merge/push exits all 0.
- Changed paths on master: `docs/BOARD_SUPERVISOR.md`, `entrypoint.sh`, `tests/board-supervisor.test.mjs`, `tools/board/start.sh`, `tools/board/supervisor.sh`.
- Verification on merged tree: supervisor 23/23; repository 655 root + 19 plugin; nine syntax checks; default-off fixture starts no child and leaves no PID.
- Authority: owner decisions 20 and 21 authorise this internal, default-off config merge on a passed independent gate. No application surface, so L5 waived for this merge only.
- NOT DONE / NOT PROVEN: no container restart, no process invocation against a real environment, no proxy or TLS change, no credential exposure, no live board start, no persistence-across-recreation proof.

## Deployment pin

Any deployment package or runbook must pin the approved merged config commit `abd6d6b7065a37de5f8ce7c09ab642a1e3b6b32f` (or a later commit that is a descendant and still contains the reviewed `tools/board/*` + `entrypoint.sh` byte-identically), and must remain default-off until the board release, credentials, private binding and rollback are proven. Deployment is still NOT executed.
