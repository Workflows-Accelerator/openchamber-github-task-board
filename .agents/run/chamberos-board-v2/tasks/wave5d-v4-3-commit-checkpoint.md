<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: a6f61f3. NOTHING from V4-3 is committed yet.
Working tree (verify once with `git status --short`, then act):
  M docs/issue-body-contract.md, panel/core.ts, panel/main.js
  M web/public/app.js, web/public/index.html, web/public/theme.css
  M web/server/app.ts, web/server/board.ts
  ?? web/tests/v4-3-client.test.mjs, web/tests/v4-3-human-review.test.mjs
  ?? .agents/run/chamberos-board-v2/verifications/V4-3/README.md (plan only)
  ?? .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — OFF LIMITS, never stage, never modify
Do NOT use `git add .` or `git add -A`. Stage only the paths named below.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Forbidden: any source edit, push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, any GitHub write, credential output, `git remote -v`, file deletion, delegation, starting a browser probe or the delivery smoke.
Environment note: three workers were killed mid-turn by engine restarts. This task is deliberately tiny: commit and report.
</env_preflight>

<goal>
Turn the already-verified V4-3 tree into three local commits and an honest evidence README. Change no source line. The code was written by earlier workers and the manager already ran its tests; your job is to record that state truthfully, not to improve it.
</goal>

<context>
Approved spec: .agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md (read the requirements only; do not extend them).
Existing evidence plan: .agents/run/chamberos-board-v2/verifications/V4-3/README.md — keep its "Inherited diff disposition" section and replace the "Checkpoints" placeholder.
The manager ran these on this exact tree and they are the counts to record:
- `node --test --test-timeout=60000 web/tests/v4-3-human-review.test.mjs web/tests/v4-3-client.test.mjs` -> 27 tests, 27 pass, 0 fail, exit 0.
- `node --test --test-timeout=60000 web/tests/*.test.mjs` -> 699 tests, 698 pass, 1 fail: `simple-views.test.mjs:433` "F9: default startBoard and browserConfig isolate project-names.json per fixture" with `ENOENT: mkdtemp '/tmp/antigravity/f9-isolation-ywyneF'` — a missing temp directory in the environment, not V4-3 code.
You may re-run the focused two-file command once to confirm (it takes ~2 s); do not re-run the full suite.
</context>

<steps>
1. `git status --short` once. Confirm the file set above. If a source file you do not expect is modified, stop and report instead of committing it.
2. Commit the source, documentation and prompts:
   `git add docs/issue-body-contract.md panel/core.ts panel/main.js web/public/app.js web/public/index.html web/public/theme.css web/server/app.ts web/server/board.ts`
   `git commit -m "feat(v4-3): require a clickable artifact before a task waits for the human"`
3. Commit the tests:
   `git add web/tests/v4-3-client.test.mjs web/tests/v4-3-human-review.test.mjs`
   `git commit -m "test(v4-3): human review gate parser, server enforcement and client states"`
4. Rewrite `.agents/run/chamberos-board-v2/verifications/V4-3/README.md` so it states, in this order:
   - Status: checkpoint committed, verification incomplete; local synthetic only; no real GitHub write and no deployment.
   - The "Inherited diff disposition" section, kept as it is.
   - "Checkpoint evidence": the two commands above with the exact counts, exit codes and the one environment failure quoted by name and reason.
   - "Still missing": browser probes at 360x800 / 390x844 / 1280x900 in light and dark, EN and FR for image, video, link, preset question, legacy missing artifact, malformed artifact and in-review; the framing probe; the delivery smoke; the hostile review; the independent review. Say plainly that no screenshot, no framing number and no smoke run exists yet for V4-3.
   - "Not verified": real GitHub, production, Safari/Firefox, physical phone, screen reader.
   Then `git add .agents/run/chamberos-board-v2/verifications/V4-3/README.md` and commit as `test(v4-3): record the checkpoint evidence and what is still missing`.
5. Confirm `git status --short` shows only the untracked `verifications/V4-1-L4/`, and report the three commit SHAs.
</steps>

<output>
At most 10 lines: STATUS, COMMITS (3 SHAs with subjects), FOCUSED_COUNTS, FULL_SUITE_COUNTS with the named failure, TREE_STATE, STILL_MISSING (one line). No claim of completion, review, publication or human acceptance.
</output>
