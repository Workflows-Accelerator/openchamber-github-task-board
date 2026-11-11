# V3-2 UX/UI Overhaul — Empirical Verification Proof

- **Worktree**: `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3`
- **Branch**: `feat/board-v3` (base `0aebf65`)
- **Browser Engine**: Real Headless Chromium (`Google Chrome for Testing 156.0.8078.4` via `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh`)

---

## 1. Summary of Delivered Changes

1. **Architectural Studio Palette & Typography (`web/public/theme.css`, `web/public/index.html`)**
   - Replaced V1 warm-cream/brown-black tokens (`#f6f4ee`, `#151412`) with crisp Light (`#F7F8FA` ground, `#FFFFFF` card, `#F1F3F6` chrome, `#0F172A` primary ink, `#475569` secondary, `#64748B` muted, `rgba(15, 23, 42, 0.08)` hairline, `#1E293B` primary / `#2563EB` accent) and Dark (`#0B0D11` ground, `#101318` chrome, `#161A22` card, `#1E2430` raised, `#F1F5F9` primary ink, `#94A3B8` secondary, `#64748B` muted, `rgba(255, 255, 255, 0.08)` hairline) tokens, plus unified sticky-note tints (`yellow`, `blue`, `green`, `pink`, `slate`).
   - Updated `<meta name="theme-color" content="#0B0D11">`.
   - Eliminated ALL-CAPS micro-tracking soup and middle-dot meta strings; applied `font-variant-numeric: tabular-nums` to issue numbers, counts, badges, and zoom readout; constrained transitions to compositor/color properties (`<=200ms`) with `@media (prefers-reduced-motion: reduce)` instant fallback.

2. **Responsive Zero-Overhang Shell & Narrow Viewport Ergonomics (`360–430px` & `1280px+`)**
   - Built a `100dvh` (`100vh` fallback) zero-overhang flex/grid shell across `360x800`, `390x844`, `768x900`, and `1280x900` honoring `env(safe-area-inset-*)`.
   - Replaced the tall stacked narrow header with a single-row `52px` `.compact-header` on `<=768px` (project switcher trigger with count pill, search toggle, filter trigger, primary new-task trigger — all `14x14` inline SVGs inside `>=44x44px` hit targets) paired with `#compact-nav-dock` at the bottom thumb zone (`Canvas`/`Canevas`, `List`/`Liste`, `Decisions`/`Décisions`, `More`/`Plus`).
   - Redesigned `#canvas-controls` into a compact floating bar (`50–52px` height, `44px` button height) centered inside `#canvas-viewport` (`-`, `100%`, `+`, `Fit`/`Tout`, `Reset`/`Réinit.`, `Arrange`/`Organiser`, plus conditional `Undo`/`Annuler`) so all 7 buttons fit strictly inside `#canvas-viewport` even at `360px` in French with zero overlap.
   - Clamped automatic initial Canvas fit on narrow screens (`<=640px`) to a readable scale floor (`>= 0.55`) anchored on the top-left cluster while explicit `#canvas-fit-all` fits the full bounding box at any scale.

