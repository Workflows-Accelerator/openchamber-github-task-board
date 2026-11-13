<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: a58bcb1 (V4-3 source cd97f8e, tests 3aa50f2, evidence a58bcb1). Tracked tree clean.
Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — never stage, never modify.
Root checkout on ops/task-board-activation: never edit, commit or switch there.
Environment: three workers were killed mid-turn by engine restarts. Work in this order and commit early: write the probe, COMMIT the script, then run it, then commit the output.
Chromium: the launcher and libraries already exist. Read .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh and source it; the executable path and the playwright import trick are in .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser.mjs (line 8 and line 32). Do not install anything system-wide.
Forbidden: any source edit under web/**, panel/**, docs/**, service/**; push; deploy; /workspace/releases/**; /workspace/code/openchamber-config/**; /workspace/.openchamber-data/**; any GitHub write; credential output; `git remote -v`; file deletion; delegation.
Do NOT run scripts/generate-delivery-smoke.mjs in this task (a separate task owns it). Do not run the full node test suite.
</env_preflight>

<goal>
Produce the missing visual proof for V4-3: real Chromium screenshots and a machine-readable report showing that a task waiting for the human always carries a clickable artifact with exactly one action, that a legacy or malformed waiting task says precisely why it cannot be settled, and that "an agent is reviewing" is visibly not "you must decide".
</goal>

<context>
Approved spec: .agents/run/chamberos-board-v2/tasks/wave5a-v4-3-policy-in-product.md (see its <verification> item 1).
The implementation is committed at cd97f8e. Its own tests are 3aa50f2 (27 tests, 27 pass). Read those two test files to learn the exact payload field names, artifact kinds and the reason codes, so the probe asserts the real contract instead of inventing selectors: web/tests/v4-3-client.test.mjs and web/tests/v4-3-human-review.test.mjs.
Harness to reuse, not reinvent: .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser.mjs — it starts `startFakeGitHub`, `startBoard`, drives the real client, records page errors, console errors and CSP violations. Copy it to .agents/run/chamberos-board-v2/verifications/V4-3/scripts/ (same directory depth, so the relative imports still resolve) and adapt. Prior evidence directories are immutable: never edit anything under V4-2/, V4-2-L4/ or V4-2-L4-delta/.
Known trap: the V4-2 probe at line ~86 sets issue 1 to status:needs-human. Under V4-3 that write is now refused unless the body carries a valid artifact, so a straight copy will fail there. Give each fixture issue a body whose "### Human Review:" section matches what the parser accepts, and record that fixture adjustment in the report. Never weaken an assertion to get past it.
</context>

<steps>
1. Read the two V4-3 test files and the V4-3 parser section in web/server/board.ts to get the exact section format, kinds, states and reasons. Read the V4-2 browser.mjs harness.
2. Write .agents/run/chamberos-board-v2/verifications/V4-3/scripts/browser.mjs. Its fixture must contain, as separate issues, one card in each of these seven states:
   a. waiting with an image artifact and a one-line instruction;
   b. waiting with a video artifact;
   c. waiting with a link artifact;
   d. waiting with a preset question (the V4-2 `  - label :: gist :: details` shape, with details disclosure and a free-text path);
   e. legacy waiting (status:needs-human, body with no Human Review section) — must show the precise reason and offer nothing clickable;
   f. malformed artifact (section present but invalid: wrong kind, or a non-https URL, or a missing instruction) — must show its precise reason;
   g. in-review with no artifact — must read as agent review and ask nothing of the user.
   For each state, assert in the real DOM: the artifact or reason is visible; exactly one primary action for a, b, c and d and its label is the right one per kind and language; zero actions for e, f and g; the one-line instruction is visible for a, b and c; the image renders inline with a non-empty alt and its natural width is greater than zero; the preset question renders the option cards with a Details disclosure and keeps a free-text answer field.
3. Commit the script alone: `test(v4-3): probe the human review gate in real Chromium`.
4. Run it. Matrix: viewports 360x800, 390x844, 1280x900 x themes light and dark x languages EN and FR, for all seven states. Screenshots named `{state}-{width}-{theme}-{lang}.png` under verifications/V4-3/screenshots/. Write verifications/V4-3/browser.json with: matrix rows, per-state assertions, pageErrors, consoleErrors, csp violations, and for every row the measured `document.documentElement.scrollWidth` and whether any gate element overflows its container horizontally at 360 and 390.
   Requirements: zero unexpected page errors, zero console errors (classify deliberately injected HTTP failures explicitly, as the V4-2 probe does), zero CSP violations. Language switch must be driven through the real UI control, not by rewriting text.
5. Commit the output: `test(v4-3): record human review gate browser evidence`. Keep browser.json and the screenshots in the same commit.
6. Report the real numbers. If a state fails an assertion, do NOT weaken the assertion and do NOT edit application code: record the failure verbatim in the report and in verifications/V4-3/README.md under a "Browser evidence" heading, and say whether it is a product defect or a probe defect. If it is a probe defect you may fix the probe in a follow-up commit.
</steps>

<output>
At most 12 lines: STATUS, COMMITS, MATRIX (states x viewports x themes x languages, screenshot count), ASSERTIONS (per state: action count, label, instruction, inline image, presets+details+free text), OVERFLOW (360 and 390 result), ERRORS (page/console/CSP counts), FIXTURE_ADJUSTED, README updated yes/no, NOT_VERIFIED. No claim of completion, review, publication or human acceptance.
</output>
