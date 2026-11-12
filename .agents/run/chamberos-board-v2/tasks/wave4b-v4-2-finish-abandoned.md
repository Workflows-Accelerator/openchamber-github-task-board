<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: d1eef33 (V4 is LIVE; release 26fbc00-20261112)
State at dispatch: DIRTY and uncommitted. HEAD is still d1eef33 — the previous worker (ses_9e0d1c9ef4415dc77f472bbf) ended idle without committing anything.
Modified: web/public/app.js, web/public/index.html, web/public/theme.css, web/server/app.ts, web/server/board.ts, web/server/github.ts, web/tests/fake-github.mjs
Untracked: web/tests/v4-2-client.test.mjs, web/tests/v4-2-decisions.test.mjs, web/tests/v4-2-notes.test.mjs, .agents/run/chamberos-board-v2/verifications/V4-2/
Also untracked and OFF LIMITS (preserve untouched, never stage): .agents/run/chamberos-board-v2/verifications/V4-1-L4/
Treat every uncommitted line as UNVERIFIED authorship. Nothing has been reviewed or accepted.
Root checkout: /workspace/code/openchamber-github-task-board on ops/task-board-activation — DO NOT modify, switch or commit there.
Runtime: Node 20, Playwright package and Chromium 156 already installed; launch them the way the committed probes under verifications/V4-2/scripts and verifications/V4-final-L4/scripts already do. No new dependency, no system install, no stale /tmp env script.
Timeouts: scripts/generate-delivery-smoke.mjs takes longer than 4 minutes. Run it with an explicit long timeout (900000 ms) and NEVER let a default tool timeout kill it; a previous run was killed at 240 s (exit 143) and left an empty log. Never run two suites at once. Never loop re-runs to get green: one clean run per suite, failures preserved.
</env_preflight>

<goal>
Finish the V4-2 increment that was abandoned mid-verification: triage the uncommitted work, resolve the two failing phone framing probes on evidence, complete a clean verification pass, write the evidence README, and commit source, tests and evidence separately. Keep the two user requests intact: a quick note on the open issue stored as a real GitHub comment visible to the working agent, and Decisions questions rendered as Markdown with preset answers carrying expandable details.
</goal>

