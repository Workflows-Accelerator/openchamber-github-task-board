<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: d29699f (independent review evidence). Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS, never stage, never modify.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh. Suites strictly sequential. The delivery smoke needs a 900000 ms foreground timeout. Never end your turn with a job you started still running.
Environment: engine restarts have killed workers mid-turn. Commit each fix as soon as its test is green.
Forbidden: push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, any real GitHub mutation, credential output, `git remote -v`, file deletion, delegation, weakening or skipping any test, editing prior evidence directories (V4-2*, V4-3-L4/).
</env_preflight>

<goal>
Close the independent review's findings F1–F4 on V4-3 so the change can be published. Nothing else: no refactor, no rename, no new feature.
</goal>

<context>
Verdict and evidence: .agents/run/chamberos-board-v2/verifications/V4-3-L4/README.md (read it first; its attack scripts reproduce F1 and F2).
Spec: .agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md.
The user's rule, verbatim intent: a human is only ever asked to click — a screenshot, a short video, a link, or a question with preset answers. Anything needing code, a command or a dev server must never wait on a human.
</context>

<fixes>
F1 (Medium, BLOCKS PUBLISH): answering a gated question moves the task to status:in-progress whatever its status was (web/server/app.ts ~2844-2854, from 947b80e). Make the move conditional on the task currently being in the human-wait status (the reviewer suggests `isHumanReviewGateStatus(baseStatus)`). A done, in-review, todo or in-progress task keeps its status after an answer. Failing test first, covering at least done, in-review and needs-human.
F2 (Low): creation with labels ['status:todo','status:needs-human'] returns 201 and lands in the waiting column while the card reads todo with no review panel. Pick the smallest honest fix: refuse conflicting status labels on creation with a precise 400 and zero writes, OR apply the same gate as a needs-human creation. Say which and why. Failing test first.
F3 (Low): a question gate with no preset answers is accepted, so the human must type. The user's rule requires preset answers. Make a question artifact without at least one preset option parse as malformed with a precise reason (EN and FR text, key-for-key), refused server-side like any other malformed artifact. Update docs/issue-body-contract.md §2.9 and the two prompt constants (panel/core.ts and the shipped panel/main.js strings, kept in parity) so agents are told presets are mandatory; the documentation lock tests must still pass. The free-text path stays available alongside the presets. Failing test first.
F4 (Low): for a too-long URL or one with a space, the client says "must start with http:// or https://" instead of the precise reason. Show the precise reason the parser/server already computes, EN and FR. Failing test first.
Out of scope, do NOT touch: F5 (Operations view / panel/labels.ts / OpenChamber panel still say Needs human / In review) and F6 (probe weakness already covered by later probes). Record them as carried.
</fixes>

<steps>
1. Read the V4-3-L4 README and reproduce F1 and F2 with its scripts before changing anything.
2. For each fix in order F1, F2, F3, F4: failing test, minimal fix, focused V4-3 tests green, commit `fix(v4-3): …`.
3. Re-run sequentially: focused V4-3 tests, `node --test --test-timeout=60000 web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, esbuild of web/server.ts and the client, the V4-3 browser probe (verifications/V4-3/scripts/browser.mjs) and the hostile attack scripts under verifications/V4-3/scripts/attack/. Run the framing probe only if you touched layout; run the delivery smoke only if you touched a surface it covers (F3/F4 touch client text — decide and say).
4. Hostile self-review: re-read your own diff d29699f..HEAD assuming it is wrong. In particular, check that F3 does not turn any existing valid fixture, smoke card or browser-probe question into a malformed one by accident, and that F1 still moves a waiting task out of the waiting column.
5. Write .agents/run/chamberos-board-v2/verifications/V4-3-fixes/README.md: each finding, the fix, the test name, exact counts and exit codes, what is carried. Commit it.
</steps>

<output>
At most 12 lines: STATUS, FIXES (F1–F4 each: approach, test, commit), TEST_COUNTS with exit codes, PROBES re-run, HOSTILE_SELF_REVIEW findings, CARRIED (F5, F6 and the L1/L4 caveats), NOT_VERIFIED. No claim of review, publication or human acceptance.
</output>
