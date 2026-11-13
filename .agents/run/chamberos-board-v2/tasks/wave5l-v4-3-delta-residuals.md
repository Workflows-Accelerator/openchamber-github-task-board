<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 205695c (V4-3-L4-delta evidence). Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS, never stage, never modify.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh before the probe.
Environment: engine restarts have killed workers mid-turn. Two small tasks; commit each the moment it is green.
Forbidden: push, deploy, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, real GitHub mutation, credential output, `git remote -v`, deletion, delegation, editing prior evidence directories (V4-2*, V4-3-L4/, V4-3-L4-delta/), any change to application behaviour.
</env_preflight>

<goal>
Close the two documentation/evidence defects the delta review found, so the published change is not contradicted by its own documentation and its own probe. No behaviour change, no new feature.
</goal>

<context>
Delta verdict: .agents/run/chamberos-board-v2/verifications/V4-3-L4-delta/README.md — DELTA PASS, PUBLISH YES, with two Low residuals for you.
</context>

<tasks>
1. Documentation contradiction (Low, but it misleads agents). docs/issue-body-contract.md §2.5 and the Open Questions prompt bullet still say preset answers are "never a required choice", while §2.9 now requires at least one preset for a human-review question gate. Scope the rule instead of blanket-requiring presets:
   - a question gate that makes a task wait for the human (§2.9) MUST offer at least one preset answer;
   - an ordinary open question that does not gate the task MAY stay free-form.
   Update the prose in §2.5 and the prompt bullet so both sections agree with §2.9, and keep panel/core.ts and the shipped panel/main.js prompt strings in parity (the documentation lock tests must still pass, including the byte-identical restore test). Wording: short, plain, no new concept, both languages where the strings are bilingual.
   Commit: `docs(v4-3): scope the preset-answer rule to the human review gate`.
2. Stale probe expectations. verifications/V4-3/scripts/browser.mjs as committed now fails 12 of 84 rows because F4 (0da2997) replaced the generic URL message with the precise one; the probe still asserts the old string. Update the probe's expectations to the real new strings in both languages — this is correcting a stale expectation, NOT weakening an assertion: the check must still fail if the message loses the 2048 or the no-space rule. Then re-run the probe and record green output.
   Commit the script as `test(v4-3): refresh the probe's URL message expectations`, then the re-run evidence as `test(v4-3): record the refreshed probe run`.
3. Append a short "Delta residuals closed" section to verifications/V4-3/README.md: what changed in the docs, the probe re-run counts, and that F5 (Operations view / panel/labels.ts wording), the preset-less live gate (answer then status control), the saved-prompt override, the third-party image host and the four unnamed URL causes remain open and known. Commit with the evidence.
</tasks>

<output>
At most 8 lines: STATUS, COMMITS, DOC_LOCK (tests and counts), PROBE (rows, assertions, failures, exit code), REMAINING_OPEN (one line), NOT_VERIFIED. No claim of review, publication or acceptance.
</output>
