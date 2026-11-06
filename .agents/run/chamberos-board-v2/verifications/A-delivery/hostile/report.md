# Hostile Review Report: Foundation Staged Release & Polish Verification

**Review Target:** Code Commit `c1f1807` (`c1f1807312c2c90225874f5fac9a6b0dff401ff8`) & Verification Commit `9e244aa` (`9e244aa5e9603c59d57577beb45c13b8e865abc5`)  
**Worktree:** `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`  
**Branch:** `feat/chamberos-board-v2`  
**Staged Release Artifact:** `/tmp/opencode/board-v2-staging/c1f1807-foundation/`  
**Isolated Preview Service:** `http://127.0.0.1:4041` (Supervisor PID: `247563`, Node PID: `247583`)  
**Synthetic GitHub Port:** `http://127.0.0.1:44149` | **Obscura CDP:** `ws://127.0.0.1:9222/devtools/browser`  
**Date:** Fri Nov 06 2026  

---

## 1. Executive Summary & Verdicts

| Dimension | Verdict | Summary |
|---|---|---|
| **Spec Verdict** | **PASS** | `All Projects` routing in Operations/Archive aggregates multi-repo tasks with `BOARD_REPO` configured; section state persists across project switches; canvas buttons have `white-space: nowrap; flex-shrink: 0;`; wire smoke test counts 4 visible rendered wires; packaging and checksums are verified. |
| **Quality Verdict** | **NEEDS-FIXES** | Uncovered two responsive/visual defects and two documentation/script flaws: 1) On a 360px viewport in French, HUD buttons overflow the left viewport edge by 31px, clipping the zoom-out (`-`) button offscreen; 2) The `0px` radial-gradient stop causes Obscura 0.2.6 to rasterize an extreme high-contrast optical polka-dot grid across the canvas; 3) `proof.md` underreports packaged audit tests as 12 instead of 13; 4) `generate-delivery-smoke.mjs` statically assigns `verdict: 'PASS'` for browser diagnostics. |
| **Overall Verdict** | **HALT** | **Do not proceed directly to live cutover.** Dispatch a bounded fix task to resolve the 360px French HUD overflow and dot-grid rasterization flaw before human acceptance and production deployment. |

---

## 2. Exact Hostile Findings

### Finding 1: 360px Mobile Viewport Horizontal Overflow in French (Visual & Functional Defect)
- **Severity:** Moderate Risk (UX / Functional clipping on mobile in French)
- **Files & Lines:** `web/public/theme.css:1593-1630`, `web/public/app.js:980-998`
- **Reproduction:**
  1. Set viewport to 360 × 800 (`setDeviceMetricsOverride: { width: 360, height: 800 }`).
  2. Switch language to French (`#lang-switch-btn`).
  3. Navigate to Canvas (`#nav-canvas`).
  4. Inspect `.canvas-floating-controls`.
- **Observed Behavior:**
  In French, button labels are longer: "Ajuster tout" (71px), "Réinitialiser la vue" (103px), "Organiser" (63px), plus zoom buttons.
  Total HUD width is **377px**. Because `.canvas-floating-controls` has `position: absolute; right: 14px; top: 14px; display: flex; flex-shrink: 0;`, its left boundary sits at `360 - 14 - 377 = -31px`.
  The HUD extends 31px beyond the left edge of the viewport. The zoom-out (`-`) button is pushed completely offscreen and cannot be clicked.
- **Evidence Screenshot:** `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/screenshots/hostile-canvas-360-light-fr.png`
- **Recommended Fix:** In `web/public/theme.css` inside `@media (max-width: 640px)`, wrap the canvas controls or hide/abbreviate text labels (e.g. icon-only or shortened labels on mobile).

---

### Finding 2: Obscura 0.2.6 Optical Checkerboard Rasterization from 0px Radial Stop (Cosmetic Flaw)
- **Severity:** Low / Moderate (Harsh visual presentation in Obscura screenshots)
- **Files & Lines:** `web/public/app.js:2268`
- **Reproduction:**
  Inspect `02-canvas-notes-wires-1280-light-en.png` and `03-canvas-notes-wires-1280-dark-en.png` captured via Obscura 0.2.6 CDP.
- **Observed Behavior:**
  In `web/public/app.js:2268`, the background was set to:
  `radial-gradient(rgba(var(--canvas-dot-rgb, 24, 22, 19), ${alpha}) 0px, rgba(...) ${dotRadius}px, transparent ${dotRadius}px)`
  While standard Chromium rasterizes subtle 1px dots, Obscura 0.2.6's software rasterizer misinterprets the explicit `0px` stop with subpixel radius (`1.14px`), rendering giant, high-contrast black/white polka dots and optical illusion moiré banding across the entire canvas.