<inherited_state>
- The worker's own browser probe recorded pass:true, 12 cases, 48 screenshots, with: note marker `<!-- board-note: 1 -->`, append-only comments, reload survival, Escape/Ctrl+Enter, 2 agent notes on a list row, failure retry keeping text with a plain-language error, lost-response reconciliation, honest degraded chip, 18 conditional comment requests, no extra render requests; Decisions selected option saved, legacy free text saved, headings/lists/inline code/links/emphasis rendered, no raw markers, preset free-text fallback; canvas sticky notes unchanged; rail toggle; drag save + reload + refused-write rollback; Arrange + Undo exact.
- web/tests/*.test.mjs reached 666 tests, 666 pass, 0 fail (baseline was 631, so 35 new). Typecheck and esbuild passed.
- The last delivery-smoke run was cut off, leaving an empty/partial log: it must be re-run once, cleanly, with the long timeout.
- regressions log records two FAILED cases (360 light en, 360 light fr): `zoomAfterFit:0.55`, `neighbourhoodInside:false`, `filteredAllInside:false`, `cardsUnderHud:["acme/vanilla-sdk#11"]`, `hudHeight:48`. These numbers are consistent with an OLD probe expecting automatic framing to contain the whole neighbourhood at the readable floor, which the user explicitly rejected in D37. Do not assume that: prove it or disprove it.
</inherited_state>

<decisions_that_must_not_change>
- D37: automatic dependency framing never goes below 0.55; "Tout afficher (N)" / "Show all (N)" gives the real full fit on demand.
- D39: after an incomplete full fit, keep the truthful zoom-limit message, hide labels whose endpoint is off screen, never claim a fit that did not happen, no new navigation.
- D38: desktop collapsed rail keeps a visible reopen toggle; phone drawer unaffected.
- Filter/dependency return-view state must stay exact (no stale filterView, no premature pending consumption).
- Nothing fake or simulated shipped; canvas sticky notes remain a different object from agent notes.
</decisions_that_must_not_change>

<steps>
1. Read `git diff` in full, plus the three new test files and the V4-2 evidence scripts. For each modified file and hunk decide keep / fix / discard, and state the disposition in the report. Discard anything you cannot justify against the goal, the decisions above, or the user's words.
2. Reproduce the two failing regression cases. Determine with evidence whether they encode a stale pre-D37 expectation (automatic framing capped at 0.55, whole neighbourhood not contained, a card under the HUD at 360) or a genuine regression caused by this increment. If stale: do not change approved behaviour; keep the original assertion in the evidence, document the disposition, and make the probe judge what the product actually promises. If genuine: fix the application and prove it.
3. Check the note path for real-world hazards, not only fixtures: what happens when the token cannot comment, when the response is lost, when the issue is locked, when the body is empty, when the user double-sends. Confirm the marker cannot be spoofed by a human comment into being treated as a note, and that existing comments are never edited or deleted.
4. Check the Decisions path: an older-format question (no preset options) still renders and stays answerable; a question with malformed option markup degrades to plain text instead of breaking the view; answers still write through the existing flow.
5. Re-run, sequentially, with real counts and exit codes: `npm test`, `node --test --test-timeout=30000 web/tests/*.test.mjs`, `npm run typecheck`, the esbuild bundle check, and one clean `node scripts/generate-delivery-smoke.mjs` with the long timeout. Baseline counts must not drop; no assertion weakened or skipped.
6. Re-run the browser probes you rely on (note composer, note in activity, reload, failure retry, Decisions Markdown, option details expanded/collapsed) at 360x800, 390x844, 1280x900, Light and Dark, EN and FR, with zero console errors and zero CSP violations.
7. Write `.agents/run/chamberos-board-v2/verifications/V4-2/README.md`: measurements, regression disposition with the old expectation preserved, real counts and exit codes, screenshot index, and an explicit NOT_VERIFIED list (no production, no real GitHub, no Safari/Firefox, no physical device, no screen reader, no 1000-card board).
8. Commit in three separate commits on `feat/board-v3`: source, tests, evidence. Leave the tracked tree clean; only the untracked V4-1-L4/ may remain.
9. Required hostile self-check before reporting: conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Do not assume that what you did is right. Re-run the real probes, not only unit tests, and record every correction you made in this pass.
</steps>

<scope>
Owned: web/public/app.js, web/public/index.html, web/public/theme.css, web/server/app.ts, web/server/board.ts, web/server/github.ts, web/tests/**, scripts/generate-delivery-smoke.mjs only if a new surface genuinely needs smoke coverage, and .agents/run/chamberos-board-v2/verifications/V4-2/**.
Forbidden: git push, deployment, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, any real GitHub mutation on the user's repositories, deleting files, `git remote -v`, printing any credential, panel/**, service/**, web/public/arrange.js, web/public/markdown.js internals, the dot-grid function.
Do not delegate further. If a genuine product fork appears, report it instead of choosing silently.
</scope>

<output>
Return concise structured Markdown, at most 20 lines:
- STATUS: PASS | FAIL | BLOCKED
- DIRTY_STATE_DISPOSITION: per file or hunk kept / fixed / discarded
- COMMITS: source, tests, evidence SHAs
- REGRESSION_VERDICT: stale expectation or real defect, with the numbers that prove it
- NOTE_FLOW: marker, route, hazards checked, API cost
- DECISIONS: markdown coverage, option convention, older-format and malformed cases
- SELF_HOSTILE: what the hostile pass found and fixed
- TEST_COUNTS: real numbers and exit codes, sequential
- SCREENSHOTS: paths
- NOT_VERIFIED
No claim of live, deployment or human acceptance.
</output>
