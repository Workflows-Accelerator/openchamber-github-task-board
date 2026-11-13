# Resume — V4-3 recovery after server restart, 2026-11-13

## Current frontier
- One active replacement: `ses_b03f8aa4a8ae0d9e7205cc6d`, requested genius, dynamic-agent, auto_accept true; canonical brief `tasks/wave5a2-v4-3-recover-partial.md` passed by pointer only.
- Worktree `.worktrees/team-dev-board-v3`, branch `feat/board-v3`, base `a6f61f3`.
- Prior worker `ses_3ea186555b74bd41ddaaeb58` confirmed idle, last assistant "Now the i18n keys, in both dictionaries." Actual model 9router/genius verified in session.messages. Explicit delegate stop returned success; cancelled/error wakes received for that old session. Do not confuse them with the replacement.
- Recovery starts from inherited uncommitted app.js (+53/-1), server/app.ts (+23/-1), board.ts (+233), total +307/-2. No V4-3 tests, evidence or commits yet at dispatch. The partial parser/enforcement/client plumbing must be audited, not rebuilt blindly or accepted as correct.
- Untouched untracked V4-1-L4/ remains OFF LIMITS. The extra `wave5a2-v4-3-recover-after-restart.md` was a redundant draft, NEVER dispatched; canonical is recover-partial.md.

## Do not repeat
- V4-2 already LIVE as `e604b9e-20261112` (app `1d9f237`), origin/master last verified `a6f61f3`. Details and rollback: resume-2026-11-12-v4-2-live.md. No fresh live health check was performed during this restart recovery.
- User D40 approved proceeding with real deterministic GitHub reclassification. Code phase is explicitly NO GitHub writes; no reclassification has been run. Do not ask for that same authorization again.
- No human phone acceptance of V4-2 has been received. User's earlier real-phone drag persistence proof remains valid; do not re-ask it.

## Gates and next moves
1. Wait for the replacement completion wake; do not loop-poll. Actual model verification can happen at finish.
2. Inspect commits/diff/evidence and the reported disposition of inherited edits. Next worker instruction must be the exact hostile-review prompt (fresh worker if the builder ended), then independent review. No master/live change until reviews pass.
3. Read-only reclassification inventory uses `tasks/wave5b-v4-3-reclassification-dry-run.md`, fill current base at dispatch. Enumerate actual configured repositories without reading board.env/jwt-secret/cookies. Missing safe source for configured repos is a capability blocker, not permission to read secrets.
4. Manager inspects full inventory and independently verifies deterministic rule before real writes. Only settled cases: needs-human/no clickable artifact -> todo; in-review/no artifact -> todo only with evidence the review finished/was abandoned; live review stays; ambiguous -> ask owner.
5. Apply labels only plus exactly one English audit comment per changed issue and exact reverse mapping, per D40. Never rewrite bodies, close issues, delete comments or create labels/settings. Re-read writes to prove result. The approved application needs a fresh written brief; none exists yet.
6. Release via fresh worker after independent review, preserving old releases, rebuilding web/server.ts from source. D33 authorization is recorded; no hot-patching. Root is only for manager run state, never application edits.

## Constraints / proof caveats
- All #53–#71 stay open; only owner closes.
- No access to openchamber-config source, production secrets or runtime state. No git remote -v. No force-push/rebase/reset or cleanup of unknown worktrees.
- Source/test/evidence micro-commits required; no final answer while a started smoke job is still running. Sequential suites, 900000 ms foreground smoke timeout. Baselines panel 618 / web 672; Chromium env and probes available under V4-2 evidence, copy probes so prior evidence is immutable.
- Root untracked `.agents/idle-nontext-state.json` is unrelated; do not stage or modify it.
