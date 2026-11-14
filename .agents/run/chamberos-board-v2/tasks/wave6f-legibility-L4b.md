<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base reviewed: 07b8435 (prior FAIL L4 report)
Current HEAD: 9732699 (9f4ed2a app+tests, 9732699 verification evidence)
Mode: Read-only on `web/**`, `test/**`, and prior verification directories. Write ONLY under `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4b/`.
Forbidden:
- NEVER touch `web/**`, `test/**`, `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER stage or commit untracked `.agents/run/chamberos-board-v2/verifications/V4-1-L4/`.
- NEVER push, deploy, or spawn subagents.
</env_preflight>

<goal>
Conduct an independent delta hostile L4 review of `07b8435..9732699` to determine whether ALL 4 P1 + 1 P2 findings in `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4/README.md` are genuinely closed and whether `9f4ed2a` is ready to publish live (`PUBLISH_VERDICT: YES` or `NO`).
</goal>

<attack_checklist>
1. Read `git diff 07b8435..9f4ed2a` across all 10 changed `web/` files.
2. Verify every P1/P2 finding from `discovery-legibility-L4/README.md`:
   - P1-1: `403 forbidden` -> `'auth'`; non-JSON `401`/`429`/`403` keep status meaning before JSON parse bailout.
   - P1-2: `DiscoveryUnavailableError` carries `errorKind`/`errorResetAt` and maps consistently to `503` (including `archiveData`/`operationsData`); `?refresh=1` passes `forceRefresh` through `resolveRepository`; mid-refresh `board.discoveryFailed` after `/api/combined/board` handled cleanly without overwriting cached board with empty issues; `api()`/`openIssue()`/`canvasMoveFailureMessage()`/quick-add localize `503 discovery_unavailable` in EN/FR; Canvas mode clears `#canvas-cards` and wires/headers and shows failure state cleanly.
   - P1-3: No 3x full-sentence repetition causing `1280px` `.status-strip` overflow (`scrollWidth <= clientWidth`, `#list-group-toggle`/`#new-task-btn`/`#freshness` inside viewport); `#empty-create` hidden/disabled on discovery failure; `applyLanguage()` re-renders active failure in EN <-> FR; AND verify `clearDiscoveryFailure()` in recovery/unavailable-repo/generic-error branches (did `9f4ed2a` leave any stale `state.discoveryFailure` path or untested recovery branch?).
   - P1-4: Rate-limit `reset` captured ONLY from the failing response (no stale `sharedRateLimit.current.reset` on headerless `403`/`429`), past `reset` suppressed, multi-day reset includes date context, honest manual-refresh copy (no false auto-refresh promise).
   - P2: `fake-github.mjs` & `discovery-legibility.test.mjs` & `verify.mjs` actually fail on regressions and inspect real bounding boxes.
3. Run independently:
   - `node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs`
   - `node --test --test-timeout=60000 web/tests/*.test.mjs`
   - `npm test`
   - `npm run typecheck && npx tsc -p web/tsconfig.json --noEmit`
   - `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave6f-l4b-server.mjs`
   - `npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave6f-l4b-app.js`
   - Check `I18N` EN/FR key parity, forbidden tokens (`n8n`, `mobile`, emojis, `!`), and try running `.agents/run/chamberos-board-v2/verifications/discovery-legibility/verify.mjs` (check `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh` or `/tmp/opencode` if Chromium needs `LD_LIBRARY_PATH`; report honestly if Chromium cannot launch in this container).
4. Inspect screenshots in `.agents/run/chamberos-board-v2/verifications/discovery-legibility/screenshots/` (at least `discovery-auth-1280-dark-fr.png`, `discovery-rate_limited-1280-light-en.png`, `discovery-auth-390-light-fr.png`, `canvas-discovery-failure-1280.png`).
5. Write `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4b/README.md` and commit ONLY that directory with explicit `git add`.
</attack_checklist>

<output>
At most 10 lines: SPEC_VERDICT, QUALITY_VERDICT, PUBLISH_VERDICT, FINDINGS (P0/P1/P2 or NONE), TEST_RUNS, VISUAL_CHECK, COMMIT, NOT_VERIFIED.
</output>
