<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-explore-online-board-polish (branch explore/online-board-polish, base master 8b7e059b17b7f4fad61a7466cd35cb34467807ef, clean). Live web https://board.workflows.ac runs this exact commit.
If tests/builds need dependencies: symlink root `node_modules` and `web/node_modules` from /workspace/extensions/github-task-board (check `test -d` first; never npm install). Remove the symlinks before finishing.
Test commands: root `node --test` per package.json; web `npm test` inside web/. Browser: Chromium headless fails in this container (libglib missing) - use Obscura (see /workspace/config/opencode/.agents/skills) for screenshots.
Writes allowed ONLY under `<worktree>/.agents/run/online-board-polish-explore/**`. ZERO product edits (no web/**, panel/**, service/** changes).
Do not touch: live releases `/workspace/releases/board/**`, running processes, OpenChamber on port 3000, GitHub (no issue/label writes, no live task loading - the panel's StatusReconciler can write labels), `/workspace/.openchamber-data/**`, `.env*`, board.env, credentials, `/proc/*/environ`. Never run `git remote -v`. No push. Zero emojis.
</env_preflight>
<goal>
Explore two user-reported problems with the online board and return evidence plus a short set of alignment options. Do not implement anything.
#54: When already signed in, https://board.workflows.ac shows the sign-in screen for 1-2 seconds on every load before the board appears. User wants the sign-in screen to appear only when actually signed out.
#53: The online board does not look like the Task Board panel inside OpenChamber. User wants it to look "a lot more like what we have in OpenChamber".
</goal>
<context_files>
web/public/index.html (login-view visible by default, board-view hidden), web/public/app.js (boot() ~line 2330, showLogin ~379, showBoard ~443, /api/session checks ~2146/2246/2334), web/public/theme.css, web/public/sw.js, web/server/app.ts (/api/session ~577, auth), web/server/auth.ts.
panel/index.html, panel/main.ts, panel/core.ts, panel/viewstate.ts (the OpenChamber panel UI and its styles).
Host theme contract: /usr/local/lib/node_modules/@openchamber/web/ (read-only; find the CSS variables / tokens OpenChamber passes to guest panels and its own default theme values).
/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md (D47-D61; D49 persistent sessions, D53 unified browsing).
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<scope>
A. #54 sign-in flash
1. Find the real cause from source: what is shown before the session check resolves, what network/service-worker steps happen first (cache-first or network-first for HTML/app.js per D47), and how long each step takes. Measure locally: start the built web server on loopback with a throwaway test config and isolated temp data dir (follow how web/tests set up isolation; never the default session store), sign in once, then reload and record a timeline of when login-view vs board-view are visible (Obscura screenshots/timings, or a DOM-observer harness). Also measure one request timing against the live public `GET /health` and an unauthenticated `GET /api/session` only (no sign-in to live, no data endpoints).
2. List candidate fixes with trade-offs, e.g.: neutral loading/splash state until the check resolves; a non-secret "probably signed in" hint (cookie/localStorage flag) to render the board shell immediately; server-side rendering the right view based on the session cookie; showing cached board data immediately. For each: security implications (never expose secrets/CSRF, sign-out and password rotation must still revoke), offline/PWA behaviour, effort, and which files change.
B. #53 look like OpenChamber
3. Capture side-by-side screenshots at 1280px and 360px, dark and light: (a) the panel UI rendered with fixture data in a stand-in host shell (reuse existing panel test harnesses/fixtures; no live GitHub), (b) the web board rendered locally with fixture data. Save PNGs under the output dir.
4. Produce a concrete difference inventory: colours/tokens, fonts and sizes, spacing/density, toolbar layout and controls, task row/card design, drawer/detail view, icons, empty states, mobile layout. Mark each as "token-level" (CSS variables only) vs "structural" (markup/layout change).
5. Identify what can be shared: can the web board reuse the panel's CSS/tokens/markup directly (shared stylesheet or build step) versus copying values? Note the OpenChamber host's default theme values the web board would need since it has no host to inherit from.
6. Draft 2-4 alignment options for the user (e.g. "match colours and fonts only", "match colours, fonts and toolbar/rows", "share one stylesheet between panel and web"), each with effort, risk and what the user would see.
C. Self-check
7. Hostile pass on your own findings: what did you assume, what could be wrong, what did you not verify (physical phone, installed PWA, native password manager).
</scope>
<output>
Write `<worktree>/.agents/run/online-board-polish-explore/findings.md` (answer-first, plain language, <=200 lines) plus screenshots and harness scripts in the same dir, and commit them on explore/online-board-polish (only that dir).
Return <=15 lines: #54 root cause in one sentence + measured timings; recommended #54 option and 1-2 alternatives; #53 top 5 differences; 2-4 #53 options; screenshot paths; what was not verified; commit hash; actual provider/model.
</output>
