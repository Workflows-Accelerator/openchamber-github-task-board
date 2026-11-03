# Exploration Findings: Online Board Visual Polish & Sign-in Flash

## Summary Verdict

Issue #54 is caused by static HTML defaulting `#login-view` to visible while three sequential network calls resolve before the board is shown. Issue #53 is caused by fundamental architectural layout and density differences between the web board (centered 860px column, multi-level toolbar, bulky badge rows) and the OpenChamber panel (full-width edge-to-edge layout, compact unified toolbar, Linear-style dot rows).

---

## Part 1: Sign-in Flash (#54)

### 1. Root Cause
In `web/public/index.html`, `#login-view` is statically rendered without `hidden`, while `#board-view` has `hidden`. On reload, `app.js` runs `boot()`:
1. `GET /api/session` (session check)
2. `GET /api/repos` (repository enumeration)
3. `GET /api/combined/board` (GitHub issue sync)
4. Calls `showView('board')` only after all three requests complete.

Throughout this sequence, the sign-in form remains visible on screen.

### 2. Empirical Timing Data
- **Live WAN (`board.workflows.ac`):**
  - Unauthenticated `GET /api/session`: 13.17ms (312ms including TLS/TCP handshake from cold)
  - `GET /health`: 64.74ms
  - Asset downloads: `/` (7.09ms), `/theme.css` (9.75ms), `/app.js` (12.52ms)
  - Full WAN cascade: ~1.2s to 1.8s before issue data returns and view flips.
- **Local Loopback (`127.0.0.1`):**
  - `t=97ms`: Navigation start (`#login-view` visible)
  - `t=106ms`: `/api/session` request begins
  - `t=123ms`: `/api/session` resolves (17ms)
  - `t=124ms`: `/api/repos` resolves (19ms)
  - `t=150ms`: `/api/combined/board` begins
  - `t=252ms`: `/api/combined/board` resolves (102ms)
  - `t=255ms`: MutationObserver records `hidden` set on `#login-view` and removed from `#board-view`
  - Total local flash duration: 158ms.

### 3. Solution Options for #54

#### Option 1 (Recommended): Neutral Loading Shell with Fast View Flip
- **Mechanism:** Set `hidden` on `#login-view` by default in `index.html`. Show a minimal neutral skeleton or spinner shell (`#loading-view`). In `boot()`, immediately reveal `#board-view` as soon as `/api/session` succeeds (~15ms), showing an in-board loading skeleton while repos/issues fetch. If unauthenticated, reveal `#login-view`.
- **Security:** Zero risk. Session validation remains server-enforced via HttpOnly Secure cookie.
- **Offline/PWA:** Safe; offline handler reveals offline shell without showing sign-in.
- **Effort:** Low (15-25 lines). Changes: `web/public/index.html`, `web/public/app.js`, `web/public/theme.css`.

#### Option 2: Client-Side Session Hint Cookie / LocalStorage
- **Mechanism:** Set a non-secret client-readable boolean flag (`tb_auth=1`) on successful login. An inline `<script>` in `<head>` hides `#login-view` before DOM paint if flag is present.
- **Trade-offs:** Can show a momentary flash of empty board shell if session was revoked server-side.
- **Effort:** Low (20-30 lines). Changes: `web/public/index.html`, `web/public/app.js`.

#### Option 3: Server-Side Rendered View State
- **Mechanism:** Web server parses `board_session` cookie on `GET /` and injects `hidden` attribute onto `#login-view`.
- **Trade-offs:** Breaks static service worker shell caching; requires dynamic HTML templating.
- **Effort:** Medium (60-90 lines). Changes: `web/server/app.ts`, `web/public/sw.js`.

---

## Part 2: OpenChamber Visual Alignment (#53)

### 1. Concrete Difference Inventory

