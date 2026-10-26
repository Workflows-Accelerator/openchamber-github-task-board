# Issue #30 — fix round 3

Base `cf7dd924eb4acd4719ec9c533c082c33822e0612`; branch `feat/issue-30-work-type`; worktree `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type`. Preflight: expected branch/HEAD and tracked clean; existing untracked earlier-review reports/evidence preserved. No root, web, service source, shared configuration or skills changes. No push, merge, issue update, deployment or credential use.

## R1 — remove the duplicate, preserve output

`panel/core.ts:2379`: `buildConsolidatedIssuePrompt` now appends `${DEFAULT_WORK_INSTRUCTIONS}\n\n` directly. Deleted the unreachable `typeof` fallback and its 1503-character literal. `panel/main.js:6448` rebuilt; bundle diff only that removal (`+1 -11`). Work-type resolution, rule constants, templates and renderer wording unchanged.

`bash verifications/issue-30-fix-round-3/check-duplicate.sh`: exit 0. First and last 40 characters of the former default block searched throughout `panel/**`, accepting literal and escaped newlines. Header occurs three times in source and three in generated bundle (bug, feature, undecided); ending occurs in shared evidence constant and two resolved paths per representation. Full expanded undecided paragraph and dead `typeof` probe absent. Identical paragraph search reproduces the defect in both cf7dd92 source and bundle, so it is not a vacuous negative check. Full output in `duplicate-check.log`.

Exact compact discriminating paragraph search:

```sh
/bin/grep -RPozl 'are the only work-type source\.(?:\\n|\n)- When both or neither[\s\S]{0,1800}Both paths keep existing evidence rules' panel/
```

Exit 1 now (absent); exit 0 against cf7dd92 copies of `panel/core.ts` and `panel/main.js` (present).

## R2 — real prompt/audit assertions, no comment coverage

`panel/main.ts`: removed the seven residue lines carrying extended-skill names, Recommended Skills, transclusion and AFK text. Retained the two explanatory delegation comments and the pre-existing canonical skill-reference comment block; no test now relies on that block.

- `test/drafting-and-skills-audit.test.js:127`: execute real `updatePreflightBrief` and `launchBatchSeparateSessions`, inspect the input value and captured session payload text, compare both with real renderer output, assert extended skills, transclusions and AFK content.
- `test/native-skill-declarations.test.js:154`: same executed paths for transclusion and canonical skill references; assert native skills on captured batch payload and metadata. Existing unrelated packaged/AI native-skill assertions retained.
- `test/layout-and-views.test.js:394`: retarget five pre-existing canonical skill-reference checks from `main.ts` comment text to `renderSingleIssueBrief` output. Required by the scope's no-source-comment-assertion constraint; no unrelated layout assertion changed.

## Test 8 — execute the live function bodies

`test/issue-30-work-type.test.js:380`: replaced source-text renderer-name assertions with executed behavior. Bug, feature, undecided and conflicting-label fixtures go through the real preflight function in both workspace/worktree modes, and through one live batch loop. Assert exact input/payload text equality with each issue's real renderer result, issue identity, number of sessions and absence of launch errors. Generic replacement, deletion, comments and appended generic blocks fail.

`test/test-issue-launch-harness.js:1`: reads only the two actual top-level function declarations from `panel/main.ts`, uses built-in `node:module.stripTypeScriptTypes`, executes them in a lexical `new Function` scope. It does not reconstruct assignments or prompts. Dependencies are actual core renderers/issue helpers; only DOM state, host calls, selection clearing and status side effects are stubbed. No global writes, exported product builder, new package or product change added. Missing/deleted batch prompt errors are captured through the real function's catch path and asserted, not swallowed by the test.

## Scratch mutation proof

Reproduce from this worktree with `node verifications/issue-30-fix-round-3/mutate.mjs <kind>`. Each invocation copies `panel`, `test`, `docs`, `package.json` into `/tmp/opencode/issue30-r3-proof-<kind>` and mutates only that copy; original test tree stays fixed. Runs exactly:

```sh
node --test test/issue-30-work-type.test.js test/drafting-and-skills-audit.test.js test/native-skill-declarations.test.js
```

