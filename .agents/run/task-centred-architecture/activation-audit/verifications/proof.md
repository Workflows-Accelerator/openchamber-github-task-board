# Task Board Extension Independent Activation Audit Proof

**Audit Date:** Fri Oct 30 2026  
**Auditor:** Independent Subagent (Model: `9router/engineer`)  
**Host Runtime:** OpenChamber Web (Port 3000) & Obscura Headless Chromium CDP (Port 9333)  
**Target Extension:** `github-task-board` (v1.2.1)  
**Branch:** `ops/task-board-activation`  
**Base Master SHA:** `ab7516c4a3634c3d69f7b82936ddb7655d327ebb`  
**Saved Feature SHA:** `f485a0a` (Manager HEAD: `1e3a04c94d4caa893728bfaafbdacf5315f55c98`)

---

## 1. Executive Verdicts

| Criterion | Verdict | Summary |
| --- | --- | --- |
| **Spec** | **PASS** | Product tree is 100% byte-identical to `master` (0 bytes diff outside `.agents/run/task-centred-architecture/**`). Feature branch preserved intact. |
| **Quality** | **NEEDS-FIXES** | Live rendering confirms 3 real CSS defects in `master` (`panel/index.html`): unstyled Sort select with white-on-white text, repo picker label clipped on the left, and View button text crowded against border. |
| **Activation** | **VERIFIED** | Host is live, installed, enabled, and serving the authentic `master` bundle (`9d9c2d0`). Service child lifecycle proven to be on-demand, explaining absence of persistent child daemon. |

---

## 2. Git & Source Parity Audit

Commands executed strictly read-only:
- `git diff master...HEAD -- . ':(exclude).agents/run/task-centred-architecture'`: **0 bytes (byte-identical)**
- `git diff master -- . ':(exclude).agents/run/task-centred-architecture'`: **0 bytes (byte-identical)**
- Branch check: `master` at `ab7516c4a3634c3d69f7b82936ddb7655d327ebb` (intact, untouched).
- Feature check: `feat/v2-binding-and-ratelimit` at `1e3a04c94d4caa893728bfaafbdacf5315f55c98` (intact, untouched).
- Untracked files check: `.agents/idle-nontext-state.json` untouched; 25 portfolio worktrees untouched.
- Core Artifact SHA-256 Hashes:
  - `package.json`: `e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee` (matches master)
  - `panel/index.html`: `3b7fc833c06d6ce798c305a9adae81f03f222eafe92c2fd6d1213e0699b09404` (matches master)
  - `panel/main.js`: `9d9c2d04c20e9f282bf6031a1e93f062349b8b27708f96d272d3919fcf203aec` (matches master)
  - `service/main.js`: `a29d18cc1a43c823f304119b9effc8231241cd6e2fd07ab4ee36bc9b2cb30f84` (matches master)

---

## 3. Host Runtime & Service Lifecycle Investigation

### 3.1 Served Bundle Verification
- Frame grant request: `POST http://127.0.0.1:3000/api/guests/github-task-board/frame-grant` (HTTP 200)
- Bundle fetch: `GET http://127.0.0.1:3000/api/guest-files/:grant/panel/main.js` (HTTP 200)
- Served bundle SHA-256: `9d9c2d04c20e9f282bf6031a1e93f062349b8b27708f96d272d3919fcf203aec`
- **Result:** Served bundle matches the disk artifact and master branch exactly. Zero cache staleness.

### 3.2 Service Child Lifecycle Audit
- Host source examination (`/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/service.js`):
  - Guest services in OpenChamber are **not** persistent daemons started on extension enablement (`PUT /api/guests/:id/enabled`).
  - Spawning (`startGuestService`) is triggered solely on-demand by incoming HTTP proxy requests to `POST /api/guests/:id/service/request` via `ensureGuestService()`.
  - When spawned, OpenChamber polls `http://127.0.0.1:${port}/health` with a bearer token.
  - In `github-task-board`, `service/main.ts` is an internal lease reconciler without an HTTP server or `/health` endpoint.
  - Furthermore, `panel/main.js` contains no calls to `serviceRequest`.
- Process inspection (`ps -eo pid,ppid,lstart,args` and `/proc`):
  - No process for `github-task-board` exists.
  - `GET /api/guests/github-task-board/service/status` returns `{"status":"stopped"}`.
  - `chambervoice` service PID 201609 is active (`status: "ready"`).
  - Standalone board server PID 116 (`node web/dist/server.mjs`) is running on port 8787 as an independent process (PPID 78).
