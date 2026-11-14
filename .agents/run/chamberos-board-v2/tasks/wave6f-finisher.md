<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: 07b8435 (dirty tree contains wave6f fixes written by interrupted worker ses_1ef97fd843f13afb7be11b5d)
Forbidden:
- NEVER stage or commit untracked `.agents/run/chamberos-board-v2/verifications/V4-1-L4/` (always `git add <explicit files>`, never `git add -A` or `git add .`).
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER push, deploy, delete files outside task scope, or spawn subagents.
</env_preflight>

<goal>
Verify and cleanly commit the `wave6f` fixes currently in `.worktrees/team-dev-board-v3`, checking that every P1/P2 finding from `.agents/run/chamberos-board-v2/verifications/discovery-legibility-L4/README.md` is genuinely closed.
</goal>

<steps>
1. Read `git diff` on `web/` and verify every item in `tasks/wave6f-discovery-legibility-fixes.md` (specifically: `403 forbidden -> auth`, non-JSON `401/429`, `DiscoveryUnavailableError` carrying `errorKind`/`errorResetAt` + HTTP `503` on archive/operations too, `?refresh=1` bypassing latch in `resolveRepository`, `board.discoveryFailed` handled after `/api/combined/board`, `api()`/`openIssue()`/`canvasMoveFailureMessage()`/`quick-add` localized EN/FR on `503 discovery_unavailable`, Canvas clearing stale cards, no 3x overflow, `#empty-create` hidden/disabled on failure, `applyLanguage()` re-rendering active failure, honest manual-refresh wording, no stale reset leak, past reset suppressed). Fix any tiny gap you spot first.
2. Run all checks:
   - `node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs`
   - `node --test --test-timeout=60000 web/tests/*.test.mjs`
   - `npm test`
   - `npm run typecheck && npx tsc -p web/tsconfig.json --noEmit`
   - `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave6f-server.mjs`
   - `npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave6f-app.js`
   - Also check `.agents/run/chamberos-board-v2/verifications/discovery-legibility/README.md` is updated to match the new 24-test + 33-screenshot `report.json` run (re-run `verify.mjs` only if any source file changed in step 1).
3. Commit in two clean commits using explicit file paths:
   - Commit 1: `web/**` -> `fix(board): close discovery-legibility L4 findings`
   - Commit 2: `.agents/run/chamberos-board-v2/verifications/discovery-legibility/**` -> `test(board): refresh discovery-legibility proof after L4 fixes`
4. Verify `git status --short` shows ONLY `?? .agents/run/chamberos-board-v2/verifications/V4-1-L4/`.
</steps>

<output>
At most 10 lines: STATUS, COMMITS, TEST_COUNTS (focused, web, npm, typecheck, esbuild), GAPS_CHECKED, NOT_VERIFIED.
</output>
