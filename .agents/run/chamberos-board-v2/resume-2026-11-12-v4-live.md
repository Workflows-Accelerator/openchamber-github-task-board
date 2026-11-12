# Current handover — V4 LIVE, awaiting human review, 2026-11-12

## Shipped
- Live release `/workspace/releases/board/26fbc00-20261112`; `current` repointed atomically; supervisor PID 1334852, child 1334936 with cwd on the new release; health 200 loopback + HTTPS.
- Built from source at `26fbc00` (app `a1225f0`). Deployed bundle: 0 `if-match`, `write_rejected` present.
- 11 public assets byte-identical staged / loopback / HTTPS. `sw.js` runtime stamp `1.2.1-2e7655bc77` (previous `1.2.1-7fcf74087e`), so clients drop the old cache.
- origin/master pushed `28af19b..d1eef33` (first attempt reset by peer, retry succeeded) and verified with `git rev-parse origin/master`.
- Five earlier releases pass checksums. Rollback to `7339629-20261111` documented in `verifications/26fbc00-20261112/release-receipt.md`.
- Receipt on issue #55: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/55#issuecomment-6830620985

## Awaiting
- User L5 review on their phone. Click list already given once; do not re-nag every turn. If they report a defect, treat it as a new bounded fix round with L4 again; do not hot-patch production without review.
- Issues #53–#71 stay open; only the user closes them.

## Next waves (not started)
V4-2 quick note as GitHub comment + Decisions Markdown + preset options with expandable details; V4-3 human-validation policy and reclassification; R1 OpenChamber question research. Sequential, same worktree, briefs carry `[FILL_BASE_SHA]` — set to `d1eef33`. Each needs its own L4 before master/live.

## Constraints
Never touch `/workspace/code/openchamber-config`, secrets, `/workspace/.openchamber-data`. Never `git remote -v`. Rebuild bundles from source. No force-push, no remote branch deletion, no agent issue closure. Manager cannot read application source (only `.agents/run/**`); use grep/git for inspection.