- **Hostile Challenge Resolution:** The previous worker's claim of a "recycled extension service" was a misinterpretation of guest metadata enablement; no service child process was started or killed during the toggle. The absence of a child process is the normal, intended state for this extension under the host's on-demand architecture.

---

## 4. Live Visual Toolbar Audit & Defect Classification

Screenshots captured uncropped via Playwright connected to Obscura headless Chromium (`http://127.0.0.1:9333`) at widths 1280px, 980px, and 360px:
- `activation-audit/verifications/screenshots/toolbar-1280.png`
- `activation-audit/verifications/screenshots/toolbar-980.png`
- `activation-audit/verifications/screenshots/toolbar-360.png`

All screenshots contain zero private project or user data (placeholder text only).

### Defect 1: Sort Select White Background & Illegible Text
- **Classification:** **REAL PANEL DEFECT in `master`**
- **Location:** `panel/index.html:3427-3428, 3490`
- **Severity:** Moderate (Visual contrast violation / Accessibility)
- **Empirical Evidence:**
  - `<select id="selectSort" aria-label="Sort tasks">` lacks the `.select-sm` or `.form-ctrl` styling classes applied to all other select elements.
  - Computed styles: `backgroundColor = rgb(255, 255, 255)`, `color = rgb(240, 242, 245)`, `height = 17px`, `padding = 0px`.
  - The select inherits the dark theme's light text color (`var(--fg)`) while the Chromium user-agent default styles render an opaque white background, producing almost invisible white-on-white text ("Priority").

### Defect 2: Project Picker Text Clipped on Left ("ecting re...")
- **Classification:** **REAL PANEL DEFECT in `master`**
- **Location:** `panel/index.html:115-122, 3469-3475`
- **Severity:** Low-to-Moderate (Visual layout bug)
- **Empirical Evidence:**
  - `<span class="repo-label" id="txtRepoLabel">` has `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`.
  - It is placed inside `<button class="repo-btn">`, which inherits `text-align: center` from user-agent button styles.
  - Text-align center centers the text inside the element. When the text ("Detecting repo...") exceeds container width (67px), centering pushes "Det" off the left edge (negative coordinates) while the ellipsis truncates the right edge, rendering `ecting re...`.
  - In addition, `.repo-label` lacks `flex-shrink: 0`, allowing excessive shrinkage even on wide 1280px viewports.

### Defect 3: "View Simple list" Button Crowded Against Border
- **Classification:** **REAL PANEL DEFECT in `master`**
- **Location:** `panel/index.html:3083-3098, 3425, 3504`
- **Severity:** Low / Cosmetic
- **Empirical Evidence:**
  - `.btn-view-select` has natural content width of ~100px (84px inner + 16px horizontal padding).
  - Inside `.toolbar-right`, `.btn-view-select` has default `flex-shrink: 1` with no `min-width`, causing it to shrink down to 87px (`scrollWidth` = 92px > `clientWidth` = 87px).
  - The text "View Simple list" is crowded directly against the right border with the letter 't' touching/clipped.

### Defect 4: Screenshot Crop Artifact (Previous Activation Worker)
- **Classification:** **Crop artifact + underlying text-align defect**
- **Detail:** Previous screenshot `activation/verifications/screenshots/toolbar.png` was cropped starting at x=10-40, slicing off the branch icon. However, uncropped screenshots prove that even without external cropping, the label inside `.repo-btn` still renders as `ecting re...` due to Defect 2.

---

## 5. Read-Only Functional Verification

Exercised live via Playwright over Obscura CDP:
1. **View Switcher:** Clicked `#btnViewSelect`, selected `#viewOptCards` (layout updated to cards, label updated to "Cards"). Clicked `#btnViewSelect`, selected `#viewOptSimple` (layout restored to simple list, label restored to "Simple list").
2. **Sort Selector:** Changed `#selectSort` to `updated`, verified value `updated`, restored cleanly to `priority`.
3. **Filter Popover:** Clicked `#btnFilterToggle` (popover opened, `display: flex`). Clicked `.filter-chip[data-filter="stage:draft"]`, verified selection state, toggled off. Closed filter popover.
4. **Console Monitoring:** **0 console errors, 0 page errors, 0 unhandled promise rejections**. Only expected non-fatal warnings observed (`[TaskBoard] Could not remember view settings: No host frame.`).
5. **Mutation Audit:** 0 tasks created, 0 drafts added, 0 git modifications, 0 agent starts triggered.

---

## 6. Summary Assessment

The OpenChamber host is verifiably running the reviewed task-board extension at 100% master parity. The visual defects observed by the manager are genuine pre-existing defects present in the `master` source code, rather than activation regressions or browser artifacts.
