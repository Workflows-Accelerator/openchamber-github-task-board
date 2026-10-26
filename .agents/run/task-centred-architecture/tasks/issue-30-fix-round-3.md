<env_preflight>
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type; branch feat/issue-30-work-type; HEAD cf7dd92 tracked clean. Verify immediately before editing; unexpected dirt, branch or HEAD => STOP/report.
Root and every other worktree are read-only for you. A #37 integration worker is merging web/** in root at the same time; you must not touch root, web/**, service/** or shared config/skills.
Baseline: cf7dd92 already contains the accepted wiring (renderSingleIssueBrief at main.ts:7159, renderBatchLaunchPrompt at main.ts:7423, DEFAULT_WORK_INSTRUCTIONS = buildWorkTypeInstructions('undecided') at core.ts:1900). This round changes only the four items below.
Tests: node --test test/issue-30-work-type.test.js ; npm test ; npm run typecheck ; npm run build. Panel bundle panel/main.js is committed; rebuild it only if the source change alters it.
No push, PR, issue change, merge, deployment, credential use, reset/rebase/force.
</env_preflight>
<goal>
Remove the two required defects and the non-discriminating test pattern an independent recheck found in cf7dd92, without changing any user-visible prompt text, then prove it with mutations that fail.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-fix-recheck-private.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-30-31-correction-ruling.md]
</context_files>
<scope>
1. R1 — dead duplicate block. panel/core.ts:2379-2381 keeps a 1503-character byte-identical copy of DEFAULT_WORK_INSTRUCTIONS inside a `typeof DEFAULT_WORK_INSTRUCTIONS !== 'undefined'` ternary that can never be false. Replace it with a direct reference (`prompt += `${DEFAULT_WORK_INSTRUCTIONS}\n\n`` or the surrounding equivalent). Then grep for the first and last 40 characters of that copy and for any second copy of the same paragraph: no duplicate may remain anywhere in panel/**. Prove the rendered single-issue and batch prompts are byte-identical to cf7dd92 for at least undecided, bug and feature fixtures.
2. R2 — comment residue that tests assert on. panel/main.ts:7151-7153 and 7419-7421 hold comment text that exists only so drafting-and-skills-audit.test.js:131-133 and native-skill-declarations.test.js:163-164 can match it. Remove the residue and retarget both assertions to the actual renderer output: call the renderer (or its exported pure helper) and assert the real rendered prompt/brief text contains the required skill and audit content. No test may assert on a source comment, and removing the renderer call must fail the test.
3. Non-discriminating slice test 8. The recheck found it satisfiable by an appended generic block or a commented call. Make it assert behaviour: with the preflight renderer replaced by the generic builder in a scratch copy the test must fail, and with the preflight call site deleted it must fail; same for the batch renderer. Prove all four mutations in a scratch copy outside the repository with recorded exit codes, and leave the committed test tree at the fixed state.
4. No other source change. No new globals, no new dead builder, no change to work-type resolution, Work Log rule, templates or rendered wording. Any wording change is a defect.
</scope>
<criteria>
No duplicate of the default instruction block; no prompt text carried in comments; the two retargeted tests and slice test 8 fail under all four mutations; single-issue and batch output byte-identical to cf7dd92 on the fixtures; full suite, typecheck and build pass; panel bundle reproducible; tracked clean except your own committed report.
</criteria>
<output>
At most 12 lines: commit hash; each of R1/R2/test-8 with the file:line change; the exact grep that proves no duplicate; the four mutation commands with their exit codes; byte-identical comparison result; suite/typecheck/build counts and exits; panel bundle SHA-256; actual provider/model; anything you could not verify. No self-approval.
</output>
