<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 68c5053, plus the delta review evidence commit that follows it (check `git log --oneline -n 3` once; the newest commit must be the V4-3-L4-delta evidence). Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ must stay untouched.
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches there).
Live release dir: /workspace/releases/board/ — preserve every existing release intact. Current live: /workspace/releases/board/current -> e604b9e-20261112. Record the full list of existing release directories before you touch anything.
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and supervisor.sh (READ/EXECUTE ONLY; never edit /workspace/code/openchamber-config)
Do not touch: web/** source edits, panel/**, service/**, /workspace/.openchamber-data/** (never read or print secrets), GitHub issues/labels, real repository writes, git push, any prior evidence directory.
Do NOT run `git remote -v` or print any credential.
</env_preflight>

<goal>
Publish the independently reviewed V4-3 board to production with a verified rollback: a task may enter the state the board presents as "waiting for you" only when it carries a clickable artifact — a screenshot, a short video, a link, or a question with at least one preset answer — and "an agent is reviewing" reads as exactly that.
</goal>

<context>
Reviewed range: a6f61f3..68c5053. Independent verdicts: verifications/V4-3-L4/ (SPEC PASS, F1 blocking) and verifications/V4-3-L4-delta/ (the F1–F4 corrections). Read the delta README first; if its PUBLISH verdict is not YES, stop and report instead of deploying.
Previous release procedure to follow exactly: verifications/e604b9e-20261112/release-receipt.md.
</context>

<steps>
1. Derive the marker list yourself from the source, do not invent it: grep web/server/board.ts and web/server/app.ts for the refusal codes and the parser section names, and web/public/app.js for the client strings that only exist in V4-3 (the human-review panel, the settled/answer state, the inline image fallback). Also take one V4-2 marker (`agent-note-composer`, `question-option-card`, `canvasZoomLimitText`) as the non-regression check.
2. Rebuild the server bundle FROM SOURCE into /workspace/releases/board/<base-sha>-20261113 — never copy web/dist/server.mjs:
   `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/<base-sha>-20261113/web/dist/server.mjs`
   Prove the built bundle contains the refusal codes you found (at least `human_review_required`, `missing_options`, `conflicting_status_labels`, `invalid_url`, `insecure_url`) and still contains `write_rejected` and zero `if-match`.
3. Stage the release directory with package.json, web/dist/server.mjs, every file of web/public/ and checksums.sha256. Verify `sha256sum -c --strict checksums.sha256` and exact coverage both ways.
4. Record pre-cutover state: current symlink target, supervisor and child PIDs, health payload; verify every previous release still passes its checksums.
5. Atomically repoint /workspace/releases/board/current, kill -TERM the supervisor from /tmp/opencode/board-supervisor/supervisor.pid, wait for exit, then start /workspace/code/openchamber-config/tools/board/start.sh with a clean environment. Report only PIDs and health.
6. Verify http://127.0.0.1:8787/health and https://board.workflows.ac/health return 200 and that served index.html, app.js, theme.css, arrange.js, markdown.js, manifest.json and icons are byte-identical to the staged files over HTTPS (sw.js must match 127.0.0.1:8787/sw.js, not the disk digest, because CACHE_VERSION is stamped at runtime). Prove the served sw.js CACHE_VERSION differs from `1.2.1-d32d4abee5`.
7. Prove the new client is live from the live origin, not from disk: fetch the served app.js over HTTPS and confirm every V4-3 marker from step 1 plus the V4-2 non-regression markers, and "Workflows Board" in index.html.
8. Signed-out read-only Chromium smoke against the live origin at 390x844 and 1280x900: PNGs of list, canvas, drawer and Decisions, zero console errors, zero CSP violations. Do NOT sign in against production, do NOT write to any real repository, do NOT post any comment, and do NOT create or edit any issue.
9. Write verifications/<base-sha>-20261113/release-receipt.md with the hash table, PIDs, health codes, the served CACHE_VERSION old vs new, the rollback target, the one-command rollback, which previous releases remain valid rollbacks, and the caveats the user must know (external needs-human card, saved AI prompt override, preset-less live question reads malformed, images load from their https host, Operations view wording). Commit on feat/board-v3 and set local master to the resulting HEAD. Do not push.
</steps>

<criteria>
1. https://board.workflows.ac/health returns 200 and every served asset matches the staged bytes.
2. The deployed app.js visibly carries the V4-3 surfaces, proven from the live origin; the served sw.js carries a new cache version.
3. All previous releases remain intact with passing checksums; the rollback command is documented and correct.
4. Zero secret printed, zero edits under /workspace/code/openchamber-config, zero GitHub writes, zero issue changes, nothing pushed.
5. Receipt committed; local master moved to the receipt commit.
</criteria>

<output>
STATUS: LIVE | ROLLED_BACK | BLOCKED; RELEASE_DIR and current target; HASH_TABLE staged vs live; LIVE_PROOF fetched from the live origin; HEALTH, PIDS, PREVIOUS_RELEASES; ROLLBACK exact command; SCREENSHOTS; NOT_VERIFIED.
</output>
