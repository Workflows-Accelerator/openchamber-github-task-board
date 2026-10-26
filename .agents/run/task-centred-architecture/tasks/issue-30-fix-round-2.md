<env_preflight>
Repo /workspace/extensions/github-task-board (Workflows-Accelerator/openchamber-github-task-board).
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type.
Branch feat/issue-30-work-type, HEAD 0bb5159 tracked-clean. Untracked and immutable: .agents/run/task-centred-architecture/outputs/issue-30-hostile.md and verifications/issue-30-review/ — preserve byte-identical, never stage them.
Scope: panel/core.ts, panel/main.ts, panel/main.js (build output), test/issue-30-work-type.test.js, docs/issue-body-contract.md only if the wording must change. No other file.
No push, no merge, no master, no deployment, no secrets, no network. Scratch /tmp/opencode.
Tests: node --test test/issue-30-work-type.test.js; npm test; npm run typecheck; npm run build.
</env_preflight>
<goal>
Remove a defect introduced by correction 0bb5159 and finish the wiring honestly: the live preflight and batch-launch paths must assemble their prompt through one exported function that the tests exercise, with no parallel unused prompt builder and no global side effect, and removing the live wiring must fail a test.
</goal>
<context_files>
Previous hostile report (already satisfied items stay satisfied): [@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-hostile.md]
Contract: [@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
Candidate diff to correct: `git diff 785684b 0bb5159` in the worktree.
</context_files>
<scope>
1. Delete the dead exports `buildSingleIssuePrompt` and `buildBatchLaunchPrompt` from panel/core.ts. Nothing in panel/main.ts imports or calls them (`grep -n 'buildSingleIssuePrompt\|buildBatchLaunchPrompt' panel/`), so they test a parallel implementation instead of the product. Their tests must go with them.
2. Create one exported pure renderer per live path that panel/main.ts actually calls, and move the real assembly into it rather than duplicating it:
   - a single-issue brief renderer that produces the exact brief `updatePreflightBrief()` currently appends after the issue description, including the work-type block and the worktree/workspace closing sentence;
   - a batch-launch prompt renderer that produces the exact prompt `launchBatchSeparateSessions()` currently builds for each issue, including its skills section and closing sentence.
   Keep the current observable prompt content otherwise unchanged. `updatePreflightBrief()` and `launchBatchSeparateSessions()` must call these functions; they must not keep a second copy of the text.
3. Make the work-type block have one renderer only. `DEFAULT_WORK_INSTRUCTIONS` must be derived from the same function that renders the undecided, bug and feature variants (for example `export const DEFAULT_WORK_INSTRUCTIONS = buildWorkTypeInstructions('undecided')`), so the consolidated prompt, the preflight and the batch path cannot drift. Keep the exported name because buildConsolidatedIssuePrompt uses it.
4. Remove the `globalThis.DEFAULT_WORK_INSTRUCTIONS` assignment added in 0bb5159. No product module writes to globalThis, and no test needs it.
5. Tests must exercise the same functions the UI calls, and must fail when the wiring is removed:
   - behaviour: bug, enhancement, both labels, neither label, and null issue, through the single-issue brief renderer and the batch renderer, asserting path isolation, the explicit alignment question for undecided, the single Work Log rule and the human-authority sentence;
   - wiring discrimination: a mutation that replaces the call in `updatePreflightBrief()` or in `launchBatchSeparateSessions()` with the generic `DEFAULT_WORK_INSTRUCTIONS` must fail at least one test, and a mutation that deletes the call entirely must fail. State the mechanism honestly: a source-level wiring assertion is acceptable only alongside the behavioural tests of the exact called function, and it must be the only source-text assertion.
   - keep the documentation-contract assertions that pass today, but only for text that the contract must state.
6. Re-verify the earlier four findings remain closed: resolver used by the live paths, one Work Log rule (optional at creation, exactly one sentence once work starts), feature template restored to the base shape (no uncontracted sections or checklist items, no type:* labels), and no emitted prompt that guesses the work type.
7. Rebuild panel/main.js with the repository's own build (`npm run build`), confirm the bundle contains the new call sites, and report the bundle hash. Do not hand-edit the bundle.
</scope>
<criteria>
No exported function in panel/core.ts that the panel does not call. Exactly one renderer for work-type text. panel/main.ts calls the two new renderers and holds no duplicate prompt text. No globalThis write. Tests fail when either live call is removed or replaced with the generic block, and pass otherwise. Red-before for at least the wiring mutation is demonstrated on 0bb5159. Full suite, typecheck, build, and source/bundle parity green. Earlier four findings still closed. No push or merge.
</criteria>
<output>
At most 10 lines: commit, files changed, the two renderer names and both call sites, evidence that the dead builders are gone, mutation table (mutation, before result, after result), test counts, bundle hash, residual risks, actual provider/model.
</output>