- **Evidence Screenshot:** `02-canvas-notes-wires-1280-light-en.png`, `03-canvas-notes-wires-1280-dark-en.png`
- **Recommended Fix:** Restore standard CSS radial syntax or use percentage/fixed sizing compatible with Obscura without producing optical checkerboard artifacts.

---

### Finding 3: Discovery Guard Bypassed on 100% Post-Discovery Issue Fetch Failures (Architectural Edge Case)
- **Severity:** Low Risk (Handled by client warning banner, but distinct from 502 outage)
- **Files & Lines:** `web/server/app.ts:1327-1330`, `web/server/app.ts:1413-1416`
- **Reproduction:**
  Run `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/scripts/verify-failure-modes.mjs` test #4.
- **Observed Behavior:**
  The server's discovery guard in `operationsData` and `archiveData` checks:
  ```typescript
  const discovery = await repositories.view();
  if (discovery.discoveryFailed) {
    throw new DiscoveryUnavailableError();
  }
  ```
  If repository discovery succeeds at startup, but subsequently 100% of repositories fail during task aggregation (e.g. GitHub issues endpoint returns 500 for every repository), `discovery.discoveryFailed` is `false`. Consequently, `/api/combined/operations` does NOT return HTTP 502; it returns **HTTP 200** with `partial: true` and a failure entry for every repository in `failures: [...]`.
  The UI successfully displays the warning banner (`renderWarningBanner`), so no fake "0 issues" clean state is shown. However, callers expecting HTTP 502 on total outage will observe HTTP 200 partial instead.

---

### Finding 4: Documentation Test Count Understated in `proof.md` (Verification Discrepancy)
- **Severity:** Minor Documentation Defect
- **Files & Lines:** `.agents/run/chamberos-board-v2/verifications/A-delivery/proof.md:52`
- **Reproduction:**
  Run `PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/c1f1807-foundation node scripts/audit-a5-packaged.mjs`. Count `verdict: "PASS"`.
- **Observed Behavior:**
  `proof.md` reports:
  `Packaged release browser probe | timeout 180 env PACKAGED_RELEASE_DIR=... node scripts/audit-a5-packaged.mjs | **12 / 12 PASS**`
  In commit `c1f1807`, the builder added assertion #4 (`multi-repo All Projects Operations aggregation`). The script actually outputs **13 PASS** lines. The documentation was not updated to reflect 13 / 13 PASS.

---

### Finding 5: Static PASS Verdict in `generate-delivery-smoke.mjs` (Script Verification Smell)
- **Severity:** Minor Code Quality Defect
- **Files & Lines:** `scripts/generate-delivery-smoke.mjs:391`
- **Observed Behavior:**
  ```javascript
  smokeResults.push({
    name: 'browser diagnostics',
    verdict: 'PASS', // Static literal
    exceptions,
    consoleErrors,
    cspViolations,
  });
  ```
  The script hardcodes `verdict: 'PASS'` instead of dynamically evaluating `verdict: (exceptions.length === 0 && consoleErrors.length === 0 && cspViolations.length === 0) ? 'PASS' : 'FAIL'`. (While the recorded arrays in `smoke.json` are indeed empty `[]`, static verdict emission fails strict adversarial standards).

---

## 3. Hostile Criteria Verification Results

### Criterion 1: All Projects UI Aggregation for Operations and Archive
- **Script:** `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/scripts/verify-all-projects-ui.mjs`
- **Execution Command:**
  ```bash
  node .agents/run/chamberos-board-v2/verifications/A-delivery/hostile/scripts/verify-all-projects-ui.mjs
  ```