3. **Universal Any-Repo List, Project Switcher, Detail Drawer & Bilingual EN/FR Parity (`web/public/app.js`)**
   - Wired `stageOf(issue)` to prefer `issue.effectiveStage` (mapping unlabeled open vanilla GitHub issues to `todo` instead of `draft`) and `isIssueHiddenInClientMode(issue)` to hide only explicit drafts (`issue.isExplicitDraft === true`, falling back to `statusLabel === 'status:draft'` when `isExplicitDraft` is omitted in legacy unit fixtures).
   - Upgraded `List` view to render collapsible non-empty Stage Groups (`Needs human` -> `Done`) with a flat-list toggle (`#list-group-toggle`, automatically hidden in Canvas mode) and responsive Quick Task Composer (`n` focuses new task, `/` focuses search, `Escape` closes active popovers/composer/drawer).
   - Upgraded `#repo-popover` with instant search filtering, pinned `All Projects` / `Tous les projets`, `openIssuesCount` (`tabular-nums`), dimmed `hasIssues === false` repositories, and GitHub API rate-limit + freshness telemetry in the footer.
   - Upgraded `#detail-view` (`min(520px, 100vw)` desktop slide-over / full-height sheet on `<=768px`) with sticky identity header, compact status/priority controls right below the title, native `issue.bodyMarkdown` rendering via `markdown.js` (`isVanillaMarkdownIssue` suppresses ChamberOS `phase: planning` and edit-warning boilerplate on vanilla GitHub issues while keeping full ChamberOS Overview editing intact), hidden empty ChamberOS checklist/question panels, and actionable empty-repo state (`Create a task` / `Switch project`).
   - Completed EN/FR parity: `applyLanguage(lang)` sets `document.documentElement.lang = lang` (`'en'` / `'fr'`) and re-renders active views/drawer; localized all status and priority labels (`À faire`, `En cours`, `Validation`, `En revue`, `Planifié`, `Backlog`, `Brouillon`, `Terminé`; `Urgente`, `Haute`, `Moyenne`, `Basse`), action chips, and GitHub external links.

4. **Client HTTP 304 Revalidation, Hidden-Tab Guard & Service Worker (`web/public/app.js`, `web/public/sw.js`)**
   - Added per-URL `ETag` / `If-None-Match` memory cache in `api()` returning cached payloads on `304 Not Modified`, bypassing cache with `?refresh=1` on `#refresh-btn`, and pausing periodic refresh when `document.visibilityState === 'hidden'` (resuming on `visibilitychange` when stale).
   - Bumped `web/public/sw.js` `CACHE_VERSION = '2.0.0'` and included `'/markdown.js'` and `'/arrange.js'` in `SHELL_ASSETS` and `isShellRequest`.

---

## 2. Sequential Test & Smoke Verification Results

