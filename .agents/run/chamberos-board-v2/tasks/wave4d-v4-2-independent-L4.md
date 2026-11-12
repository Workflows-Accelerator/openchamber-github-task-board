<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Reviewed range: d1eef33..[FILL_HEAD_SHA] (d1eef33 is the live V4 release; everything after it is V4-2)
Tree: tracked clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ must stay untouched and unstaged.
Root checkout on ops/task-board-activation: DO NOT modify, switch or commit there. Read-only for this review.
Constraints: no git push, no deploy, no /workspace/releases, no /workspace/code/openchamber-config, no /workspace/.openchamber-data, no real GitHub mutation, no credential output, no `git remote -v`, no file deletion.
</env_preflight>

<goal>
Independently verify V4-2: a quick note on the open issue stored as a real GitHub comment (visible to the agent working the issue), and Decisions questions rendered as Markdown with preset answers and expandable details. You did not write this code. Your job is to find where it is wrong, unsafe or unproven, and to say plainly whether it may be published.
</goal>

<what_the_author_claims>
Read .agents/run/chamberos-board-v2/verifications/V4-2/README.md first, then verify each claim yourself:
- Commits 5430f36 (source), b0718cc (tests), aa9e1e3 (evidence).
- Marker `<!-- board-note: 1 -->` as the first non-blank line; comments append-only, never PATCHed or DELETEd; a quoted or later marker is not a note.
- POST /api/issues/:n/notes and /api/repos/:o/:r/issues/:n/notes behind CSRF and a per-issue lock; 400 for empty/oversized; 403 forbidden/locked, 404, 422 refuse honestly and create nothing; a lost response reconciles without duplicating; a double send creates 1 comment.
- One conditional comments GET when the drawer opens (304 when unchanged); 0 comment requests for the board list.
- Decisions: format `  - label :: gist :: details`; rendered through web/public/markdown.js; legacy questions still render and are answerable; malformed options degrade instead of breaking the view; answers still post to /questions/:i/answer.
- Web tests 669/669 (baseline 631), typecheck and esbuild clean, browser probe 12 cases / 48 screenshots, framing promise probe 12/12 covering D37/D39.
- `npm test` (panel suite) was NOT green across two runs: 617/618 and 615/618, different failures, all in test/ files importing only panel/**, which has no diff. The author calls it pre-existing flakiness; that was not proven at the time of writing.
</what_the_author_claims>

<what_to_check>
1. Read the full diff d1eef33..HEAD yourself, including web/server/app.ts, web/server/board.ts, web/server/github.ts, web/public/app.js, index.html, theme.css and the four test files.
2. Security and blast radius of the write path: CSRF enforced on both routes; the per-issue lock released on every error path (throw, abort, timeout); note body size cap enforced before any GitHub call; the repo is checked against the configured repo set so a caller cannot comment on an arbitrary repository; no token, header or upstream error text reaches the client; marker parsing cannot be spoofed into trusting a human comment; nothing ever edits or deletes an existing comment.
3. Failure honesty: every refusal produces a message naming what failed, in EN and FR, with no generic "outcome unknown" and no claim of success when nothing was created. The composer keeps typed text and offers a retry.
4. Data-model separation: agent notes vs canvas sticky notes remain distinct objects; no duplicated storage; the GitHub comment stays the only source of truth.
5. Decisions: Markdown cannot inject script, an `href` cannot be `javascript:`, option label/gist/details are escaped; an old question with no options is untouched; an all-invalid option block falls back to legacy; radiogroup semantics and aria-expanded are real, not decorative.
6. Non-regression on the released surfaces: 0.55 framing floor with the honest limit message and hidden off-screen labels, filter/dependency return-view state, D38 desktop rail toggle, drag save + reload + refused-write rollback, Arrange + Undo exactness, strict CSP with no new inline styles, zero "n8n"/"mobile"/emoji, dot grid unchanged, views Canvas/Canevas and List/Liste.
7. The framing "regression" disposition: confirm from git history and from the probe's own code that the old probe really predates D37 and that the new probe asserts what the product promises instead of restating the implementation.
8. npm test: run the panel suite at HEAD once and, with a detached worktree at d1eef33 (`.worktrees/team-dev-v4-2-base`, removed afterwards), once on the released base. Report both results and whether the difference is pre-existing flakiness or a real regression. If you cannot settle it, say so.
9. Run the suites yourself, sequentially, with the existing scripts and the documented Chromium env: web tests, typecheck, esbuild check, browser probe, framing probe, delivery smoke (900000 ms timeout). Do not trust the recorded logs alone; spot-check that the JSON agrees with the logs.
</what_to_check>

<verdict>
- SPEC: PASS or FAIL. Does it do what the user asked, in the user's words (a note taken into account by the model; Decisions rendered as Markdown with preset options and expandable details)?
- QUALITY: APPROVED or CHANGES REQUIRED, with severity per finding.
- PUBLISH: YES or NO, with the exact caveats that must be told to the user before it goes live.
Write the evidence under .agents/run/chamberos-board-v2/verifications/V4-2-L4/ and commit it there. Do not fix application code; report it. Do not push.
</verdict>
