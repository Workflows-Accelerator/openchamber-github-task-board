<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-31-mobile-pwa
Branch: feat/issue-31-mobile-pwa
Base commit: a6f2ca66d4b7659c5c2914c8f2bbe19b04151e08
Goal: Transform the standalone web board into an installable Progressive Web App (PWA) with mobile-optimized views, default "All Projects" view, and a searchable project picker.
Commands:
- In worktree root: npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js
Guardrails:
- Strictly adhere to Zero-Emoji policy across all code, markup, titles, and comments.
- Never log, print, or leak secret token or password values.
- Zero agent sessions spawned on quick-add.
- Touch-friendly on mobile (minimum 44px touch targets, safe area insets).
</env_preflight>

<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/lean-build/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>

<goal>
Upgrade the standalone web board (`web/`) to deliver an exceptional mobile experience:

1. Progressive Web App (PWA) Installability:
   - Create `web/public/manifest.json`:
     - name: "Workflows Task Board"
     - short_name: "Task Board"
     - start_url: "/"
     - display: "standalone"
     - background_color: "#09090b"
     - theme_color: "#09090b"
     - icons: SVG icon at `/icon.svg` (purpose: any maskable).
   - Create `web/public/sw.js`:
     - Service worker caching shell assets (`/`, `/theme.css`, `/app.js`, `/manifest.json`, `/icon.svg`).
     - Network-first / bypass cache for `/api/*` so issue mutations and live board state remain fresh and never serve stale cached mutations.
   - In `web/server/app.ts`:
     - Serve `/manifest.json` (application/manifest+json) and `/sw.js` (application/javascript with `Service-Worker-Allowed: /`).
   - In `web/public/index.html`:
     - Link manifest: `<link rel="manifest" href="/manifest.json">`
     - Meta tags: `<meta name="theme-color" content="#09090b">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`, `<meta name="apple-mobile-web-app-title" content="Task Board">`
     - Apple touch icon: `<link rel="apple-touch-icon" href="/icon.svg">`
     - Mobile viewport: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">`
   - In `web/public/app.js`:
     - Register `/sw.js` when supported.

2. Default to "All Projects":
   - In `web/public/app.js`, set default `state.selected = 'all'`.
   - On initial load without a remembered repository preference, load the combined board `/api/combined/board` across all repositories.
   - Display label: "All Projects".

3. Searchable Project Picker (Replacing the raw native `<select>`):
   - Replace `<select id="repo-select">` with a custom searchable popover/sheet:
     - Trigger button: `#repo-select-btn` showing current scope ("All Projects" or specific repo) with an open indicator.
     - Popover container `#repo-popover`:
       - Search input `#repo-search-input` (placeholder: "Search projects...").
       - Pinned top option: "All Projects" with combined badge count.
       - Searchable list of repositories, filterable in real-time as user types.
       - Tapping an item switches `state.selected`, closes the popover, and updates the board immediately.
       - Tapping backdrop or pressing Esc closes the popover.

4. Mobile-Optimized Segmented Views:
   - In `web/public/index.html`, add a mobile view filter bar above or below the board:
     - Tabs: `[ All Tasks | Needs Human | Running | Drafts ]`
     - `All Tasks`: displays all open tasks.
     - `Needs Human`: filters issues that have `needs:human` or unresolved open questions.
     - `Running`: filters issues that have `status:in-progress`.
     - `Drafts`: filters issues that have `status:draft` with quick-add bar right above.
   - In `web/public/app.js`, wire tab clicks to filter the displayed issue cards.

5. Quick-Add in "All Projects" Mode:
   - When in "All Projects" mode, quick-add should not fail with an error. Instead:
     - Default to the first repository in `state.repositories.repositories` (or `openchamber-github-task-board` if present), OR provide a quick repo selector chip next to the input.
     - Successfully create the draft issue and unshift it into the view.

6. Mobile CSS Polish (`web/public/theme.css`):
   - Card layout optimized for mobile screens:
     - Rich card structure with repo badge, status pill, priority pill, and clean spacing.
     - Minimum 44px tap targets for buttons and interactive rows.
     - Respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for notch and home bar.

7. Automated Regression Tests:
   - In `web/tests/app.test.mjs`, test:
     - `GET /manifest.json` returns 200 and valid JSON.
     - `GET /sw.js` returns 200 with `application/javascript`.
     - `GET /api/combined/board` returns 200.
   - Verify `npm test`, `node --test web/tests/*.test.mjs`, `npm run typecheck`, and `npx tsc -p web/tsconfig.json` all pass cleanly.
</goal>

<scope>
1. Edit `web/public/manifest.json`, `web/public/sw.js`.
2. Edit `web/public/index.html`, `web/public/app.js`, `web/public/theme.css`.
3. Edit `web/server/app.ts` to serve PWA assets.
4. Add tests to `web/tests/app.test.mjs`.
5. Run full test suite and typechecks.
6. Commit changes.
</scope>

<criteria>
PWA manifest and service worker load cleanly; All Projects is the default view; Project picker is searchable; Mobile view tabs (All Tasks, Needs Human, Running, Drafts) filter cards properly; Quick-add functions in All Projects; All tests and typechecks pass with 0 errors.
</criteria>

<output>
At most 10 lines:
Files modified; test pass counts; typecheck exits; commit hash.
</output>