| Suite / Command | Result | Verdict |
|---|---|---|
| `npm test` | `618 / 618` passed (`0` failed) | **PASS** |
| `node --test --test-timeout=30000 web/tests/*.test.mjs` | `586 / 586` passed (`0` failed) | **PASS** |
| `npm run typecheck` | `tsc --noEmit` exited `0` | **PASS** |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/v3-server-check.mjs` | Bundled `222.8kb` in `146ms`, exit `0` | **PASS** |
| `source .../chromium-env.sh && node scripts/generate-delivery-smoke.mjs` | `8 / 8` steps `PASS` in `smoke.json`; `13 / 13` HUD/lang/overhang cases `PASS` in `canvas-measurements.json`; `15` PNGs captured | **PASS** |

---

## 3. Pre-Existing Test Assertions Updated for V3 Design Spec

Zero assertions were deleted or weakened. Every modification updates a V1 design constant (V1 cream/brown palette, 250px card width, 480px fixed drawer width, flat-only task list children, `1.1.0` SW cache) to assert the corresponding V3 contract:

| File | Test Name | Before (V1 Assertion) | After (V3 Assertion) | Rationale |
|---|---|---|---|---|
| `web/tests/canvas.test.mjs` | `canvas client: theme.css enforces z-indices, 280px V3 cards, and unbounded plane` | `.canvas-card { width: 250px }`; `--canvas-dot-rgb: 244, 241, 234` (dark) and `24, 22, 19` (light) | `.canvas-card { width: 280px }`; `--canvas-dot-rgb: 241, 245, 249` (`#F1F5F9` dark) and `15, 23, 42` (`#0F172A` light) | V3 upgrades Canvas cards to `280px` (`colWidth = 320px`) and crisp architectural studio ink tokens. |
| `web/tests/issue-53-openchamber-look.test.mjs` | `2.b D63.2 Search input filters task list dynamically` | `get('task-list').children.length` directly counted flat `.task-row` items (`2` -> `1` -> `2`) | Asserts both `findTaskRows(get('task-list')).length` (`2` -> `1` -> `2`) AND `get('task-list').children.length` non-empty `.stage-group` containers (`2` -> `1` -> `2`) | V3 List view groups `.task-row` elements inside collapsible non-empty `.stage-group` sections by default. |
| `web/tests/issue-53-openchamber-look.test.mjs` | `3.a D63.3 Simple list rows render in compact Linear style...` & `6.b Blocker 2` | Indexed `list.children[0].children[0] \|\| list.children[0]` assuming direct row children | Uses `findTaskRows(list)` (`rows.length === 2`, `row0 = rows[0]`) while still asserting `list.children.length === 2` stage groups | Traverses stage-grouped DOM to inspect the `.simple-row.task-row` structure and stripped Markdown preview. |
| `web/tests/issue-53-openchamber-look.test.mjs` | `4.b D63.4 theme.css styles slide-over drawer with 480-540px width on desktop` | `/min\(480px,\s*100(?:vw\|%)\)/` | Parses `width: min(<px>, 100vw)` on `.task-drawer` and asserts `480 <= width <= 540` (`520px` actual) | V3 brief specifies `480–540px` desktop Detail Drawer width. |
| `web/tests/issue-53-openchamber-look.test.mjs` | `5.a D64 theme.css defines V3 architectural studio dark and light color tokens...` | Asserted V1 warm paper hexes (`#151412`, `#1d1b18`, `#262320`, `#f4f1ea`, `#f6f4ee`, `#fcfbf8`, `#efece4`, `#181613`, `#7c1d2e`) | Asserts V3 Dark (`#0B0D11`, `#101318`, `#161A22`, `#1E2430`, `#F1F5F9`, `#94A3B8`, `rgba(255, 255, 255, 0.08)`) & Light (`#F7F8FA`, `#FFFFFF`, `#F1F3F6`, `#0F172A`, `#475569`, `#64748B`, `#1E293B`, `#2563EB`, `rgba(15, 23, 42, 0.08)`) AND asserts absence of `#f6f4ee` and `#151412` | V3 brief explicitly replaces V1 muddy cream/brown-black palette with architectural studio tokens. |
| `web/tests/issue-53-openchamber-look.test.mjs` | `6.d Blocker 4: ... index.html sets V3 theme-color #0B0D11` | `<meta name="theme-color" content="#151412">` | `<meta name="theme-color" content="#0B0D11">` | Matches V3 Dark canvas ground `#0B0D11`. |
| `web/tests/sw.test.mjs` | `sw.js defines versioned cache name 2.0.0, network-first shell...` | Checked generic `CACHE_NAME` and `/index.html`, `/app.js`, `/theme.css`, `/manifest.json` | Also asserts `CACHE_VERSION = '2.0.0'` and `/markdown.js` + `/arrange.js` in both `SHELL_ASSETS` and `isShellRequest` | Enforces V3 PWA offline shell coverage and cache bump. |

### New / Additive Tests Added
- `web/tests/v3-ux-client.test.mjs` (3 tests): Any-Repo `effectiveStage` & `isExplicitDraft` behavior + collapsible non-empty stage groups; Detail Drawer `bodyMarkdown` + hidden empty ChamberOS panels + `<html lang>` & FR status/priority localization; Client `ETag`/`If-None-Match` `304` memory revalidation, `?refresh=1` bypass, and hidden-tab refresh pause.
- `web/tests/v3-api-anyrepo.test.mjs` (+1 test): Verifies `has_issues: false` repositories trigger zero GitHub REST issue-list calls and zero GraphQL dependency calls on both scoped and combined board endpoints.

---

## 4. Hard Invariant Checks

- **Dot-grid formula untouched at `web/public/app.js:2268`**:
  `viewport.style.backgroundImage = 'radial-gradient(rgba(var(--canvas-dot-rgb, 24, 22, 19), ' + alpha + ') ' + dotRadius.toFixed(2) + 'px, transparent ' + dotRadius.toFixed(2) + 'px)';` (verified exact line & string).