| Kind | Mutation | Exit | Results |
| --- | --- | --- | --- |
| baseline | none | 0 | 20 pass, 0 fail |
| A | preflight assignment replaced by `DEFAULT_WORK_INSTRUCTIONS` | 1 | 17 pass, 3 fail |
| B | preflight assignment deleted | 1 | 17 pass, 3 fail |
| C | batch prompt replaced by `DEFAULT_WORK_INSTRUCTIONS` | 1 | 17 pass, 3 fail |
| D | batch prompt declaration deleted | 1 | 17 pass, 3 fail |
| E | preflight assignment commented out | 1 | 17 pass, 3 fail |
| F | generic block appended to preflight renderer output | 1 | 17 pass, 3 fail |
| G | generic block appended to batch renderer output | 1 | 17 pass, 3 fail |
| H | batch prompt declaration commented out | 1 | 17 pass, 3 fail |

Both retargeted audits and slice test 8 fail under every mutation A–H. `mutations.log` records exits and failing test names; full per-mutation logs remain in corresponding scratch directories.

## Byte identity and verification

`node verifications/issue-30-fix-round-3/compare.mjs`: exit 0; **27/27 UTF-8 byte comparisons identical to cf7dd92**. Covers undecided, bug, feature, conflicting labels, case-insensitive labels, skills/theme/subtasks; single-issue workspace/worktree, batch and consolidated prompts, null and empty inputs. Baseline file obtained with read-only `git show cf7dd92:panel/core.ts`; full evidence in `byte-identical.log`.

- `node --test test/issue-30-work-type.test.js`: 8/8 pass, exit 0 (`slice-tests.log`).
- `node --test test/drafting-and-skills-audit.test.js test/native-skill-declarations.test.js`: 12/12 pass, exit 0 (`retarget-tests.log`).
- `npm test`: final 525/525 pass, exit 0 (`full-suite.log`). Earlier timing failure preserved separately below.
- `npm run typecheck`: exit 0 (`typecheck.log`).
- `npm run build`: exit 0 (`build.log`); second run exit 0 (`build-repeat.log`); both bundle hashes identical, hash-file `cmp` exit 0.
- Panel SHA-256 `7cb9aaafd463c4c59cdfb8a37a3c37b6f3172f1842c68b9076ced8ff2e3f1b3a`; service unchanged at `a29d18cc1a43c823f304119b9effc8231241cd6e2fd07ab4ee36bc9b2cb30f84`.
- `git diff --check`: exit 0. Reviewed product diff against cf7dd92: only R1 source/bundle removal and seven R2 comment deletions.

## Failures and corrections

- DIDN'T WORK: initial R1-only full suite failed shipped parity with `ReferenceError: DEFAULT_WORK_INSTRUCTIONS is not defined`. FINALLY WORKED: `test/shipped-parity.test.js` extraction harness now includes the real renderer dependencies (`resolveIssueWorkType`, `buildWorkTypeInstructions`, four shared rules, default instructions); declaration count strengthened from 52 to 59, parity assertions retained. Harness previously depended on the dead literal fallback; no replacement literal or stub inserted.
- DIDN'T WORK: interim source-regex checks still did not meet behavioral test-8 requirement. FINALLY WORKED: executed actual TypeScript function bodies with real renderer dependencies and inspected live outputs as above; all four required mutations fail all three target tests.
- DIDN'T WORK: one `npm test` invocation returned 524 pass/1 fail because unchanged performance regression measured 52.15 ms against its existing <50 ms limit. FINALLY WORKED: unchanged narrow performance test passed (exit 0), then unmodified full command passed 525/525 (exit 0). No threshold or assertion changed. Evidence retained in `full-suite-timing-failure.log`, `performance-recheck.log`, `full-suite.log`.
- DIDN'T WORK: first local commit failed `fatal: unable to auto-detect email address`. FINALLY WORKED: command-local `-c user.name='OpenChamber Agent' -c user.email='agent@openchamber.dev'`; no shared/global Git configuration change.

## Limits

No real panel/DOM host, GitHub network or human validation exercised. Tests execute extracted live launch functions with stubbed host/DOM state, plus actual exported renderer logic and regenerated shipped-bundle parity. Extraction relies on current top-level declaration boundaries; malformed/missing declaration fails explicitly. `stripTypeScriptTypes` emits Node's experimental-feature warning. No independent final review performed by this builder; no approval or L5 claim.

Provider/model: 9router / Genius.
