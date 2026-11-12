<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: a7867e8 (V4-2 built and independently reviewed: SPEC PASS, QUALITY CHANGES REQUIRED for H1 only)
Review evidence: .agents/run/chamberos-board-v2/verifications/V4-2-L4/README.md (read it, especially H1, H5, H6)
Tree: tracked clean. Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — never stage, never touch.
Root checkout on ops/task-board-activation: DO NOT modify, switch or commit there.
Suites run SEQUENTIALLY. Delivery smoke needs a 900000 ms tool timeout and the Chromium env script already under verifications/V4-2/scripts/. Never end your turn with a job you started still running.
Hard limits: local commits only. No push, no deploy, no /workspace/releases, no /workspace/code/openchamber-config, no /workspace/.openchamber-data, no real GitHub mutation, no credential output, no `git remote -v`, no file deletion.
</env_preflight>

<goal>
Make the preset-answer feature actually reachable, and remove two misleading error messages the independent review flagged. Today the `  - label :: gist :: details` convention exists only as a comment in web/server/board.ts, so no issue author and no agent prompt knows it, and the feature stays inert.
</goal>

<h1_blocking>
The independent reviewer ruled that publication is blocked until the convention is documented where issue authors and the agent actually read it:
1. `docs/issue-body-contract.md` §2.5 (questions) must describe the option syntax: the exact format, where it goes inside the question block, at most 8 options, labels at most 120 characters, gist on one line, details free Markdown, and what happens when a line is malformed (skipped; all-invalid falls back to the plain question). Reconcile it explicitly with that document's "self-contained prose" rule: state that the option lines are recommendation metadata that the board renders, that the question must still read correctly as plain prose when the options are stripped, and that the free-text answer always stays valid.
2. Every AI authoring prompt in `panel/core.ts` that describes how to write a question must name the convention so the model emits it, and must keep the existing instruction that a question needs a free-text answer path.
3. Add or update fixtures/tests so the documented example is the one the parser accepts: an example copied verbatim from `docs/issue-body-contract.md` must parse into options in web/server/board.ts, and a test must fail if the document's example and the parser disagree. That test is the point: it stops the doc and the code from drifting apart again.
</h1_blocking>

<h5_and_h6_copy>
Two messages blame the wrong thing; correct them, EN and FR, keeping the dictionary sizes equal:
- A 410 on a comment means the issue's conversation is unavailable (issues disabled, or deleted/transferred), not necessarily "This issue no longer exists". Say what is true and actionable.
- The 4,000-character limit is the board's own, not GitHub's. Say so.
Do not change any other user-facing wording in this pass.
</h5_and_h6_copy>

<leave_alone>
Everything else the reviewer listed ships as-is with a stated caveat: client-only dedupe, the notes cache bound, the `N+` chip, the upstream validation text in the 400 body, arrow-key/search-reader measurements. Do not touch panel behaviour beyond prompt text, do not change the parser's accepted syntax, do not change D37/D38/D39 behaviour.
</leave_alone>

<verification>
Run sequentially, real counts and exit codes:
1. `npm test` (panel suite; it must stay at 618/618, the reviewer's baseline at this load)
2. `node --test --test-timeout=60000 web/tests/*.test.mjs` (670 baseline; report any timeout separately from failures)
3. `npm run typecheck`
4. esbuild bundle check for web/server.ts and the client
5. `node scripts/browser.mjs` from verifications/V4-2 (12 cases, 48 screenshots) because user-facing copy changed
6. `DELIVERY_DIR=… node scripts/generate-delivery-smoke.mjs` with the 900000 ms timeout
Then a hostile self-check: conduct a hostile review of your own edits to find what you missed or broke. Do not assume you are right. Re-read the rendered example in the contract against the parser by hand, and check that the EN and FR dictionaries still have equal keys.
</verification>

<commit_policy>
Two commits on feat/board-v3: `feat(v4-2): document preset options where authors and prompts read them` (docs, panel prompt text, parser test, copy fixes, tests) and evidence under .agents/run/chamberos-board-v2/verifications/V4-2/ (append a short "H1 correction" section to the README rather than rewriting history). Tracked tree clean at the end except the untracked V4-1-L4/.
</commit_policy>

<output>
At most 15 lines: STATUS, COMMITS, DOC_EXAMPLE_TEST (how the doc and parser are locked together), PROMPTS (how many places now name the convention), COPY (H5, H6), TEST_COUNTS with exit codes, SELF_HOSTILE, NOT_VERIFIED. No claim of publication or human acceptance.
</output>
