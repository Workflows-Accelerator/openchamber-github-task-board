<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: b57e894 plus whatever the framing/smoke task committed (check `git log --oneline -n 8` once). Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS, never stage, never modify.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh. The delivery smoke needs a 900000 ms foreground timeout; never end your turn with a job still running.
Forbidden: push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, any GitHub write, credential output, `git remote -v`, file deletion, delegation, any test weakened or skipped to reach green.
</env_preflight>

<goal>
Conduct a hostile review of the V4-3 change (cd97f8e source, 3aa50f2 tests, 78abf40/6127e35 probe, b57e894 browser evidence) to figure out what was missed or what is broken. Do not assume it is right. Then fix only defects you can prove, each with a test.
</goal>

<context>
Approved spec: .agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md.
Evidence already on disk: verifications/V4-3/README.md, browser.json, 96 screenshots, and whatever the framing/smoke task appended. Read them, then verify independently — a recorded log is not proof.
The claim under review: a task may enter the state the board presents as "waiting for you" only when its body carries a clickable artifact (image, video, link, each with a one-line instruction) or a question with preset answers and a free-text path; malformed or absent artifacts are refused server-side with a precise 4xx and rendered client-side with a precise reason; "an agent is reviewing" is presented as such and asks nothing of the user.
</context>

<what_to_attack>
1. Every path that can produce a waiting card, not only the one route the tests cover: issue creation, the status endpoint, the multi-repo status route, an issue edited on GitHub outside the board, a reopen, a label added by another tool, a question answered while the gate is missing, and a body edit that removes or rewrites the Human Review section. For each: what does the user see, and can a card end up waiting with nothing to click?
2. The parser: fenced and indented headings, two Human Review sections, a section with a valid artifact followed by an invalid one, CRLF line endings, a URL with query string or fragment, a non-https scheme (javascript:, data:, http:), an instruction containing Markdown that could inject markup, an instruction or URL at the documented cap and one character over, an artifact kind in the wrong case, and a body that is only the section. Prove each with a real call, not by reading.
3. The guard's blast radius: does it block a legitimate write that has nothing to do with the human gate (a label change, a body edit, an answer, a close), and does it write nothing when it refuses — check the fake GitHub's recorded calls, not just the response code.
4. Presentation honesty: does the legacy card offer a way forward that does not lie (a status change, an explanation), or does it dead-end the user? Does the in-review card ever ask something? Does the gated question stay answerable in both languages and at 360?
5. CSP and image safety: the image is loaded from a remote https URL under a strict style-src 'self' policy — check what happens when the image 404s, when the URL is not an image, and whether any artifact URL can become a click target that executes script.
6. Whether the probe proves the promise or merely restates the implementation: read verifications/V4-3/scripts/browser.mjs and say which assertions would still pass if the feature were subtly wrong (for example if the instruction were invisible, or if a second action were rendered but hidden).
7. Non-regression, re-run not re-read: agent notes as append-only GitHub comments, Markdown Decisions with presets, D37 0.55 floor and Show all, D38 rail toggle, filter and focus return state, drag save and rollback, Arrange + Undo, zero "n8n"/"mobile"/emoji, dot grid unchanged, Canvas/Canevas and List/Liste.
</what_to_attack>

<steps>
1. Read the diff cd97f8e and the tests 3aa50f2 in full. List every claim they make, then test the ones that matter against the running board with the synthetic fixture.
2. Write your attacks as small scripts under verifications/V4-3/scripts/attack/ (do not modify the existing probe) and keep their raw output.
3. Fix only proven defects, each with a failing test first, in `fix(v4-3): …` commits. No refactor, no cosmetic change, no new feature. If a finding is a genuine product fork rather than a defect, report it and stop on that item.
4. Re-run the affected proofs after any fix: the V4-3 test files, the web suite, the browser probe, and the framing probe. Re-run the delivery smoke only if you touched a surface it covers.
5. Append a "Hostile review" section to verifications/V4-3/README.md: each finding with severity, the exact evidence, fixed or not fixed and why. Commit it.
</steps>

<output>
At most 18 lines: STATUS, FINDINGS (each: severity, one line, fixed/not fixed), COMMITS, TEST_COUNTS with exit codes, PROBE_HONESTY (which assertions are weak and what you added), PATHS_COVERED, NOT_VERIFIED. No claim of completion, review, publication or human acceptance.
</output>
