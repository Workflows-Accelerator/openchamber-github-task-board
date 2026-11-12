# Current handover — V4 live, V4-2 building, 2026-11-12

## Shipped and verified
- Live release `/workspace/releases/board/26fbc00-20261112`; `current` repointed atomically; supervisor PID 1334852, child 1334936 with cwd on the new release; health 200 on loopback and HTTPS.
- Built from source at `26fbc00` (application `a1225f0`). Deployed bundle: 0 `if-match`, `write_rejected` present.
- 11 public assets byte-identical staged / loopback / HTTPS. `sw.js` runtime stamp `1.2.1-2e7655bc77` (previous `1.2.1-7fcf74087e`), so clients drop the old cache.
- `origin/master` pushed `28af19b..d1eef33` (first attempt reset by peer, retry succeeded) and verified with `git rev-parse origin/master`.
- Five earlier releases still pass their checksums. Rollback to `7339629-20261111` documented in `verifications/26fbc00-20261112/release-receipt.md`.
- Receipts: approval https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/55#issuecomment-6829668305 · release https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/55#issuecomment-6830620985

## Active
- Sole worker `ses_9e0d1c9ef4415dc77f472bbf`, requested genius, brief `tasks/wave4a-v4-2-notes-decisions.md`, base `d1eef33`, worktree `.worktrees/team-dev-board-v3`, branch `feat/board-v3`.
- Scope: (A) quick note on the open issue as a real GitHub comment with a hidden marker, composer in the drawer, count chips, failure keeps text and offers retry, agent-facing `/api` payload; (B) Decisions questions rendered with `markdown.js`, one documented preset-option convention with expandable details, backward-compatible with existing questions, radiogroup + aria-expanded.
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
