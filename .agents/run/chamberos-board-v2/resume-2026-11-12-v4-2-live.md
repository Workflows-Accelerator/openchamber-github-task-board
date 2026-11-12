# Current handover — V4-2 live, 2026-11-12

## Live now
- Release `/workspace/releases/board/e604b9e-20261112`, `current` repointed from `26fbc00-20261112`; application code `1d9f237`, base `e604b9e`.
- Built from source with the exact esbuild command: bundle carries the note route, `board-note` and `write_rejected`, and zero `if-match`.
- 13/13 staged assets byte-identical over HTTPS (`sha256sum -c --strict` exit 0); `sw.js` runtime `CACHE_VERSION 1.2.1-d32d4abee5` (was `1.2.1-2e7655bc77`), so old caches are dropped.
- Live `app.js` proves `agent-note-composer`, `question-option-card`, `canvasZoomLimitText`, `frameDependencyFocus`; live `index.html` proves "Workflows Board".
- Health 200 loopback and HTTPS. Supervisor 1152566, child 1152623. Eleven older releases intact with passing checksums.
- Rollback target `26fbc00-20261112`: repoint `current`, `kill -TERM` the PID in `/tmp/opencode/board-supervisor/supervisor.pid`, run `/workspace/code/openchamber-config/tools/board/start.sh`. Full command in `verifications/e604b9e-20261112/release-receipt.md`.
- `origin/master` pushed `d1eef33..a6f61f3` and verified. Receipt #issuecomment-6837970237 on #55.
- Reviews: `verifications/V4-2-L4/` (SPEC PASS, QUALITY CHANGES REQUIRED for H1) then `verifications/V4-2-L4-delta/` (H1 CLOSED, lock proven by four document mutations, SPEC PASS, QUALITY APPROVED, PUBLISH YES).

## Caveats told to the owner
1. A saved `ai_issue_prompt_{repo}` or `ai_issue_prompt_global` overrides the new default prompt, so agents keep writing plain questions until it is reset to default.
2. The OpenChamber panel "Quick Choices" does not render `::` option chips; only the web board does.
3. Option lines must stay contiguous and unwrapped: an indented non-option line ends the block and silently drops later options; details are cut at 2,000 characters, gists at 200.
4. The 4,000-character refusal is unreachable from the composer (`maxlength` equals the cap); it is defensive copy.
5. `panel/main.js` was hand-patched, not rebuilt (23.8 KB pre-existing drift). A rebuild would ship unrelated changes.
6. Carried: a non-standard 422 shape reads as outcome-unknown, note count is a floor above 100 comments, generic 403 reads as a permission problem, a human comment quoting the marker shows under their own name.

## Not verified anywhere
Real GitHub note writes (all proofs used the synthetic fixture), authenticated production flows, Safari/Firefox, a physical phone, a screen reader, a 1000-card board, whether a drafting model actually emits the convention, and whether a release rebuilds `dist` or `panel/main.js`.

## Next
1. Owner's phone click-through: note on an open issue, survives reload and appears on GitHub; Decisions preset options with Details; framing and rail from V4.
2. Then V4-3 (`tasks/wave4-v4-3-human-validation-policy.md`): validation policy + deterministic reclassification. It needs real `gh` label writes and one comment per issue with a reverse mapping — a real GitHub mutation, so it needs its own explicit go/no-go and an L4 before it runs.
3. Then R1 (`tasks/wave5-r1-openchamber-questions.md`): draft issues filed by the manager after the owner reviews them.
4. Optional follow-ups from the reviews: panel Quick Choices chips, the 422 shape, cache bound, chip precision.

## Constraints
No agent closes issues; only the owner moves an issue to Done. Never touch `/workspace/code/openchamber-config`, `/workspace/.openchamber-data`, secrets, or `/workspace/releases` outside a release brief. Never `git remote -v`. Rebuild bundles from source; never ship `web/dist/server.mjs`. The manager cannot read application source, only grep/git, and cannot reach the network (curl denied).
