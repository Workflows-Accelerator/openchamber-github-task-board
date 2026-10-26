<env_preflight>
Repository /workspace/config/opencode. Worktree /workspace/config/opencode/.worktrees/team-ops-board-entrypoint, branch ops/board-entrypoint-hook; candidate fb3e175b11b8754978a24f35f462c2bfb8caa98a on runtime180197c1568ea4e725711059397d5f641c4ffb18. Tracked clean. Existing private review/evidence are immutable; no product edits, no push, no merge, no deployment, no environment or credential access.
Owned report only: .agents/run/board-entrypoint-gap-recheck/report.md plus untracked evidence in that same directory. Put reproducible evidence in this persistent owned directory, not only /tmp/opencode. Runtime scripts/entrypoint.sh unchanged is a required invariant.
Tests: node --test tests/board-supervisor.test.mjs ; npm test. Use scratch copies for mutants; never mutate the checked-out candidate. Preflight is authoritative at startup; targeted git diff/HEAD checks for independent review allowed.
</env_preflight>
<goal>
Independently decide whether the test-only fb3e175 closes both surviving ownership/shutdown guards without weakening any prior check or changing runtime behaviour, so the owner-authorised conditional config merge can proceed.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-entrypoint-hook-test-gap-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/tmp/opencode/board-entrypoint-gap-report.md]
Existing .agents/run/board-entrypoint-fix-recheck/** evidence in this worktree; docs/BOARD_SUPERVISOR.md; tests/board-supervisor.test.mjs.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. You are a fresh independent reviewer of the builder's changes, not their author.
1. Inspect diff180197c..fb3e175. Exactly two tests (7e and 7f) plus accurate doc additions; original21 tests byte-identical; entrypoint.sh and tools/board/*.sh byte-identical. Any runtime change or weakened old assertion is required failure.
2. Run both new tests independently and the full23-test suite. 7e must prove external flock free after supervisor SIGKILL while the child remains alive, stale pid cleanup and exactly one replacement top-level owner/new child; explicitly distinguish the orphan from the new child and clean ALL fixture processes. 7f must observe the ignoring child receive TERM, escalation to KILL and reaping within about6.5s, pid removal and no supervisor alive. No skips or false success from harness cleanup.
3. Independently remove child exec9>&- in scratch, run7e, require failure specifically at the lock guarantee; independently remove TERM/KILL forwarding in scratch, run7f, require failure specifically at signal/reap guarantee. Ensure no descendant process leaks in the fixed suite and clean all mutants.
4. Re-run npm test and sh/dash/bash -n for board scripts+entrypoint. Crosscheck the builder's 655 root+19 plugin/23 target counts with actual results. Minor docs accurately state configured-in-release manifest exemption, zero sustain disables finite cap, SIGKILL orphan/port contention, no implicit HUP reload. No claim these accepted residuals are fixes.
5. Produce two-verdict plus security disposition: Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, PROCEED/HALT. Standing required defect => HALT and no further correction. No automatic merge.
</scope>
<criteria>
Both mutants fail for the intended behavioural reason, fixed suite23/23 and full suite pass without skips, old tests/runtime unchanged, evidence persistent, docs accurate, no new required defect. Only a fully PASS/APPROVED recheck permits the separate owner-approved merge instruction.
</criteria>
<output>
<=12 lines: verdicts; test/runtime diff integrity; two independent mutation exits and reasons; target/full suite counts+exits; syntax results; process cleanup; residuals; report path; actual provider/model. Do not merge or self-approve.
</output>