- **Zero word `"mobile"`**: `0` matches across `web/public/{index.html,theme.css,app.js,sw.js}`, `scripts/generate-delivery-smoke.mjs`, and `web/tests/v3-ux-client.test.mjs` (enforced by `canvas.test.mjs:386`).
- **Zero `"n8n"`**: `0` matches across `web/public/*` and `scripts/generate-delivery-smoke.mjs`.
- **Zero UI emojis**: `0` `\p{Extended_Pictographic}` matches across `web/public/{index.html,theme.css,app.js,sw.js}`.
- **Zero inline HTML `style="..."` & zero CSP violations**: `0` `style="` attributes in `web/public/index.html` and `web/public/app.js`; `0` console errors, `0` page errors, and `0` CSP `securitypolicyviolation` events in real Chromium.
- **All inline `<svg>` icons sized `14x14`**: `23 / 23` `<svg>` tags in `web/public/index.html` carry explicit `width="14" height="14"`.
- **Zero `+` icon + `"+"` text duplication (U6)**: `0 / 57` HTML buttons combine an `<svg>` icon with `"+"` text.
- **Non-vacuous HUD containment, `<html lang>`, & `0px` overhang (`canvas-measurements.json`)**: Across all `13` combinations (`360x800`, `390x844`, `768x900`, `1280x900` x EN/FR x Light/Dark x 6-button default & 7-button Undo visible), `buttons.length` is `6` (or `7` with Undo), `hudRect.height` is `50–52px` (`<56px`), `buttonOverlaps: []`, `buttonsOutsideViewport: []`, `zeroViewportBottomOverhang: true`, `zeroDocumentOverflow: true`, and `document.documentElement.lang === lang`.

---

## 5. Real Chromium Screenshot Manifest (`.agents/run/chamberos-board-v2/verifications/V3-2/screenshots/`)

1. `01-list-1280-light-en.png` — Desktop `1280x900` Light EN grouped List view (`ChamberOS Platform`)
2. `02-canvas-notes-wires-1280-light-en.png` — Desktop `1280x900` Light EN Canvas with Markdown sticky note under cards, dependency wires, and 2-stop dot grid
3. `03-canvas-notes-wires-1280-dark-en.png` — Desktop `1280x900` Dark EN Canvas with sticky note, wires, and compact floating HUD
4. `04-canvas-390-dark-en.png` — Narrow `390x844` Dark EN Canvas showing `0.55` initial smart-fit scale, `52px` `.compact-header`, `#canvas-controls`, and `#compact-nav-dock`
5. `05-canvas-undo-360-light-fr.png` — Narrow `360x800` Light FR Canvas after topological Arrange showing all 7 HUD buttons (`-`, `43%`, `+`, `Tout`, `Réinit.`, `Organiser`, `Annuler`) strictly inside `360px` width
6. `06-list-vanilla-390-light-fr.png` — Narrow `390x844` Light FR vanilla GitHub repository (`acme/vanilla-docs`) showing `À faire` stage group (`Todo`, zero `Draft` misrouting, zero empty stage groups)
7. `07-drawer-vanilla-1280-dark-en.png` — Desktop `1280x900` Dark EN Detail Drawer on vanilla Markdown issue rendering headings, lists, and code blocks cleanly with empty ChamberOS checklists hidden
8. `08-drawer-vanilla-360-light-fr.png` — Narrow `360x800` Light FR Detail Drawer sheet on vanilla Markdown issue with localized status/priority controls
9. `09-project-switcher-390-dark-en.png` — Narrow `390x844` Dark EN searchable `#repo-popover` with pinned `All Projects`, `tabular-nums` open counts, dimmed `hasIssues: false` repo, and API rate-limit footer
10. `10-empty-repo-360-light-en.png` — Narrow `360x800` Light EN empty repository state with `Create a task` and `Switch project` actions
11. `11-decisions-768-light-fr.png` — Tablet `768x900` Light FR Decisions view
12. `12-blocked-360-dark-en.png` — Narrow `360x800` Dark EN Blocked tasks view with wrapped card metadata
13. `13-operations-1280-light-fr.png` — Desktop `1280x900` Light FR Operations overview
14. `14-client-view-1280-dark-en.png` — Desktop `1280x900` Dark EN Client presentation view across `All Projects` (including open vanilla GitHub issues while hiding explicit drafts)
15. `15-composer-390-dark-fr.png` — Narrow `390x844` Dark FR Quick Task Composer with unclipped localized inputs and project selector
