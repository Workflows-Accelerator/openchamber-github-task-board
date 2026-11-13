<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: a6f61f3. NOTHING from V4-3 is committed yet.
Dirty, inherited from two interrupted workers (both confirmed idle and explicitly stopped; you are the only writer):
  M docs/issue-body-contract.md, panel/core.ts, panel/main.js
  M web/public/app.js, web/public/index.html, web/public/theme.css
  M web/server/app.ts, web/server/board.ts
  ?? web/tests/v4-3-client.test.mjs, web/tests/v4-3-human-review.test.mjs
  ?? .agents/run/chamberos-board-v2/verifications/V4-3/README.md (plan only, no results)
  ?? .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — OFF LIMITS, never stage, never modify
No commit, no suite run and no browser proof exists for any of these edits. Treat every line as unverified.
Environment is unstable: two workers were killed mid-turn by engine restarts. Work in small steps and commit early so an interruption costs little.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Forbidden: push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, any GitHub write, credential output, `git remote -v`, file deletion, delegation.
Preflight is authoritative: do not re-discover with pwd/ls/git status beyond a targeted check; go straight to the tests.
</env_preflight>

<goal>
Turn the uncommitted V4-3 code into a tested, committed checkpoint. Do not extend scope: no new features, no documentation work, no browser proofs in this task.
</goal>

<context>
Read .agents/run/chamberos-board-v2/verifications/V4-3/README.md for the previous worker's own disposition of the inherited diff, then the approved spec at .agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md.
</context>

<steps>
1. First run the two new test files alone: `node --test --test-timeout=60000 web/tests/v4-3-human-review.test.mjs web/tests/v4-3-client.test.mjs`. Record the real counts and failures.
2. Fix only what those tests reveal, or what the code plainly gets wrong against the spec (a parser crash, a guard that never fires, a missing translation). Keep changes surgical; the parser and guard design already on disk is the starting point, not something to redesign.
3. Run `node --test --test-timeout=60000 web/tests/*.test.mjs` once and `npm run typecheck`. Record counts and exit codes. If an existing test fails because a fixture body now needs a valid artifact, adjust the fixture minimally and say so; never weaken an assertion, never skip.
4. COMMIT IMMEDIATELY once the focused tests and typecheck are green: one commit for source (`feat(v4-3): require a clickable artifact before a task waits for the human`), one for tests, each listing what is still missing. Do not wait to have everything perfect before committing.
5. Update verifications/V4-3/README.md with the real counts and an explicit "still missing" list (documentation lock, panel prompt mirroring, browser probes, framing probe, delivery smoke, hostile review) and commit it as evidence.
6. If the engine interrupts you, the commits from step 4 are what matters; leave the tree clean.
</steps>

<output>
At most 12 lines: STATUS, COMMITS, TEST_COUNTS (focused and full, with exit codes), FIXTURES_ADJUSTED, STILL_MISSING, NOT_VERIFIED. No claim of completion, publication or review.
</output>
