<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3 (HEAD 6826bc8, clean, already deployed live as release 5bf1c62-20261111)
Base commit: 6826bc8
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Real Chromium launcher: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (RUN SEQUENTIALLY, never in parallel — parallel CPU contention flakes test/stage1-dual-mode-and-scoping.test.js):
  npm test
  node --test --test-timeout=30000 web/tests/*.test.mjs
  npm run typecheck
  npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v3-server-check.mjs
  source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh && node scripts/generate-delivery-smoke.mjs
Do not touch: panel/**, service/**, web/public/app.js:2268 dot-grid formula, /workspace/code/openchamber-config/** (READ/EXECUTE only), /workspace/.openchamber-data/** (never read secrets), GitHub issue closures, git push, git reset, git rebase
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>

<goal>
Fix the one defect the manager found in the LIVE signed-out screen: at narrow widths (`<=768px`) the bottom navigation dock (`#compact-nav-dock`, items Canvas/List/Decisions/Blocked) renders on the sign-in screen, i.e. before authentication, where every one of those destinations is dead. That is fake UI and it is the very first thing the user sees on a phone. Also polish the sign-in screen layout, then redeploy live.
</goal>

<defect_evidence>
- Live `https://board.workflows.ac` at `390x844`, signed out (`.agents/run/chamberos-board-v2/verifications/V3-4/screenshots/live-signed-out-390x844.png`): the login card sits at the top and a 4-item bottom dock (`Canvas`, `List`, `Decisions`, `Blocked`) is visible along the bottom edge while the page still asks for a password.
- Structural cause: `web/public/index.html` places `<nav id="compact-nav-dock">` OUTSIDE `<main>` (lines 571/581), and `web/public/theme.css:3410` shows it purely from a `<=768px` media query with no authentication guard. No `web/tests/**` file asserts anything about `#compact-nav-dock`.
- Desktop signed-out (`1280x900`) is correct: no sidebar, no dock.
</defect_evidence>

<scope>
1. Hide `#compact-nav-dock` unless the board is actually shown. Preferred rule, placed inside the existing `<=768px` block next to the dock rules in `web/public/theme.css`: `body:has(#login-view:not([hidden])) #compact-nav-dock { display: none; }` (the codebase already uses `body:has(...)` patterns). Any equivalent pure-CSS approach is acceptable as long as it needs no inline `style="..."` attribute (CSP `style-src 'self'`) and no `javascript:` handler.
2. Verify while signed out that no other authenticated-only chrome leaks at `<=768px`: the `.compact-header` and `#app-sidebar` must be absent, so the sign-in screen shows only the card. Fix the same way if any of them leak.
3. Sign-in screen polish (small and safe): vertically center the login card in the viewport on all widths instead of hugging the top, keep a comfortable minimum card width at `360px` (`min(420px, calc(100vw - 32px))` or similar), preserve `>=44x44px` on the password input and Sign in button, and keep the Light and Dark accents unchanged. Do not add icons, extra copy, marketing text, or a footer.
4. Do NOT change authentication logic, the login API, session handling, or any server file.
</scope>

<criteria>
1. In real Chromium at `360x800`, `390x844`, `768x900`, `1280x900`, Light and Dark, EN and FR, signed out: `getComputedStyle(dock).display === 'none'` and `dock.getBoundingClientRect().height === 0`; the sign-in card is horizontally centered with equal left/right gaps within 1px and vertically centered within 24px; `document.documentElement.lang` is `en` or `fr` as selected; zero console errors and zero CSP violations.
2. After signing in against the synthetic fixture, at `390x844` the dock is visible again (`display !== 'none'`, height `>= 44px`) and its four destinations still navigate — the fix must not hide the dock for authenticated users.
3. New regression test(s) in `web/tests/` assert the guard rule exists in `theme.css` AND that `#compact-nav-dock` lives outside `<main>` in `index.html`. Existing tests stay green and unmodified unless a genuine V1-token conflict is proven; any touched assertion is reported with before/after.
4. `npm test` 618/618, `web/tests/*.test.mjs` all pass, `npm run typecheck` exit 0, esbuild bundle exit 0, `scripts/generate-delivery-smoke.mjs` all sections pass, run sequentially.
5. Live redeploy: stage a NEW release `/workspace/releases/board/<new-short-sha>-20261111` with `package.json`, `web/dist/server.mjs`, every file of `web/public/`, and `checksums.sha256` verified by `sha256sum -c --strict` with exact file coverage; keep `5bf1c62-20261111`, `59e5d05-20261111` and `98261a8-20261103` intact; atomically repoint `/workspace/releases/board/current`; gracefully restart via `/workspace/code/openchamber-config/tools/board/start.sh` (never read or print secrets); confirm `http://127.0.0.1:8787/health` and `https://board.workflows.ac/health` return 200; confirm live HTTPS SHA-256 matches staged for `index.html`, `app.js`, `theme.css` (live `/sw.js` must match `127.0.0.1:8787/sw.js`, not the disk digest, because `CACHE_VERSION` is stamped at runtime).
6. Capture live signed-out screenshots from `https://board.workflows.ac` under `.agents/run/chamberos-board-v2/verifications/V3-5/screenshots/`: `live-signed-out-360x800-{light,dark}.png`, `live-signed-out-390x844-{light,dark}.png`, `live-signed-out-1280x900-{light,dark}.png`. Inspect your own PNGs before committing and confirm the dock is gone and the card is centered.
7. Record `.agents/run/chamberos-board-v2/verifications/V3-5/proof.md` (before/after rule, measurements table, test counts, live hash table, screenshots). Commit on `feat/board-v3` and set local `master` with `git branch -f master HEAD`. Do NOT push — the manager pushes after review.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: PASS | FAIL
- COMMITS: SHA of the code commit and of the evidence commit
- FIX: exact file:line of the guard rule and of the layout polish
- MEASUREMENTS: per viewport signed-out dock display/height + card centering, and signed-in dock visibility at 390
- TEST_COUNTS: legacy, web, typecheck, bundle, smoke — all run sequentially
- LIVE: release dir, `current` target, health codes, staged vs live HTTPS SHA-256 table, PID(s)
- SCREENSHOTS: exact paths
- NOT_VERIFIED: honest blind spots
</output>
