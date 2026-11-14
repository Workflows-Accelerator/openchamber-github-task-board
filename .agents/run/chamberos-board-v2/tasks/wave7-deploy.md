<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-overhaul
Branch: feat/wave7-overhaul
HEAD: add4855 (release candidate; merge `422b3a0` of `1d11287` + `3c45474`)
User approval: GRANTED 2026-11-14 — "Publier Wave 7 + wave6f maintenant". This authorises deploying to the live board and pushing `master`.
Forbidden:
- NEVER read, print, echo or copy `board.env`, `jwt-secret`, tokens, passwords or cookies. Presence checks only. NEVER run `git remote -v`.
- NEVER force-push, NEVER delete remote branches, NEVER touch repo settings or secrets.
- NEVER edit `/workspace/code/openchamber-config/**` (you may EXECUTE its documented `start.sh`, nothing else) and NEVER write to `/workspace/.openchamber-data/**`.
- NEVER spawn subagents.
</env_preflight>

<goal>
Ship the approved release: deploy the Wave 7 + wave6f release candidate to the live board at `https://board.workflows.ac` with a working rollback, verify it live, then merge to `master` and push. If anything fails, roll back immediately and report — a working board on the old version is always better than a broken board on the new one.
</goal>

<steps>
1. **Read the deploy mechanics report first.** Wait for `.agents/run/chamberos-board-v2/verifications/wave7-deploy-mechanics/README.md` to appear (poll with `sleep 20`, up to 10 minutes). It is a read-only audit of whether the recorded deploy/rollback commands actually work in this recreated container. If it says `RECEIPT_NEEDS_FIX`, use ITS corrected sequence instead of the receipt's. If it has not appeared after 10 minutes, stop and report `BLOCKED: mechanics unverified` rather than deploying a sequence nobody checked.
2. **Pre-flight, no changes yet:** confirm `/workspace/releases/board/current` resolves to `b85676f-20261113`, record its sha256 checksums pass, confirm the board answers `http://127.0.0.1:<real port>/health` (use the port the mechanics report identifies, not the receipt's guess), and record which process supervises it.
3. **Stage the new release without switching:** create `/workspace/releases/board/422b3a0-20261114` exactly as the receipt (or corrected sequence) says, build `web/dist/server.mjs` there, write `checksums.sha256`, and verify `sha256sum -c --strict` passes. The staged `server.mjs` must hash to `89d4b289f2555f9e1437f043ebf02d820b8817da0acf88d8903add4b27d604b7` — if it does not, stop and report the difference instead of deploying.
4. **Switch and restart:** perform the symlink swap and service restart from the verified sequence. Then poll `/health` for up to 60 seconds. Also fetch `/app.js` and confirm it contains `groupNeedsMeOf` (a Wave 7 marker) and `flow-layout.js` is served with 200 — that proves the new frontend is actually being served, not a cached old one.
5. **If health or the frontend check fails:** roll back immediately using the verified rollback sequence to `b85676f-20261113`, confirm `/health` 200 and the old `/app.js` is served, then stop and report `DEPLOY_FAILED_ROLLED_BACK` with the exact failure.
6. **Only after a green live check:** merge `feat/wave7-overhaul` into `master` (`git checkout master`, `git merge --no-ff feat/wave7-overhaul`, then `git push origin master`) and return to `feat/wave7-overhaul`. Never force-push. If `master` has moved, merge (do not rebase) and report.
7. **Write the release receipt** at `.agents/run/chamberos-board-v2/verifications/wave7-release/README.md`: deployed commit and release directory, artifact sha256, the exact commands run, the live health/frontend responses observed, the previous release kept for rollback, the `master` push result (commit hash), and anything that did not go as expected. Commit it with explicit paths.
</steps>

<output>
At most 12 lines: STATUS (DEPLOYED / DEPLOY_FAILED_ROLLED_BACK / BLOCKED), MECHANICS_SOURCE (receipt or corrected), RELEASE_DIR, ARTIFACT_SHA256, LIVE_CHECK (health + /app.js marker + flow-layout.js), MASTER (commit + push result), ROLLBACK_READY (previous release path, verified), RECEIPT_COMMIT, NOT_VERIFIED.
</output>
