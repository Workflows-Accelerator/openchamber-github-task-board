<env_preflight>
BLOCKED DRAFT — fill builder commit/report after ses_c43bb6ac007df0382aa0f811 finishes; review only when the builder has stopped.
Repo /workspace/config/opencode (Workflows-Accelerator/opencode-config)
Worktree /workspace/config/opencode/.worktrees/team-ops-board-entrypoint
Branch ops/board-entrypoint-hook; fill exact HEAD and tracked state. Base master37f5b67.
Own only .agents/run/board-entrypoint-hostile/** (create if the repository permits, otherwise a distinct report path agreed at dispatch) and verifications under it; preserve builder artifacts.
Read-only implementation. Fixtures may run in /tmp/opencode. No live checkout edits, no container/proxy/deploy mutation, no push, no master merge, no secrets or .env reads.
Preflight authoritative at dispatch; targeted checks before reporting.
</env_preflight>
<goal>
Independently decide whether the startup supervisor is safe to enable and actually provides bounded crash recovery without endangering OpenChamber startup.
</goal>
<context_files>
Board deployment corrected plan in /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-plan-corrected-private.md (private, do not publish).
Builder report FILL_AT_DISPATCH.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. FIX NOTHING.
Read the full diff and both scripts before tests. Run the builder's fixture suite yourself; then probe beyond it:
1. Fail-open for OpenChamber, fail-closed for the board: disabled/absent/missing artifact/bad checksum/missing env must not block PID 1 or leave a crash loop; verify actual entrypoint exit path and ordering around the existing daemon start and exec tini.
2. Single ownership: concurrent invocations, stale PID, PID reuse, foreign process must never be killed; prove by fixture. Check the lock is atomic and released on abnormal supervisor death.
3. Restart bounds: exponential growth, cap/jitter, sustained-uptime reset, no hot loop, no unbounded process or log growth; log rotation actually caps, does not truncate another process's file, and keeps permissions safe.
4. Secret hygiene: required names may be checked; values must never appear in argv, pid/state files, logs, error output or test artifacts. Check what child inherits.
5. Artifact integrity: configurable release dir with a stable pointer or explicit path, not a per-commit hardcode; checksum manifest optional-but-verified, symlink/absolute-path escape considered, and no build/install at boot.
6. Signals: SIGTERM/SIGINT to supervisor forwards, waits, escalates, reaps, and exits without orphaning the child; child exit status handling is correct under the shell's error mode.
7. Test discrimination: break the lock, the disable gate, the backoff and the checksum check in a scratch copy and show which tests fail; a green suite that passes with broken guards is a finding. Verify no test depends on a developer's real workspace or installed board.
8. Blast radius: diff limited to the board tool, entrypoint guard and tests; no other service, daemon or permission changed. Documentation gives exact enable, disable and rollback steps.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, machine PROCEED/HALT with path:line evidence and observed outcomes. Any foreign-process kill risk, container-start block, secret leak, unbounded crash loop or non-discriminating core test is blocking. No product edit. No master merge.
</criteria>
<output>
At most 12 lines: verdicts, ranked findings, independent test/mutation results, exact enable/disable/rollback wording confirmed, residual risks, report path, actual provider/model. No merge or deployment claim.
</output>
