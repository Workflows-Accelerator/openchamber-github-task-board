<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Reviewed range: d29699f..68c5053 (the F1–F4 corrections to the change you already reviewed as V4-3-L4; the full change under publication is a6f61f3..68c5053).
Tree: tracked clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Root checkout on ops/task-board-activation: read-only, never edit, commit or switch.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh. Suites sequential. 900000 ms foreground timeout for the smoke. Never end your turn with a job you started still running.
Forbidden: push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, real GitHub mutation, credential output, `git remote -v`, deletion, application edits, editing prior evidence directories.
</env_preflight>

<goal>
Decide whether the F1–F4 corrections are correct, minimal and safe to publish. You are the independent reviewer of a delta: the author of these fixes is a worker, and the manager wrote the brief. Assume the fixes are wrong until you have proved otherwise.
</goal>

<context>
Your own previous review: .agents/run/chamberos-board-v2/verifications/V4-3-L4/README.md — F1 Medium blocked publication, F2/F3/F4 Low, F5/F6 carried. The author's record of the corrections: .agents/run/chamberos-board-v2/verifications/V4-3-fixes/README.md (a claim, not proof).
The manager made one product decision inside F3: a question gate must offer at least one preset answer, because the user's rule is "une question avec des réponses préfaites". Judge whether the implementation matches that decision and whether the free-text path survives.
</context>

<what_to_check>
1. Read `git diff d29699f..68c5053` in full. For each fix: is it minimal, does it hold on the paths you attacked before, and did it change anything beyond its finding?
2. F1: re-run your own reproduction on done, in-review, todo, in-progress and needs-human. Then check the reverse: a waiting task answered still leaves the waiting column, and the card reads the settled state in EN and FR.
3. F2: what exactly is refused, and is a legitimate single-status create with needs-human plus an artifact still accepted? Does the refusal write nothing (fake GitHub recorded calls)? Is the error message precise and does the client show it?
4. F3: does a preset-less question now read malformed everywhere it can appear — creation, status route, body edit, a live issue edited on GitHub — and is it still answerable through the Open Questions surface so the user is never dead-ended? Are the docs §2.9, panel/core.ts and the shipped panel/main.js strings still in parity, and does the documentation lock test still fail under a mutation?
5. F4: is the new reason accurate for a too-long URL, a URL with a space, a relative URL and a javascript:/data: URL, in EN and FR? Any case where the new text is now wrong?
6. Regression: does any existing fixture, smoke card or probe question silently become malformed? Grep the fixtures and run the suites yourself, sequentially: focused V4-3 tests, the web suite, `npm test`, typecheck, esbuild, the V4-3 browser probe, the framing probe, and the delivery smoke with the long timeout. Run your own attack scripts again.
7. Judge the new caveats the author recorded: a live preset-less question gate now reads malformed until given a preset; a create with two status labels now gets 400. Are they acceptable, or do they need a migration story before publishing?
</what_to_check>

<verdict>
- DELTA: PASS or FAIL for d29699f..68c5053.
- PUBLISH for a6f61f3..68c5053: YES or NO, with the exact caveats to tell the user before it goes live.
Write your evidence under .agents/run/chamberos-board-v2/verifications/V4-3-L4-delta/ and commit it there. Do not fix application code. Do not push.
</verdict>

<output>
At most 12 lines: STATUS, DELTA verdict, per-fix ruling (F1–F4), PUBLISH verdict, TEST_COUNTS with exit codes, PROBES re-run, NEW_CAVEATS accepted or not, NOT_VERIFIED.
</output>