| Category | OpenChamber Task Board Panel | Standalone Web Board | Difference Type |
| :--- | :--- | :--- | :--- |
| **Page Layout** | Full-width edge-to-edge (100%), 8-16px padding | Centered column constrained to `max-width: 860px` | Structural |
| **Top Toolbar** | Single compact bar: Repo pill, Search with lens icon, Filter, Sort, View, +Issue | 2 disconnected tiers: header + standalone Project dropdown + 3-column button bar | Structural |
| **Task Rows** | Compact Linear style (32px): status dot, title, muted subtitle preview | Chunky cards (64px): title, #id, multi-colored pill badges (repo, status, priority) | Structural & Token |
| **Detail Drawer** | Slide-over panel (480px) with structured properties, agent/worktree state | Push/modal drawer with large textareas and card containers | Structural |
| **Color Tokens** | Dark bg `#0f1012`, elevated `#16181b`, borders `rgba(255,255,255,0.08)` | Standalone `:root` fallback variables: darker base `#09090b`, different contrasts | Token-level |
| **Light Theme** | Soft neutral gray surfaces (`#ffffff`, `#f4f5f7`, `#eaedf0`, borders `#d0d5dd`) | Pure white background with dark input borders and default select controls | Token-level |
| **Empty States** | Clean list view without unnecessary empty containers | Large static "Done" drop-target container at bottom of list | Structural |

### 2. Stylesheet & Token Sharing
- **Tokens:** The OpenChamber host theme token dictionary (`--oc-bg`, `--oc-elevated`, `--oc-fg`, `--oc-muted`, `--oc-border`, `--oc-primary`, etc.) can be directly duplicated into `web/public/theme.css` default values for both dark and light modes.
- **Styles:** The panel stylesheet lives as an inline `<style>` block inside `panel/index.html` (~3500 lines) tightly coupled to SDK message bridges. Direct file sharing is not possible without extracting shared rules into a separate common CSS file.

### 3. Alignment Options for #53

#### Option A (Recommended): Structural Toolbar & Row Density Alignment
- **Scope:** Align page layout to full-width, replace multi-tier controls with a single unified toolbar, switch simple list rows to status-dot format, and adopt OpenChamber token palette.
- **What User Sees:** Web board immediately feels like OpenChamber: compact, fast, modern, and space-efficient.
- **Effort / Risk:** Medium (~2-3 days) / Low risk. Confined to `web/public/index.html`, `theme.css`, `app.js`.

#### Option B: Token and Color Palette Match Only
- **Scope:** Update CSS variables in `theme.css` to match OpenChamber dark/light colors and fonts without altering DOM structure.
- **What User Sees:** Colors match, but the layout remains a wide centered column with chunky cards and separate buttons.
- **Effort / Risk:** Low (~4 hours) / Negligible risk.

#### Option C: Unified Shared Stylesheet Build
- **Scope:** Extract common CSS from `panel/index.html` into a shared module used by both panel and web board.
- **What User Sees:** Pixel-identical components and shared maintenance.
- **Effort / Risk:** High (~4-6 days) / Medium risk of regressing extension panel styling.

---

## Part 3: Hostile Self-Check

- **Assumptions made:** Assumed standard evergreen desktop browser. Assumed token access allows reading same repositories.
- **What could be wrong:** WAN latency varies significantly depending on geographical distance to `board.workflows.ac` and GitHub GraphQL API response times.
- **What was not verified:**
  1. Physical mobile devices (tested via Obscura 360x640 emulation).
  2. Standalone installed PWA home screen launches on iOS/Android.
  3. Third-party password manager auto-fill prompts triggered during the brief flash.

---

## Verification Artifacts
- Measurements: `.agents/run/online-board-polish-explore/metrics.json`
- Reproduction script: `.agents/run/online-board-polish-explore/harnesses/run-exploration.mjs`
- Screenshots in `.agents/run/online-board-polish-explore/screenshots/`:
  - `flash-login-visible.png` (reproduced #54 sign-in flash during load)
  - `flash-board-visible.png` (board view loaded after sync)
  - `panel-1280-dark.png` vs `web-1280-dark.png`
  - `panel-1280-light.png` vs `web-1280-light.png`
  - `panel-360-dark.png` vs `web-360-dark.png`
  - `panel-360-light.png` vs `web-360-light.png`
  - `panel-drawer-1280-dark.png` vs `web-drawer-1280-dark.png`
