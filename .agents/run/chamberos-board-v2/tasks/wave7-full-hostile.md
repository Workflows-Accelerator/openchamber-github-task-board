<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-full-l4
Branch: feat/wave7-full-l4
HEAD: 1d11287 (base 5edb450)
Mode: Adversarial audit. You may write ONLY `web/**`, `verifications/**`, and your report under `.agents/run/chamberos-board-v2/verifications/wave7-full-L4/`.
Forbidden:
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER push, deploy, or spawn subagents. Do NOT merge into `feat/wave7-overhaul`.
Test commands:
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave7-full-server.mjs
- npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave7-full-app.js
</env_preflight>

<goal>
Conduct the final hostile L4 review of the whole Wave 7 overhaul `5edb450..1d11287` (7a server foundations + 7b canvas flow graph + 7c unified counts/progress/question legibility), and establish whether it is safe to publish live. Do not assume any part is correct. Two earlier sub-reviews (7a, 7b) already passed with fixes; 7c has NOT been independently reviewed and is the priority.
</goal>

<attack_checklist>
1. **Priority — audit Wave 7c (`1d11287`) for real, not by trusting its claim of 29 closed findings.**
   - Take `verifications/usability-audit-2026-11-13/README.md` finding by finding (#2–#16) and prove each is closed with a code citation plus a behavioural test you run. Any finding closed only by a string/regex assertion is a WEAK closure — say so explicitly.
   - Verify the unified "needs me" count is genuinely ONE source of truth across sidebar badge, List view, Decisions, Blocked and Canvas group counts (grep for duplicated count logic). Prove a single issue cannot be counted twice in Blocked.
   - Verify checklist `done/total` and question `answered/total` ratios appear on list rows, canvas cards and collapsed group summaries, and that they are correct on a real body (not just present in the DOM).
   - Verify the Reviewable-link filter counts tasks that actually carry a human-review artifact, and that `missing` vs `malformed` artifact states produce distinct, non-schema user copy in EN and FR.
   - Verify the Answer button is reachable at 390x844 with `Details` expanded (measure via the DOM harness or CSS reasoning; state clearly if you cannot).
   - Verify dark-mode contrast claims (8.35:1 / 13.15:1) by recomputing from the actual CSS tokens, and check every badge/meta class touched, not just the status chip.
2. **Cross-cutting integration risk (highest chance of a real defect):**
   - Does 7c's new count/progress logic agree with 7b's collapsed-group counts and with 7a's `activeSession`/`parentKey` payload? Find any place where the same number is computed twice with different rules.
   - Do the 7c changes regress any 7b canvas behaviour (notes following cards, wires, dot grid, group expand/collapse, LR/TD, `/api/layout` persistence) or any 7a server behaviour (ETag/304, layout ETag, caches)?
   - Re-run every canvas/layout/board test and confirm the earlier 7b/7a suites still pass unmodified. If 7c edited any earlier test, flag it.
3. **Mutation check (do this, it is the strongest evidence):** pick at least 8 fixes across 7c and revert each one; confirm a test fails. List any fix whose revert stays green — that fix is unproven.
4. **Browser proof attempt (do this early, time-boxed to ~15 minutes of wall clock):**
   - Try to restore a Chromium runtime WITHOUT root: `apt-get download` the needed .debs (`libglib2.0-0`, `libnss3`, `libnspr4`, `libgbm1`, `libx11-6`, `libxcomposite1`, `libxdamage1`, `libxext6`, `libxfixes3`, `libxrandr2`, `libatk1.0-0`, `libatk-bridge2.0-0`, `libcups2`, `libpango-1.0-0`, `libcairo2`, `libasound2`, `libdrm2`, `libexpat1`) into `/tmp/opencode/chromium-deps`, extract with `dpkg -x`, and set `LD_LIBRARY_PATH` as `chromium-env.sh` did. If `apt-get download` needs network and fails, say so plainly and stop trying.
   - If Chromium runs, execute `.agents/run/chamberos-board-v2/verifications/discovery-legibility/verify.mjs` from a `/tmp` copy plus a new capture of the Canvas at 1280 and 390 in EN and FR, and attach the PNGs under your report directory.
   - If it does not run, disclose it and do not fabricate any visual claim.
5. Fix any genuine defect with a failing test first; commit as `fix(board): harden Wave 7 after full hostile review`. Write `.agents/run/chamberos-board-v2/verifications/wave7-full-L4/README.md` and commit it.
</attack_checklist>

<output>
At most 14 lines: SPEC_VERDICT, QUALITY_VERDICT, PUBLISH_VERDICT (YES/NO + one-line reason), FINDINGS (P0/P1/P2 with counts), WEAK_CLOSURES (audit findings closed only by string assertions), MUTATIONS (x/y caught + list of unproven fixes), TEST_COUNTS, BROWSER_PROOF (ran/blocked + what it shows), COMMIT, NOT_VERIFIED.
</output>
