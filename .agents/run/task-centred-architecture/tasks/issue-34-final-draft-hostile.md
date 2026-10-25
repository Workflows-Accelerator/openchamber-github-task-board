<env_preflight>
DRAFT: manager must fill candidate HEAD and clean state at builder wake before dispatch. No other worker may own worktree.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch fix/issue-34-answer-integrity; prior 7f7e8cc; correction FILL_AT_DISPATCH. Key paths panel/main.ts questionAnswerDrafts and all draft call sites/three renderers; panel/main.js; test/issue-34-answer-integrity.test.js; focused correction report/proof.
Commands node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Shared node_modules symlink. Disposable probes /tmp/opencode.
Own only .agents/run/task-centred-architecture/outputs/issue-34-final-draft-hostile.md and verifications/issue-34-draft-final-review/**. Product/tests read-only. No web/service/core/parser edits, installed extension, real GitHub, credential/env files, other worktrees, master, push/merge/deploy/closure. No installs. Rebuild to disposable destination or verify build causes no product diff; do not commit bundle.
Preflight authoritative, no startup git status/pwd/ls. Targeted commit/action failure verification allowed.
</env_preflight>
<goal>
Independently pass or fail the final owner-approved answer-draft correction, then stop.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-final-draft-correction.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-draft-isolation-check.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-final-draft-correction.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-final-hostile.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not implement this. Fix nothing. Single bounded final check: this failure ends the authorized loop and returns to owner, not another fix.
Read entire 7f7e8cc..candidate diff including tests/bundle, distrust builder closure. Empirically rerun six isolation inputs with desired assertions and independently adversarial variations. Repo A#1 vs B#1 same/different text, Q1/Q2 same issue, cancel/success/clear isolate exact key, old/changed/deleted/already-answered source. Clearing input must not restore older text. Changed question must NEVER receive original draft automatically, even a single-question issue. Recoverable original draft must be visibly labelled with ORIGINAL question, selectable/copyable and explicitly discardable in all three entry points, including zero current questions (not just a Map assertion). No source match guesses, no hidden draft loss. Duplicate exact questions remain ambiguous. Unknown repo must not collide in shared blank keys.
Check view selection removal did not weaken tests: normal production toolbar/layout path selects view; tests should not set globals to get a green answer. Side-effect report was direct invocation only, do not overclaim production bug proof.
Preserve seven earlier fixes with targeted smoke, not redo all seven red-before history: UNKNOWN + unconfirmed lock; one click/Enter one mutation; no notification rollback; result-aware dependency feedback; #36 human-close guards; exact question match. No hashes/generation/persistence. No unintended scope.
If feasible capture a real browser render of new recovered-draft UI with synthetic host boundary and product bundle. Distinguish from installed authenticated host E2E; if browser unavailable record NOT RUN, never call synthetic DOM L3. Inspect logs and new UI text/layout in whatever real renderer is available; screenshots only if actually captured.
</scope>
<criteria>
Spec PASS/PARTIAL/FAIL; Quality APPROVED/NEEDS-FIXES. All accepted draft defects closed with own empirical DOM results, full suite/types/build parity green, revised Test18 justified by owner decision14 without dropping retention. Ranked real defects include source/input/observed/expected/minimum correction, no speculative blocker. Installed-host/production GitHub remain NOT RUN. L5 pending.
</criteria>
<output>
Commit report/proof only. <=12 lines: verdicts, per-case table summary, ranked findings if any, counts/hash/commit, actual provider/model and blind spots. No product fix, merge/push/closure/deploy. Stop after verdict even on failure.
</output>
