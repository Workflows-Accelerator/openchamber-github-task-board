# Current handover — V4 approved, releasing, 2026-11-12

## State
- Independent targeted L4: SPEC PASS / QUALITY APPROVED for D39 bounded scope. Evidence commit `26fbc00`; reviewed application `a1225f0`. Report: worktree `.agents/run/chamberos-board-v2/verifications/V4-targeted-L4/report.md`.
- Sole active worker `ses_f35e847135ddf8c8b3dd21b2` (engineer), release brief `tasks/wave3e-v4-release.md`, base `26fbc00`, release dir `26fbc00-20261112`. Wait for completion wake; no polling.
- `origin/master` confirmed at `28af19b` immediately before dispatch (git fetch + rev-parse). Local root `master` still `28af19b`; the release worker moves local master to its receipt commit.
- Attempted `git push origin 26fbc00:refs/heads/master` was DENIED by the shell policy. Do not retry unusual refspecs. Push after the worker's receipt with plain `git push origin master` (timeout 600000). If that is also denied, report the limitation to the user instead of routing around it.

Receipts:
- Independent approval: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/55#issuecomment-6829668305

## After the release worker reports
1. Verify the receipt and hashes from worktree files; check `git log` in the worktree and confirm tracked tree clean.
2. Push `origin master` once, then confirm `git rev-parse origin/master` equals the receipt commit.
3. Report to user in French: what changed, one short click list, known limitation (spread canvas at 0.2 zoom stays small but now announced honestly).
4. Do not close #53–#71; the user closes them. Do not ask again about the drag test; it is confirmed.

## Rollback if the release misbehaves
Preserve the documented one-command rollback from the receipt; previous releases `7339629-20261111`, `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103` must stay intact.

## Limits / non-verified
- Chromium synthetic proofs only. No Safari/Firefox, no physical device, no screen reader, no 1000-card board, no real GitHub write exercised by the V4 increment itself.
- The live board's authenticated writes were previously confirmed by the user on release `7339629-20261111`; the V4 increment adds no server write-path change (`web/server/**` untouched), so that proof still covers the write path.

## Queued after this
V4-2 notes/comments + Decisions Markdown and preset options; V4-3 human-validation policy and reclassification; R1 OpenChamber question research. All sequential, same worktree, briefs still carry `[FILL_BASE_SHA]`. Update bases to the release receipt commit when dispatching.

## Standing constraints
No agent closes issues. Never touch `/workspace/code/openchamber-config`, secrets or `/workspace/.openchamber-data`. Never run `git remote -v`. Rebuild bundles from source; never ship `web/dist/server.mjs`. Worktree at `.worktrees/team-dev-board-v3`, branch `feat/board-v3`.