- **Results:**
  - Configured `BOARD_REPO=acme/core-engine` with two non-empty repositories (`acme/core-engine` and `acme/edge-service`).
  - **Operations (All Projects):** Loaded `/api/combined/operations`. `statusPerProject` returned data for both `acme/core-engine` and `acme/edge-service`. Blocked tasks correctly aggregated to `3` (core#1 needs-human, core#2 blocked by #1, edge#11 blocked by #10).
  - **Operations Section Retention:** Switched project in UI to `acme/core-engine`. UI remained on Operations view (`state.activeSectionView === 'operations'`, `#operations-view` visible). Blocked tasks filtered to `2`.
  - **Operations Restore All Projects:** Switched back to `All Projects`. UI remained on Operations view. Blocked tasks restored to `3`, and all table rows reappeared.
  - **Archive (All Projects):** Loaded `/api/combined/archive`. Aggregated backburner tasks (2) and closed tasks (2) across both repositories.
  - **Archive Section Retention:** Switched project in UI to `acme/edge-service`. UI remained on Archive view. Tasks filtered to `acme/edge-service` only.
  - **Archive Restore All Projects:** Switched back to `All Projects`. Both repositories' backburner and closed issues restored.
- **Verdict:** **PASS**

---

### Criterion 2: Discovery Failure vs Partial Per-Repo Failure Behavior
- **Script:** `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/scripts/verify-failure-modes.mjs`
- **Execution Command:**
  ```bash
  node .agents/run/chamberos-board-v2/verifications/A-delivery/hostile/scripts/verify-failure-modes.mjs
  ```
- **Results:**
  - **Discovery Outages (401, 403, 500):** Both `/api/combined/operations` and `/api/combined/archive` return HTTP `502 Bad Gateway` with `{"error": "discovery_unavailable"}`. No plausible all-zero success state is ever returned.
  - **Partial Per-Repo Failure (1 failed, 1 good):** Returns HTTP `200 OK` with `partial: true` and `failures: [{ repository: 'owner/repo-fail', message: 'Injected repository failure' }]`. Tasks from `owner/repo-good` remain fully accessible.
  - **Cached Fallback:** When a previously cached repository fails, cached tasks are returned with `partial: true` and `failures: ["... showing cached tasks"]`.
  - **Direct Single-Repo Route Failure:** `/api/repos/:owner/:name/operations` and `/archive` return HTTP 500 on repository failure.
- **Verdict:** **PASS** (with Finding 3 documented).

---

### Criterion 3: Canvas Controls Real Browser Rendering (360 / 768 / 1280, EN/FR, Light/Dark)
- **Script:** `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/scripts/inspect-canvas-and-wires.mjs`
- **Metrics Artifact:** `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile/canvas-measurements.json`
- **Measurements Across Matrix:**
  | Viewport | Lang | Theme | HUD Width | Viewport Width | Overflow Left | Overflow Right | Button Wrap |
  |---|---|---|---|---|---|---|---|
  | 1280 × 900 | EN | Light | 304px | 1050px | No | No | None |
  | 1280 × 900 | EN | Dark | 304px | 1050px | No | No | None |
  | 1280 × 900 | FR | Light | 377px | 1050px | No | No | None |
  | 768 × 900 | EN | Light | 304px | 768px | No | No | None |
  | 768 × 900 | FR | Dark | 377px | 768px | No | No | None |
  | 360 × 800 | EN | Light | 304px | 360px | No | No | None |
  | 360 × 800 | EN | Dark | 304px | 360px | No | No | None |
  | 360 × 800 | FR | Light | 377px | 360px | **YES (-31px)** | No | None |
  | 360 × 800 | FR | Dark | 377px | 360px | **YES (-31px)** | No | None |
- **Button Single-Line Check:**
  All buttons have computed `white-space: nowrap; flex-shrink: 0;`. Button heights are uniform (26px–27px). No multi-line word wrapping occurs ("Arrange" does not break into "Arrang\ne").
- **Verdict:** **FAIL (NEEDS-FIXES)** due to 360px French HUD overflow and Obscura dot grid distortion.

---

### Criterion 4: Wire-Count Smoke Check & Truthful Proof Test Counts
- **DOM Wire Inspection:**
  - DOM query: `document.querySelectorAll(".canvas-wire-group")` = **4**
  - Wire #0: Blocker `owner/repo#1` -> Target `owner/repo#2` (`d="M 351 143 C 381 143, 360 144, 390 144"`)
  - Wire #1: Blocker `owner/repo#1` -> Target `owner/repo#5` (`d="M 351 143 C 486 143, 486 140.5, 621 140.5"`)
  - Wire #2: Blocker `owner/other-repo#10` -> Target `owner/repo#5` (`d="M 101 403 C 35.375 403, 35.375 140.5, 621 140.5"`)
  - Wire #3: Blocker `owner/other-repo#10` -> Target `owner/other-repo#11` (`d="M 101 403 C 41 403, 41 255.5, 621 255.5"`)
  - All 4 wires have valid Bezier curves, `<path class="canvas-wire">`, `<path class="canvas-wire-hit">`, and interactive `<g class="canvas-wire-del-btn">`.
- **Truthful Test Count Verification:**
  - `npm test`: **618 / 618 PASS** (0 fail, 0 skipped, duration 13.3s). Truthful.
  - `node --test web/tests/*.test.mjs`: **574 / 574 PASS** (0 fail, 0 skipped, duration 27.7s). Truthful.
  - `node scripts/audit-a5-data.mjs`: **14 / 14 PASS**. Truthful.
  - `PACKAGED_RELEASE_DIR=... node scripts/audit-a5-packaged.mjs`: **13 / 13 PASS** (Reported as 12 in `proof.md` — see Finding 4).
- **Screenshot Timestamps & Freshness:**
  All 12 screenshots in `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/` were generated fresh between 18:45:12 and 18:45:21 UTC on Nov 6 2026. All SHA-256 hashes match `proof.md`.
- **Verdict:** **PASS** (with Finding 4 and Finding 5 noted).

---

### Criterion 5: Staged Checksums and Production Isolation
- **Staged Artifact Integrity (`/tmp/opencode/board-v2-staging/c1f1807-foundation/`):**
  - Checksum validation command:
    ```bash
    (cd /tmp/opencode/board-v2-staging/c1f1807-foundation && sha256sum -c --strict checksums.sha256)
    ```
  - Result: 13 / 13 files OK.
  - Unlisted files count: 0.
- **Production Isolation Verification:**
  - Production symlink: `/workspace/releases/board/current` -> `/workspace/releases/board/98261a8-20261103` (Untouched, timestamp Nov 3 18:18).
  - Production files: Strict SHA-256 check of `/workspace/releases/board/98261a8-20261103/checksums.sha256` passes 11 / 11 OK.
  - Production state: `/workspace/.openchamber-data/board/` has zero modified files. Last session write was Nov 6 09:52.
  - Production service: Live production port `http://127.0.0.1:8787/health` returns `{"status":"ok","version":"1.2.1","uptime":>7300s}`.
- **Verdict:** **PASS**

---

## 4. Production Read-Only State Comparison

| Path / Target | Staged Foundation Preview | Live Production | Isolation Status |
|---|---|---|---|
| **Port & Host** | `127.0.0.1:4041` | `127.0.0.1:8787` (`board.workflows.ac`) | Strictly isolated |
| **Commit SHA** | `c1f1807` | `98261a8` | Independent builds |
| **Release Directory** | `/tmp/opencode/board-v2-staging/c1f1807-foundation/` | `/workspace/releases/board/98261a8-20261103` | Separate filesystem trees |
| **State Directory** | `/tmp/opencode/board-v2-staging/c1f1807-state/` | `/workspace/.openchamber-data/board/` | Zero state bleed |
| **GitHub Target** | Synthetic mock (`http://127.0.0.1:44149`) | Live GitHub API | No live writes |
| **Process PIDs** | Supervisor: `247563`, Node: `247583` | Production daemon (uptime > 2h) | Disjoint processes |

---

## 5. Unverified Blind Spots (Explicit NOT RUN Declarations)

1. **Live GitHub Writes:** Zero live GitHub mutations (issues, comments, dependencies, status labels) were executed. All tests ran against synthetic fixtures.
2. **External Browser Preview Access:** The preview server is bound to container loopback (`127.0.0.1:4041`). External stakeholder access requires SSH port forwarding (`ssh -L 4041:127.0.0.1:4041 ...`) or reverse proxy ingress.
3. **Live Production Cutover:** No symlink updates (`/workspace/releases/board/current`), process restarts, or production database migrations have been executed.
4. **Human Acceptance:** Human validation of the canvas feel, gesture responsiveness, and aesthetics remains pending.
5. **Real Chromium vs Obscura Rasterizer:** Obscura 0.2.6 was used for headless rendering because real Chrome/Chromium binaries are not installed in the workspace container. Obscura exhibits known CSS subpixel gradient rendering limitations.

---

## 6. Human Click Checklist for Preview (`http://127.0.0.1:4041`)

Attach via SSH tunnel (`ssh -L 4041:127.0.0.1:4041 ...`) and use password `correct horse battery staple`:

1. **Operations All Projects Check:**
   - Click `Operations` in sidebar (`#nav-operations`).
   - Confirm header shows `All Projects` and `BLOCKED: 4`.
   - Confirm table displays both `owner/repo` and `owner/other-repo`.
   - Switch project picker to `owner/repo`. Confirm view stays on Operations, and blocked updates to `3`.
   - Switch back to `All Projects`. Confirm both projects reappear.
2. **Archive All Projects Check:**
   - Click `Archive & Backburner` in sidebar (`#nav-archive`).
   - Confirm both repositories' issues appear under `Backburner` and `Archived (closed)`.
   - Switch project picker to `owner/other-repo`. Confirm view stays on Archive and filters to `owner/other-repo`.
3. **Canvas Wires & Single-Line Buttons:**
   - Click `Canvas` in sidebar (`#nav-canvas`).
   - Verify 4 cubic Bezier dependency wires connect the task cards.
   - Verify floating controls at top-right display "Fit all", "Reset view", "Arrange" without wrapping.
   - Switch language to French (`FR`). On desktop, verify "Ajuster tout", "Réinitialiser la vue", "Organiser".
4. **Presentation Mode:**
   - Click presentation toggle (`#client-toggle-btn`).
   - Verify yellow sticky notes, draft tasks (`#3`), and internal labels disappear.
