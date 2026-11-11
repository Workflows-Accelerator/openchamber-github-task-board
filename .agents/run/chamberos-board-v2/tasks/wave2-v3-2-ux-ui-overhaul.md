<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: 0aebf65 (clean; V3-1 server API efficiency, Any-Repo fields `effectiveStage` / `isExplicitDraft` / `bodyMarkdown` / `rateLimit`, and 4 ChamberOS-adapted design skills committed)
Real Chromium launcher: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Key files: web/public/index.html, web/public/theme.css, web/public/app.js, web/public/sw.js, scripts/generate-delivery-smoke.mjs, web/tests/*
Test commands: npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck && npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/v3-server-check.mjs
Do not touch: panel/**, service/**, web/public/arrange.js (unless purely additive non-breaking helper needed), dot-grid math at web/public/app.js:2268 (two-stop radial-gradient verified in real Chromium — NEVER alter), /workspace/code/openchamber-config/**, /workspace/releases/**, GitHub issue closures
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Redesign the ChamberOS web task board UX and UI across narrow viewports (360–430px) and desktop (1280px+), Light and Dark themes, English and French, using the 4 locally adapted design skills while wiring V3-1's universal Any-Repo fields and GitHub API efficiency on the client.</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/V3-1/proof.md]
</context_files>
<skills>
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/frontend-design/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/ui-skills/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/web-design-guidelines/SKILL.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/skills/impeccable-critique/SKILL.md]
</skills>
<owned_paths>
web/public/index.html
web/public/theme.css
web/public/app.js
web/public/sw.js
scripts/generate-delivery-smoke.mjs
web/tests/**
.agents/run/chamberos-board-v2/verifications/V3-2/**
</owned_paths>
<depends_on>
wave2-v3-1-skills-api-anyrepo
</depends_on>
<test_policy>
Existing tests that hard-assert the V1 look WILL fail under this redesign. You are explicitly authorised to UPDATE (never delete, never weaken to a no-op) these assertions to the new V3 values:
- web/tests/issue-53-openchamber-look.test.mjs:365 (480px drawer width) -> assert the new V3 drawer width range.
- web/tests/issue-53-openchamber-look.test.mjs:376-389 (V1 palette tokens #151412, #1d1b18, #262320, #f4f1ea, #f6f4ee, #fcfbf8, #efece4, #181613, #7c1d2e) -> assert the new V3 Light/Dark tokens from step 1, and add a negative assertion that #f6f4ee and #151412 are gone.
- web/tests/issue-53-openchamber-look.test.mjs:506-516 (`<meta name="theme-color" content="#151412">`) -> assert the new V3 theme-color(s).
- web/tests/canvas.test.mjs:364 (250px V1 cards) -> assert the new V3 card width.
Any other pre-existing assertion that fails must be reported in proof.md with the reason it changed; an updated assertion must stay at least as strict as the original. Record a before/after table of every changed assertion in proof.md.
Also add ONE test in web/tests/v3-api-anyrepo.test.mjs proving that a repository with `has_issues: false` makes ZERO issue-list and ZERO GraphQL calls to the fake GitHub (V3-1 proof did not evidence this). If that test exposes a server bug, you may make the minimal fix in web/server/** and say so explicitly in proof.md; otherwise do not touch web/server/**.
Run the test suites SEQUENTIALLY (running them in parallel causes timing flakes in test/stage1-dual-mode-and-scoping.test.js).
</test_policy>
<steps>
<step>1. Author a concise 2-pass design plan in `.agents/run/chamberos-board-v2/verifications/V3-2/design-plan.md` following `frontend-design` + `ui-skills`:
- Architectural studio palette: replace V1's muddy `#f6f4ee` cream / `#151412` brown-black and maroon defaults with a refined architectural neutral palette:
  - Light: crisp alabaster canvas `#F7F8FA`, pure `#FFFFFF` elevated cards, subtle `#F1F3F6` sidebar/chrome, `#0F172A` ink text, `#475569` secondary, `#64748B` muted, hairline `rgba(15, 23, 42, 0.08)` borders, authoritative deep slate/indigo primary accent (`#1E293B` / `#2563EB`) + crisp semantic status tokens.
  - Dark: obsidian studio canvas `#0B0D11`, `#101318` sidebar/chrome, `#161A22` elevated cards, `#1E2430` hover/raised, `#F1F5F9` primary text, `#94A3B8` secondary, `#64748B` muted, hairline `rgba(255, 255, 255, 0.08)` borders.
  - Unify CSS custom properties in `web/public/theme.css` (eliminating the drifted duplicate `:root` / `[data-theme="dark"]` redefinitions around line 2224) while keeping `--canvas-dot-rgb` crisp in both themes and NEVER modifying the two-stop `radial-gradient` formula at `app.js:2268`.
- Eliminate AI-slop & legacy clutter:
  - Sentence-case labels everywhere (zero `text-transform: uppercase` + wide `letter-spacing` micro-labels on sidebar sections, Operations stat cards, table headers, or repo band headers).
  - Replace middle-dot meta soup (`Task Board · All Projects · 8 tasks · Loaded just now`) with a clean, quiet header context bar: active project pill + live count badge (`tabular-nums`) + subtle sync/API freshness indicator.
  - Apply `font-variant-numeric: tabular-nums` to all counts, `#issue` numbers, zoom readouts, timestamps, and Operations table cells; concentric radii (`inner = outer - padding`); compositor-only (`transform`, `opacity`) transitions `<= 200ms` with `@media (prefers-reduced-motion: reduce)`.</step>
<step>2. Overhaul viewport architecture & narrow-screen (`<=768px`) UX (CRITICAL: NEVER use the word `"mobile"` in any text, ID, CSS class, comment, or variable — use `compact` / `narrow` / `dock` naming per U7!):
- Fix `hostile4`'s 48px viewport overhang permanently: replace every `100vh` with `100dvh` (`height: 100dvh; overflow: hidden` flex shell on `#board-view` / `.app-layout`) so `#compact-header` + `#main` + `#compact-nav-dock` sum to exact `100dvh` (`0px` window overflow at `360x800`, `390x844`, `768x900`, `1280x900`) with `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)`.
- Collapse the 4-row 180px narrow header stack into ONE crisp `52px` top bar on `<=768px`: `[Menu toggle]` + `[Project switcher trigger showing current project/All Projects + count]` + `[Search icon toggle that expands an inline search bar on demand]` + `[Filter trigger w/ active indicator]` + `[Compact New Task button]`.
- Add a thumb-zone Bottom Navigation Dock (`#compact-nav-dock`, visible on `<=768px`) with 4 primary destinations (`impeccable-critique` Working Memory `<=4` rule): `Canvas` (`Canevas`), `List` (`Liste`), `Decisions` (`Décisions` + badge), `Blocked` (`Bloqué` + badge), keeping ≥44×44px tap targets. Keep `#app-sidebar` slide-over drawer for `Operations`, `Archive`, `Client view`, `Settings`, `Language`, `Sign out`. Hide `#nav-discussions` (`hidden` attribute) since GitHub Discussions are not enabled, eliminating the dead placeholder view from navigation (U9).
- Redesign `#canvas-controls` into a sleek, single-row floating studio dock anchored cleanly at the bottom-center (or top-right on wide desktop, bottom-center inside `#canvas-viewport` on `<=768px`) with compact icon/short-label controls (`-`, `100%`, `+`, `Fit`, `Reset`, `Arrange`, `Undo`) so even at `360px` in French with `Undo` visible, `#canvas-controls` stays compact (1 row or ultra-clean 2-pill dock, `<56px` height instead of a 115px 3-row white slab!), strictly inside `#canvas-viewport` on both X and Y axes with zero button overlap!
- Smart initial Canvas fit on narrow screens: when auto-fitting on initial load at viewport width `<=640px`, clamp initial scale floor to a readable minimum (`>= 0.55`) centered on the primary/top-left cluster so cards are immediately legible on a phone instead of shrinking to `20%`, while clicking explicit `#canvas-fit-all` still fits the entire bounding box at any scale!</step>
<step>3. Overhaul `List` view, Project Switcher, Detail Drawer, Bilingual EN/FR parity, and Any-Repo + API client wiring in `web/public/app.js` & `web/public/index.html`:
- Wire V3-1's `effectiveStage` and `isExplicitDraft`:
  - Update `stageOf(issue)` to use `issue.effectiveStage` when present (falling back cleanly for synthetic unit-test objects that omit `effectiveStage`).
  - In Client presentation mode (`isIssueHiddenInClientMode`), hide drafts using `issue.isExplicitDraft === true` (or `issue.statusLabel === 'status:draft'` when `isExplicitDraft` is undefined, preserving 100% of `a5-presentation-audit.test.mjs` while ensuring vanilla GitHub repos with `statusLabel: null` show all their open tasks in Client view!).
- Redesign `List` view (`renderBoard` list mode):
  - Organize `.task-row` items into clean, collapsible Stage Groups (`Needs human`, `In progress`, `In review`, `Todo`, `Planned`, `Backlog`, `Draft`, `Done` — rendering ONLY non-empty groups so a vanilla GitHub repo with 10 open issues cleanly shows `Todo (10)` with zero empty ChamberOS clutter!), with a crisp toggle to view flat sorted rows when desired. Every task row keeps `.task-row` class and displays a semantic status pill, `#number` (`tabular-nums`), project badge (when in All Projects), clean title + subtitle preview, priority badge, and dependency/decision chips.
  - Replace the cramped bottom 4-input draft bar (where placeholder text clipped) with an unclipped, responsive Quick Task Composer bar + keyboard shortcut (`n` focuses new task input when not typing, `/` focuses search, `Escape` closes open popovers/drawer). Ensure no button anywhere has both a `+` icon and `"+"` text prefix (U6).
- Upgrade the Project Switcher (`#repo-popover` + narrow trigger):
  - Instant search input across all 26+ repositories, `All Projects` (`Tous les projets`) pinned first, open-issue count badges (`openIssuesCount`, `tabular-nums`) on each repo, dimmed `hasIssues === false` repos, and subtle GitHub API rate-limit / cache freshness readout in the footer/Settings.
- Upgrade the Issue Detail Drawer (`#detail-view`) for ANY GitHub repo:
  - Responsive slide-over panel on desktop (`480–540px` width) and clean full-height bottom/side sheet on `<=768px` with sticky header (`repo #number`, direct external link `Open in GitHub` / `Ouvrir sur GitHub`, `44x44px` close button).
  - Interactive status & priority controls right below the title.
  - Render `issue.bodyMarkdown` (via `markdown.js`) cleanly when an issue has normal GitHub Markdown instead of ChamberOS sections, hiding empty `Open Questions` / `Human Tasks` / `Acceptance Criteria` sections when zero items exist (keeping compact progressive-disclosure action buttons when needed) so vanilla GitHub issues look native and uncluttered!
  - Actionable, inviting empty states when a project has `0` open tasks (clear message + one-click `Create a task` / `Switch project`).
- Complete EN + FR localization parity:
  - Set `document.documentElement.lang = lang` (`'fr'` or `'en'`) inside `applyLanguage(lang)`.
  - Localize `statusText(...)` and priority labels (`urgent`/`high`/`medium`/`low`) in French (`À faire`, `En cours`, `Validation`, `En revue`, `Planifié`, `Backlog`, `Brouillon`, `Terminé`; `Urgente`, `Haute`, `Moyenne`, `Basse`) across Canvas cards, List rows, Decisions, Blocked, Operations, Archive, Client view, and Detail Drawer!
- Client GitHub API & PWA efficiency:
  - Store response `ETag` per GET URL in `app.js` and send `If-None-Match` on subsequent GETs to `/api/board`, `/api/repos/.../board`, `/api/combined/board`, handling `304 Not Modified` seamlessly in memory.
  - Pass `?refresh=1` when the user explicitly clicks `#refresh-btn`; pause any periodic background refresh while `document.visibilityState === 'hidden'`.
  - Update `web/public/sw.js`: bump `CACHE_VERSION = '2.0.0'` and add `'/markdown.js'` and `'/arrange.js'` to `isShellRequest`.</step>
<step>4. Strengthen `scripts/generate-delivery-smoke.mjs` & run full empirical Chromium verification:
- Fix `hostile4`'s non-blocking vacuity gap in `scripts/generate-delivery-smoke.mjs`: assert `buttons.length >= 6` (and `=== 7` when Undo is visible) so HUD containment can never pass vacuously, AND assert `document.documentElement.lang === lang` and `0px` `#canvas-viewport` bottom overhang (`viewportRect.bottom <= windowHeight + 0.5`).
- Launch a synthetic fixture server (including both a ChamberOS repo AND a vanilla GitHub repo with unlabeled Markdown issues + a 0-issue repo!) and drive real Chromium via `hostile2/scripts/chromium-env.sh` to capture screenshots across `360x800` (phone), `390x844` (iPhone), `768x900`, and `1280x900` (desktop) in Light & Dark, EN & FR (Canvas, List, Detail Drawer on vanilla repo, Project Switcher, Decisions, Operations, Client view) under `.agents/run/chamberos-board-v2/verifications/V3-2/screenshots/`.
- Visually inspect your own captured PNGs and apply `impeccable-critique` Squint Test + 5-Stage Polish Triage to fix any clipping, crowding, contrast, or alignment flaws before committing!
- Run `npm test`, `node --test --test-timeout=30000 web/tests/*.test.mjs`, `npm run typecheck`, `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/v3-server-check.mjs`, and `scripts/generate-delivery-smoke.mjs`. Confirm zero console errors and zero CSP violations (`style-src 'self'` — never emit HTML `style="..."` attributes!). Write `.agents/run/chamberos-board-v2/verifications/V3-2/proof.md` and commit cleanly on `feat/board-v3`.</step>
</steps>
<criteria>
1. Phone (`360x800`, `390x844`) and Desktop (`1280x900`) Light/Dark EN/FR layouts pass real Chromium inspection with `0px` viewport overhang (`100dvh`), single-row `52px` compact top bar + thumb-zone bottom dock on `<=768px`, compact `#canvas-controls` strictly contained inside `#canvas-viewport` (with non-vacuous `>=6` visible controls check), and readable initial Canvas card scale on narrow viewports.
2. Zero AI-slop tells (no `#f6f4ee` muddy cream, no ALL-CAPS tracked micro-labels, no middle-dot meta soup); `tabular-nums` applied; `<html lang>` updates dynamically in EN/FR; all status and priority badges translate in FR.
3. Vanilla GitHub repositories without `status:*` labels or ChamberOS body sections display open issues cleanly as `Todo` (not `Draft`), show all open non-draft issues in Client presentation mode, and render clean Markdown descriptions in the Detail Drawer without empty ChamberOS boilerplate.
4. Core invariants intact: `app.js:2268` two-stop dot grid untouched, Markdown notes under cards, topological Arrange + Undo, views `"Canvas"`/`"List"`, sidebar navigation, `#nav-discussions` hidden when disabled, zero `"n8n"`, zero word `"mobile"` anywhere in code/DOM/CSS/copy, zero emojis, no `+` icon + `"+"` text duplication, zero CSP violations (`style-src 'self'`).
5. `sw.js` `CACHE_VERSION = '2.0.0'` covers `/markdown.js` and `/arrange.js`; client sends `If-None-Match` (`304`) and pauses refresh when hidden; `npm test` (618/618), all `web/tests/*.test.mjs`, `npm run typecheck`, and `scripts/generate-delivery-smoke.mjs` exit 0.
</criteria>
<verification>
npm test && node --test --test-timeout=30000 web/tests/*.test.mjs && npm run typecheck
</verification>
<output>
Respond in concise structured Markdown with:
- STATUS: PASS | FAIL
- COMMITS: exact commit SHAs on feat/board-v3
- UX_UI_SUMMARY: concrete changes delivered for phone (360-430px) and desktop (1280px+), Light/Dark, EN/FR, Any-Repo drawer/list, and client 304/visibility efficiency
- SCREENSHOTS: exact paths of real Chromium screenshots captured under `.agents/run/chamberos-board-v2/verifications/V3-2/screenshots/`
- INVARIANT_CHECKS: grep/assertion results for zero `"mobile"`, zero `"n8n"`, zero emojis, dot-grid untouched, `<html lang>`, `0px` viewport overhang, non-vacuous HUD containment, zero CSP errors
- TEST_COUNTS: legacy tests, web tests, typecheck, smoke suite verdicts
- NOT_VERIFIED: explicit blind spots remaining for V3-3 independent hostile review
</output>
