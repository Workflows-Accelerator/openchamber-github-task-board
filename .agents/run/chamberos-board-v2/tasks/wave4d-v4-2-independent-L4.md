<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Reviewed range: d1eef33..a7867e8 (d1eef33 is the live V4 release; everything after it is V4-2)
Commits: 5430f36 source, b0718cc tests, aa9e1e3 evidence, bc26145 evidence update, 3af3fe0 fix (410 Gone), a7867e8 docs.
Tree: tracked clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ must stay untouched and unstaged.
Root checkout on ops/task-board-activation: DO NOT modify, switch or commit there. Read-only for this review.
Constraints: no git push, no deploy, no /workspace/releases, no /workspace/code/openchamber-config, no /workspace/.openchamber-data, no real GitHub mutation, no credential output, no `git remote -v`, no file deletion, no application-code edits.
</env_preflight>

<goal>
Independently verify V4-2: a quick note on the open issue stored as a real GitHub comment (visible to the agent working the issue), and Decisions questions rendered as Markdown with preset answers and expandable details. You did not write this code. Find where it is wrong, unsafe or unproven, and say plainly whether it may be published.
</goal>

<what_the_author_claims>
Read .agents/run/chamberos-board-v2/verifications/V4-2/README.md and verifications/V4-2/hostile-review.md (if present) first, then verify each claim yourself:
- Marker `<!-- board-note: 1 -->` as the first non-blank line; comments append-only, never PATCHed or DELETEd; a quoted or later marker is not a note.
- POST /api/issues/:n/notes and /api/repos/:o/:r/issues/:n/notes behind CSRF and a per-issue lock released in `finally`; 400 for empty/oversized (64 KB body, 4000-char cap); 403 forbidden/locked, 404 (including the new 410 Gone mapping from 3af3fe0), 422 refuse; a lost response reconciles without duplicating; a double send creates 1 comment.
- One conditional comments GET when the drawer opens (304 when unchanged, ETag keyed per repo#issue); 0 comment requests for the board list; multi-repo route rejects an unconfigured repository with 400 `repository_not_allowed`.
- Decisions: format `  - label :: gist :: details`; rendered through web/public/markdown.js; legacy questions still render and are answerable; malformed options degrade; answers still post to /questions/:i/answer; 213 EN = 213 FR keys.
- Counts after the fix: web tests 670/670, typecheck and esbuild clean, browser probe 12 cases / 48 screenshots, framing probe 12/12, delivery smoke 14/14 in 6m01s.
- `npm test` (panel suite) 617/618 at HEAD and on the fix commit, 618/618 twice on base d1eef33, panel/ and test/ byte-identical to base (md5), failures only under high load, different failure each run: declared a pre-existing load-sensitive flake, not a V4-2 regression.
</what_the_author_claims>

<known_limitations_the_author_admits>
Judge each one: does it block publication, and what must the user be told?
1. MEDIUM, not fixed: an undocumented 422 shape (`errors[].message`) still surfaces as 502 `note_outcome_unknown` instead of a precise refusal. The client never sends such a body.
2. LOW: `issueNotesCache` is unbounded in process memory.
3. LOW: the note count chip is a floor when an issue has more than 100 comments.
4. LOW: a generic 403 CSRF refusal reads as a permission problem.
5. LOW: a human comment quoting the marker is shown as a note body, with author shown and body escaped.
</known_limitations_the_author_admits>

<what_to_check>
1. Read the full diff d1eef33..HEAD yourself, including web/server/app.ts, web/server/board.ts, web/server/github.ts, web/public/app.js, index.html, theme.css and the four test files. Do not rely on the summary.
2. Security and blast radius of the write path: CSRF on both routes; lock released on every error path (throw, abort, timeout); size caps enforced before any GitHub call; the repository checked against the configured set; no token, header or upstream error text reaching the client; marker parsing not spoofable into trusting a human comment; nothing ever editing or deleting an existing comment.
3. Failure honesty: every refusal names what failed, in EN and FR, with no false success. Composer keeps typed text and offers retry.
4. Data-model separation: agent notes vs canvas sticky notes are distinct; the GitHub comment is the only source of truth; no duplicated storage.
5. Decisions: no script injection, no `javascript:` href, label/gist/details escaped; old question with no options untouched; all-invalid option block falls back to legacy; radiogroup semantics and aria-expanded are real.
6. Non-regression on released surfaces: 0.55 framing floor with honest limit message and hidden off-screen labels, filter/dependency return-view state, D38 desktop rail toggle, drag save + reload + refused-write rollback, Arrange + Undo exactness, strict CSP with no inline styles, zero "n8n"/"mobile"/emoji, dot grid unchanged, views Canvas/Canevas and List/Liste.
7. Confirm from git history and the probe's own code that the old framing probe really predates D37, and that the new probe asserts what the product promises rather than restating the implementation.
8. npm test: run the panel suite at HEAD once yourself, and once on a detached worktree at d1eef33 (`.worktrees/team-dev-v4-2-base`, removed and pruned afterwards). Report both results and whether the difference is pre-existing flakiness or a real regression.
9. Run the suites yourself, sequentially, with the existing scripts and documented Chromium env: web tests, typecheck, esbuild check, browser probe, framing probe, delivery smoke (900000 ms timeout). Spot-check that the JSON agrees with the logs; do not trust recorded logs alone.
</what_to_check>

<verdict>
- SPEC: PASS or FAIL. Does it do what the user asked, in the user's words (a note taken into account by the model; Decisions rendered as Markdown with preset options and expandable details)?
- QUALITY: APPROVED or CHANGES REQUIRED, with severity per finding, and for each admitted limitation a ruling: blocks publication or ships with a stated caveat.
- PUBLISH: YES or NO, with the exact caveats to tell the user before it goes live.
Write the evidence under .agents/run/chamberos-board-v2/verifications/V4-2-L4/ and commit it there. Do not fix application code; report it. Do not push.
</verdict>
