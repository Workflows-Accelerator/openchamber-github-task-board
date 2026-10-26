<env_preflight>
Repo /workspace/config/opencode (Workflows-Accelerator/opencode-config).
Worktree /workspace/config/opencode/.worktrees/team-ops-board-entrypoint.
Branch ops/board-entrypoint-hook. Candidate is the fix commit on this branch after 4a3ecee; confirm `git log --oneline -3` and record the exact commit in your report. Tracked-clean expected. Untracked .agents/run/board-entrypoint-hostile/** is the previous independent review and is immutable: do not modify, stage or commit it.
You own only one new untracked report and optional untracked verification logs: .agents/run/board-entrypoint-fix-recheck/report.md and .agents/run/board-entrypoint-fix-recheck/**.
No product edits, no commit, no push, no container/proxy/deploy mutation, no real secrets, no network. Scratch /tmp/opencode. Shell scripts and `node --test` only; no new dependency installs.
</env_preflight>
<goal>
Independently decide whether the fix closes B1–B7 and introduces no new defect. Re-derive every proof with your own probes; the builder's mutation table is a claim, not evidence.
</goal>
<context_files>
Prior hostile review (all seven findings, with anchors): [@/workspace/config/opencode/.worktrees/team-ops-board-entrypoint/.agents/run/board-entrypoint-hostile/report.md]
Fix contract: [@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-entrypoint-hook-fix.md]
Diff: `git diff 4a3ecee <candidate>` (record the candidate hash).
</context_files>
<scope>
1. B1 mandatory artifact verification. Prove with real executions: missing BOARD_CHECKSUM_MANIFEST; missing default manifest; manifest that omits server.mjs, a web/public file, or package.json; a release containing an unlisted runtime file; a swapped server.mjs. Each must log a clear reason and start no child, and start.sh must still exit 0 so PID 1 is never blocked. Check exactly which paths are exempt from the manifest and whether that exemption is justified and tested. Confirm the previous behaviour (optional manifest, package-only manifest accepted) is gone.
2. B2 single ownership. Run at least 20 rounds of 8 simultaneous starts and count supervisors; exactly one per round. Then: remove the pid file while the owner is alive and try to start a second; leave a stale lock from a dead pid and prove recovery; hold a lock for a live foreign pid and prove it is neither killed nor deleted; invoke start.sh directly while a supervisor runs. Audit the lock publication and clearing sequence for any path that can delete a live owner's lock. Report rounds, duplicates and the exact scheme.
3. B3 bounded restarts. Verify the finite default, that 0 remains the explicit unlimited opt-in, that the consecutive-crash counter resets after sustained healthy uptime, and that non-numeric or negative configuration is logged and refused without starting. Run a child that exits immediately to the cap and a child healthy past the threshold to show a fresh allowance.
4. B4 boot delay. Measure start.sh delay with fractional `sleep` working and with a shim where `sleep 0.02` and `sleep 0.2` fail. Report milliseconds for both, the documented bound, and whether the hook placement before `exec tini` can ever delay PID 1 beyond it. Prove backoff is still respected under the shim and that no hot loop occurs.
5. B5 discriminating tests. Delete each guard in a scratch copy (enable gate, lock, backoff cap, checksum requirement, log rotation, release reload) and report which test fails. Confirm the tests execute the real entrypoint/supervisor rather than matching source strings, and that the hook is asserted to be reached before `exec tini` and not after.
6. B6 log and permission hygiene. Measure directory and file modes; run a hot crash loop and show total log growth stays bounded under the cap for both board.log and supervisor.log; confirm rotation does not lose the first lines or leak a world-readable file.
7. B7 release switching honesty. Swap the release symlink under a running supervisor and observe whether a child restart alone ever loads the new release. Verify the documented procedure restarts the supervisor, with exact commands, and that the start path does not claim success when the supervisor died before writing its pid.
8. Regression and boundary audit. Fail-open behaviour still exits 0 with no child for: disabled, absent release, missing assets, bad checksum, missing required env, unreadable release, non-executable start command. SIGTERM still reaps the child within the documented time. POSIX sh syntax clean. No unguarded new dependency; if flock is used, the fallback is tested. No unrelated daemon, no behaviour change outside tools/board and the entrypoint hook. The diff is surgical.
9. Run the repository's full test command as documented in the fix contract, plus the focused supervisor suite, and report actual counts.
</scope>
<criteria>
Verdicts: Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, overall PROCEED/HALT, plus a B1–B7 closure line each. Every required finding needs file:line at the candidate, a reproduction command, the observed result and the smallest correction. Report measurements as numbers. Distinguish required from residual. Do not edit product files, do not merge, do not push, do not self-approve.
</criteria>
<output>
At most 20 lines: four verdicts; B1–B7 each CLOSED/OPEN with your evidence; 8-way duplicate count; start.sh milliseconds normal versus shimmed; log growth bound; your independent mutation results; any new defect; residual risks; actual provider/model.
</output>
