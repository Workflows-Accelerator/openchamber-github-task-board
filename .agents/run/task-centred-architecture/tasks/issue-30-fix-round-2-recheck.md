<env_preflight>
Read-only hostile recheck. Repo /workspace/extensions/github-task-board.
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type.
Branch feat/issue-30-work-type. Candidate is the correction commit after 0bb5159; record the exact hash. Tracked-clean expected. Untracked .agents/run/task-centred-architecture/outputs/issue-30-hostile.md and verifications/issue-30-review/** are immutable previous evidence: do not modify, stage or commit them.
You own only one new untracked report and optional untracked verification logs: .agents/run/task-centred-architecture/outputs/issue-30-fix-recheck-private.md and verifications/issue-30-fix-recheck/**.
No product edits, no commit, no push, no merge, no deployment, no network. Scratch /tmp/opencode.
Tests: node --test test/issue-30-work-type.test.js; npm test; npm run typecheck; npm run build.
</env_preflight>
<goal>
Decide whether the work-type change is now honest and complete: the panel's real preflight and batch-launch paths use one tested renderer, no parallel unused builder remains, no global side effect, no duplicated work-type text, and the tests fail when the live wiring is removed.
</goal>
<context_files>
Prior hostile review: [@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-hostile.md]
Round-1 manager finding: [@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-30-fix-round-2.md]
Contract: [@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
Diff: `git diff c337901 <candidate>` and `git diff 0bb5159 <candidate>`.
</context_files>
<scope>
1. Verify the round-1 defect is gone: neither `buildSingleIssuePrompt` nor `buildBatchLaunchPrompt` exists; no exported core prompt builder lacks a caller in panel/main.ts; no `globalThis` write exists in product code. Search the whole panel and test tree and report any remaining dead export.
2. Verify the live wiring: `updatePreflightBrief()` and `launchBatchSeparateSessions()` in panel/main.ts call the exact exported renderers the tests exercise, pass the correct per-issue value (not a stale active issue), and hold no duplicate work-type or path text. Trace the renderer names from the test imports to the call sites.
3. Verify one source of truth: `DEFAULT_WORK_INSTRUCTIONS` is derived from the same renderer that produces the undecided/bug/feature variants, and the consolidated prompt uses it. Show that changing the rule once changes every surfaced prompt and the contract is either generated or explicitly asserted in one place. Report any remaining byte-level duplication between core, main and docs.
4. Verify the work-type logic: bug and enhancement labels only; both or neither means undecided; label matching is case-insensitive and not fooled by lookalike labels; null and missing issue means undecided; no inference from title or body; undecided emits an explicit alignment question and does not block independent work; bug output contains only the bug path and feature output only the feature path.
5. Verify the Work Log contract is one rule everywhere: optional at creation, exactly one sentence once work starts, stated identically in the generated issue prompt, the preflight brief, the batch prompt, the labels template and docs/issue-body-contract.md. Any remaining optional-versus-required contradiction is a required finding.
6. Verify the template restoration: `DEFAULT_TEMPLATES` bug and feature entries match the base shape at c337901 except for contract-required content; no uncontracted research/alternatives section, no added checklist item, no `type:*` label, no work-type body field, no emoji.
7. Test discrimination, independently: in a scratch copy, (a) remove the renderer call from `updatePreflightBrief` and replace it with the generic block — a test must fail; (b) delete the call entirely — a test must fail; (c) make the resolver always return bug — a test must fail on the both/neither cases; (d) remove the Work Log sentence rule — a test must fail. Report which test fails for each. A source-text wiring assertion is acceptable only if it is the sole source assertion and the behavioural tests exercise the exact called function; flag any test that merely re-states a constant.
8. Run the full suite, typecheck, build; verify panel/main.js is the build output of panel/main.ts with no hand edits (rebuild to a scratch file and compare, or diff the bundle's relevant sections), report the bundle hash and test counts. Confirm no panel/service behaviour outside the work-type contract changed, and no root test was weakened.
</scope>
<criteria>
Verdicts: Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, overall PROCEED/HALT. Every required finding needs file:line at the candidate, a reproduction, the observed result and the smallest correction. Distinguish required from residual. Do not edit product files, do not self-approve.
</criteria>
<output>
At most 16 lines: four verdicts; round-1 defect status; renderer names and both call sites; single-source status; work-type and Work Log checks; template status; independent mutation table; test counts and bundle hash; residual risks; what you could not verify; actual provider/model.
</output>
