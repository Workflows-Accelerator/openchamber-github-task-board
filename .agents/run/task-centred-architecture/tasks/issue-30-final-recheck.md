<env_preflight>
Repository /workspace/extensions/github-task-board. Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type branch feat/issue-30-work-type HEAD959bfd294947ba9da7b8c2c32cb7cd4039563f83 (oncf7dd92), tracked clean; preserve pre-existing private untracked review reports/evidence.
Read-only final independent review per owner decision22. No product/test edits, stage, commit, push, merge, live host/network, credentials or shared config/skills. Owned output only .agents/run/task-centred-architecture/outputs/issue-30-final-recheck-private.md and untracked evidence verifications/issue-30-final-recheck-private/**. Scratch mutations outside checkout.
Tests: node --test test/issue-30-work-type.test.js test/drafting-and-skills-audit.test.js test/native-skill-declarations.test.js test/shipped-parity.test.js test/layout-and-views.test.js ; npm test ; npm run typecheck ; npm run build only in scratch, not checked-out bundles. Preflight authoritative; targeted independent diff/action checks allowed.
</env_preflight>
<goal>
Independently decide whether959bfd2 removes every required duplicate/comment-testing/wiring-test defect without losing prompt behaviour or weakening other tests; another required failure parks #30 for this mission.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-30-fix-round-3.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-fix-recheck-private.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-fix-round-3.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. You are fresh independent reviewer of the builder, not their author.
1. Audit full diffcf7dd92..959bfd2, especially extra edits test/layout-and-views.test.js and test/shipped-parity.test.js not explicitly expected in the correction. Builder says layout change is removal of matching comment test and shipped harness loads dependencies for new direct constant reference. Verify necessary, behaviour-strengthening and no test assertion lost. Any unrelated scope/weakening => required defect, do not silently accept.
2. R1: one default instruction source, no duplicate1503-char fallback anywhere in source/bundle. Direct DEFAULT_WORK_INSTRUCTIONS ref preserves consolidated prompt wording. Grep whole panel/**; independently compare actual default/bug/feature/undecided single and batch delivered outputs withcf7dd92 (plus original785684b intended-block exclusion) across absent/mixed labels, skills and plan variants. No new globals, dead builders or unresolved required-vs-optional Work Log rule. Exact output equality, not a count-only check.
3. R2: old tests must call actual main.ts live function bodies, execute renderSingleIssueBrief/renderBatchLaunchPrompt with real per-issue input and inspect delivered prompts. Audit test/test-issue-launch-harness.js: cannot fabricate behaviour with injected functions, assert a parallel generic builder, source comments or a call-like string. Slice8 and BOTH retargeted older tests must fail under all four independent mutations in scratch: preflight renderer→generic; preflight call deleted; batch renderer→generic; batch call deleted. Also try a commented call/appended generic block to ensure they cannot satisfy the behaviour test. Preserve assertions for skill declaration/path/action audit in old tests.
4. Re-run slice/retargeted/layout/parity/full525/both relevant static commands and reproducible panel bundle build. Require genuine failure of mutants, no skip/cancel. Existing timing flakes may rerun only if raw failed performance assertion and unchanged targeted/full passing evidence are recorded, no widening thresholds.
5. Builder claims byte comparison27/27 and bundle7cb9aaafd463c4c59cdfb8a37a3c37b6f3172f1842c68b9076ced8ff2e3f1b3a. Independently verify. Runtime panel host and real GitHub remain NOT VERIFIED; do not manufacture L3/L5.
</scope>
<criteria>
Security APPROVED, Spec PASS, Quality APPROVED and PROCEED only with zero required findings, no duplicate, real behaviour-discriminating wiring tests, no prompt-text loss, no test weakening, full tests/static/build byte-parity evidence. Required failure => HALT/PARK under decision22, no further autonomous fix.
</criteria>
<output>
Write persistent owned report with commands, exits and mutation details. Return <=15 lines: verdicts; R1/R2/test8 closures or standing failures with file:line; expanded-test-edit rationale; four mutations plus comment spoof; actual prompt comparisons; suites/types/build/hash; actual provider/model; blind spots. No edit/merge/push or self-approval.
</output>
