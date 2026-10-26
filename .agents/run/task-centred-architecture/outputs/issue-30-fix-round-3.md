# Issue #30 — fix round 3 (cf7dd92 recheck R1, R2, test 8)

- Worktree `team-dev-issue-30-work-type`, branch `feat/issue-30-work-type`, base `cf7dd92` (tracked clean at start).
- Scope: R1 duplicate, R2 comment residue, non-discriminating slice test 8. No prompt wording changed.

## R1 — duplicate default-instruction block removed

- `panel/core.ts:2379` (`buildConsolidatedIssuePrompt`): deleted the `typeof DEFAULT_WORK_INSTRUCTIONS !== 'undefined' ? ... : \`...\`` ternary and its byte-identical 1503-character fallback; now `prompt += \`${DEFAULT_WORK_INSTRUCTIONS}\n\n\`;`.
- `panel/main.js` regenerated: one-line diff, the same dead ternary/literal removed (`+1 -11`).
- Duplicate proof (`verifications/issue-30-fix-round-3/duplicate-check.log`): scanner counts single-line copies that contain header + undecided sentence + evidence rule: **0 in `panel/**`**, **1 at cf7dd92**. `typeof DEFAULT_WORK_INSTRUCTIONS` probes: 0 in `panel/core.ts`; 0 in `panel/main.js`. Bundle `### Work Type & Proportionate Paths:` occurrences: 4 at cf7dd92, 3 now (bug/feature/undecided renderer only).
- Honest nuance: the ternary was dead at module scope, but it was load-bearing for `test/shipped-parity.test.js`, which evaluates extracted bundle declarations in a `new Function` sandbox. Removing it alone made test 351 fail with `ReferenceError: DEFAULT_WORK_INSTRUCTIONS is not defined`. The correction extends that harness to extract `resolveIssueWorkType`, `buildWorkTypeInstructions`, the four rule constants and `DEFAULT_WORK_INSTRUCTIONS` (52 -> 59 declarations). The parity test now executes the shipped single-source renderer instead of a private duplicate fallback.

## R2 — comment residue removed, assertions retargeted

- `panel/main.ts:7148-7153`, `7415-7421`: removed the seven comment lines that carried prompt text only for source-text assertions (`Extended skills: ...`, `Recommended Skills: ...`, `Transclusion references ...`, `Autonomous & AFK Protocol:`, `Recommended Skills: Load with skill tool:`, `Transclusion fallback:`). The two "assembly delegated to ..." comments remain (documentation, not prompt text).
- `test/drafting-and-skills-audit.test.js:124-166`: asserts on `renderSingleIssueBrief(...)` output for an issue mapping every extended skill, plus a comment-stripped wiring check that the live preflight path calls the renderer.
- `test/native-skill-declarations.test.js:168-183`: asserts `renderSingleIssueBrief` and `renderBatchLaunchPrompt` output for transclusion text, plus comment-stripped wiring checks for both call sites.
- `test/layout-and-views.test.js:394-411`: same hollow pattern pre-existed there (five `MAIN_TS.includes('[@.agents/.../SKILL.md]')` assertions satisfied only by the canonical comment block at `panel/main.ts:7134-7145`, present since `f04c2de`). Retargeted to `renderSingleIssueBrief` output to satisfy "no test may assert on a source comment"; the pre-existing comment block itself is untouched.
- `grep -rn "MAIN_TS.includes" test/` now shows only code declarations, never prompt text.

## Test 8 — discriminating wiring assertions

`test/issue-30-work-type.test.js:379-435` now strips comments from each extracted function body, requires the exact assignment statement `elPreflightPromptInput.value = renderSingleIssueBrief(activeIssue, {...});` / `const prompt = renderBatchLaunchPrompt(issue);`, requires exactly one renderer reference and one assignment, and rejects `DEFAULT_WORK_INSTRUCTIONS` in the body. Appended `+ DEFAULT_WORK_INSTRUCTIONS`, `+=`, and commented-out calls no longer satisfy it.

## Mutations (scratch tree `/tmp/opencode/issue30-r3/scratch`, outside the repo)

All applied to a copy of the final tree; command per mutation:
`node --test test/issue-30-work-type.test.js test/drafting-and-skills-audit.test.js test/native-skill-declarations.test.js`

Baseline: 20/20 pass, exit 0.

| Mutation | Exit | Failing tests |
| --- | --- | --- |
| A preflight call -> `DEFAULT_WORK_INSTRUCTIONS` | 1 | drafting retarget, slice test 8, native retarget |
| B preflight call deleted | 1 | drafting retarget, slice test 8, native retarget |
| C batch call -> `DEFAULT_WORK_INSTRUCTIONS` | 1 | slice test 8, native retarget |
| D batch call deleted | 1 | slice test 8, native retarget |
| E preflight call commented out | 1 | drafting retarget, slice test 8, native retarget |
| F `+ DEFAULT_WORK_INSTRUCTIONS` appended to preflight | 1 | slice test 8 |
| G same appended to batch | 1 | slice test 8 |

Under every one of the four required mutations at least one retargeted test and test 8 fail. Mutation C/D do not fail the preflight-only drafting test by design; the native test covers both surfaces. Logs: `verifications/issue-30-fix-round-3/mutations.log`.

## Byte-identical prompts

`node /tmp/opencode/issue30-r3/compare.mjs` imports `cf7dd92:panel/core.ts` and the working tree side by side and compares full strings: 19/19 identical (undecided, bug, feature, both labels; single-issue workspace/worktree, batch, consolidated; null and empty). Exit 0. Log: `byte-identical.log`.

## Checks

- `npm test`: 525/525 pass, exit 0.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0; repeated build byte-identical.
- `panel/main.js` sha256 `7cb9aaafd463c4c59cdfb8a37a3c37b6f3172f1842c68b9076ced8ff2e3f1b3a`; `service/main.js` unchanged `a29d18cc1a43c823f304119b9effc8231241cd6e2fd07ab4ee36bc9b2cb30f84`.
- Bundle diff is only the R1 removal; esbuild already stripped source comments, so `main.ts` comment removal did not alter the bundle.

## Limits

- Test 8 and the wiring halves of the retargeted tests are still source assertions: `main.ts` cannot be executed in this suite. They now reject comments, concatenation and duplicate assignment, but a semantically equivalent refactor of the assignment statement would need the test updated. The behavioural halves run the exported renderers.
- No live panel host execution and no real GitHub payload; comparison uses representative issue objects (string and `{name}` labels, subtasks, skill labels).

Provider/model: 9router / Genius.
