# Current handover — V4 live, V4-2 building, 2026-11-12

## Shipped and verified
- Live release `/workspace/releases/board/26fbc00-20261112`; `current` repointed atomically; supervisor PID 1334852, child 1334936 with cwd on the new release; health 200 on loopback and HTTPS.
- Built from source at `26fbc00` (application `a1225f0`). Deployed bundle: 0 `if-match`, `write_rejected` present.
- 11 public assets byte-identical staged / loopback / HTTPS. `sw.js` runtime stamp `1.2.1-2e7655bc77` (previous `1.2.1-7fcf74087e`), so clients drop the old cache.
- `origin/master` pushed `28af19b..d1eef33` (first attempt reset by peer, retry succeeded) and verified with `git rev-parse origin/master`.
- Five earlier releases still pass their checksums. Rollback to `7339629-20261111` documented in `verifications/26fbc00-20261112/release-receipt.md`.
- Receipts: approval https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/55#issuecomment-6829668305 · release https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/55#issuecomment-6830620985

## V4-2 commits on feat/board-v3 (local, unreleased)
- `5430f36` source: web/public/app.js, index.html, theme.css, web/server/app.ts, board.ts, github.ts.
- `b0718cc` tests: fake-github.mjs + v4-2-client / v4-2-decisions / v4-2-notes.
- `aa9e1e3` evidence: verifications/V4-2/ (410 files, README + logs + screenshots + JSON).
- README verdicts: framing failures are a stale pre-D37 probe, proven by ancestry (`6535937` predates `38f6572`) and by a new promise probe (12/12, real clicks, D39 legend, Show all reaching 0.315/0.344 with 4/4 inside). `npm test` still not green: 617/618 then 615/618, panel-only, different failures, called flaky but unproven.
- Worker found and fixed 4 real defects on its own hostile pass: locked-issue message, 403 collapsing to link-permission copy, `-  :: gist` turning the separator into a label, missing quoted-marker test.

## Active
- Sole worker `ses_01498c3c4f8c0d6245047a44` (V4-2c, brief `tasks/wave4c-v4-2-close-evidence-and-hostile.md`): proves or disproves the npm-test flakiness by running the panel suite at HEAD and on a detached `d1eef33` worktree, then runs a hostile review of 5430f36+b0718cc with fixes only where genuinely broken. Its brief was written before `aa9e1e3` existed, so it expects uncommitted evidence; it must not rewrite history or discard the committed evidence.
- Next: independent L4 of `d1eef33..HEAD` with `tasks/wave4d-v4-2-independent-L4.md` (fill the HEAD SHA at dispatch), then release per `tasks/wave3e-v4-release.md`.
- Its own numbers: web tests 666/666 pass; a 12-case browser probe pass with note marker `<!-- board-note: 1 -->`, append-only comments, reload survival, retry-on-failure keeping text, lost-response reconciliation, 18 conditional comment requests and no extra render requests; Decisions Markdown with no raw markers and legacy free text still saved.
- Two unresolved 360 px probes FAILED with `zoomAfterFit:0.55`, `neighbourhoodInside:false`, `filteredAllInside:false`, `cardsUnderHud`. The pattern looks like an old probe asserting pre-D37 containment at the readable floor — plausible, not proven.
- The final delivery smoke was killed by a 240 s tool timeout and left an empty log.
- Recovery worker `ses_8265220b99cc6ff4ee784a4c`, requested genius, brief `tasks/wave4b-v4-2-finish-abandoned.md`: triage every dirty hunk, settle the two failures on evidence, one clean verification pass with a 900 s smoke, README, three commits.
- Scope unchanged: (A) quick note on the open issue as a real GitHub comment with a hidden marker, composer in the drawer, count chips, failure keeps text and offers retry, agent-facing `/api` payload; (B) Decisions questions rendered with `markdown.js`, one documented preset-option convention with expandable details, backward-compatible with existing questions, radiogroup + aria-expanded.
- Non-regression required: 0.55 framing floor and honest Show all, filter/focus return state, D38 rail toggle, drag save + reload, Arrange + Undo exact, reduced motion/keyboard, CSP, dot grid, banned words.
- First dispatch attempt was aborted by an engine restart: no session was created, no commit and no dirty file, so it was re-dispatched cleanly rather than duplicated. Keep that in mind if a stray wake mentions a missing tool result.

## Preemption rule
If the user reports a defect on the live V4, stop `ses_9e0d1c9ef4415dc77f472bbf` (`delegate action=stop`), triage the report, and treat the fix as a new bounded round with its own independent review before any redeploy. Do not hot-patch production.

## When V4-2 reports
1. Verify real SHAs, `git log`, tracked tree clean, and read the actual diff for `web/server/board.ts` and the comment route — this is the first increment that touches server code since the release.
2. Check the evidence README, the raw logs with exit codes and the screenshots; confirm no real GitHub mutation happened.
3. Dispatch the hostile review next; then a fresh independent review of the increment. Local commits only until that verdict.
4. Publish only as part of the next approved batch; a live write path change needs the authenticated-write caveat stated to the user, since only the previous release's writes were confirmed on a real phone.

## Awaiting the user
- Live phone review (L5) of V4. If they pass it, record it and keep the remaining waves moving. If they bounce an item, it goes back with their note.
- Open questions already answered: brand name, quick-note destination, human-validation policy, D37/D38/D39. Do not re-ask them.

## Queued after V4-2
V4-3 human-validation policy + deterministic reclassification (needs `gh`, real label writes, per-issue comment + reverse mapping) then R1 OpenChamber question research/prototype. Sequential, same worktree; bases `[FILL_BASE_SHA]` to be set to the current HEAD at dispatch.

## Constraints
No agent closes issues; only the user moves an issue to Done. Never touch `/workspace/code/openchamber-config`, `/workspace/.openchamber-data`, secrets, or `/workspace/releases` outside a release brief. Never `git remote -v`. Rebuild bundles from source; never ship `web/dist/server.mjs`. Manager reads application source only through grep/git, never by editing.
