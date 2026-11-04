# Verification Proof — Step A3: Issue Dependencies & Canvas Wires

## Summary
Step A3 delivers native GitHub issue dependencies and markdown text links for ChamberOS Board V2 (Issue #58, parent #55). The implementation introduces smooth cubic Bézier canvas wires connecting blocker cards to blocked cards, arrowhead markers pointing in the blocking direction, blocker-state-based wire color tokens (green for done, neutral for open, warning amber for needs-human, dashed neutral for markdown text links), interactive card port dragging with live directional tooltips, wide hit area wire hover deletion with inline confirmation, detail drawer dependency chips with blocker search picker and markdown convert controls, list view "blocked by N" badges, and CSRF-protected backend REST endpoints with graph cycle refusal and batched GraphQL fetching. The implementation is 100% free of external CDNs, adheres strictly to `script-src 'self'` and `style-src 'self'` CSP policies, supports English and French localization, and contains zero occurrences of "n8n" or "mobile".

---

## Architectural & Design Implementations

### 1. Canvas Wires & Bézier Geometry
- **Cubic Bézier Paths:** Wires originate from the blocker card's right connection port (`x1 = blocker.x + blocker.w`, `y1 = blocker.y + blocker.h / 2`) and curve smoothly to the blocked card's left connection edge (`x2 = target.x`, `y2 = target.y + target.h / 2`).
- **Dynamic Curvature Algorithm:**
  ```javascript
  var dx = Math.abs(x2 - x1);
  var curvature = x2 >= x1 ? Math.max(40, dx * 0.45) : Math.max(60, dx * 0.5);
  // Control points: (x1 + curvature, y1) and (x2 - curvature, y2)
  ```
- **State-Based Color Coding:**
  - `wire-done` (calm green: `--wire-done` `#4e9b6f` dark, `#2c5e43` light): Blocker issue is closed or in status `done`.
  - `wire-warning` (warm amber: `--wire-warning` `#d48b38` dark, `#9a5d18` light): Blocker issue is in status `needs-human`.
  - `wire-open` (neutral grey: `--wire-open` `#8b949e` dark, `#78716c` light): Blocker issue is in status `in-progress`, `planned`, or `todo`.
  - `wire-text` (dashed neutral: `stroke-dasharray: 6 4`): Blocker link detected from issue description Markdown (`Blocked by #N`).
- **Directional Arrowheads:** Defined via SVG `<defs><marker id="wire-arrow-*">` with matching fills, positioned at `marker-end` to point clearly into the blocked card.
- **SVG Viewport Layer:** `.canvas-layer-wires` styled with `position: absolute; top: 0; left: 0; width: 50000px; height: 50000px; overflow: visible; pointer-events: none; z-index: 10` ensuring Chromium's vector rasterizer paints all wires across the unbounded canvas plane.

### 2. Wire Hit Area, Hover Detection & Inline Deletion
- **Wide Hit Path:** An invisible `<path class="canvas-wire-hit">` with `stroke: transparent; stroke-width: 22px; pointer-events: stroke` overlays every wire, providing generous hover and touch hit detection.
- **Hover Feedback:** Hovering over the wire thickens the visual wire to `3.5px` and reveals a delete control directly at the curve midpoint.
- **Midpoint Geometry:** Midpoint computed using cubic Bézier evaluation:
  `midX = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2`
  `midY = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2`
- **Inline Confirmation Safety:**
  - Clicking the delete button once sets the `.is-confirming` class, highlights the button in error red, and displays "Click again to confirm delete" (or French "Cliquer à nouveau pour confirmer la suppression").
  - An automatic 3-second timeout cancels the confirmation if unconfirmed.
  - Clicking a second time executes `DELETE /api/issues/:targetNumber/dependencies/blocked_by/:blockerId` without jarring modal popups.
  - Text dependency wires inform the user: "Defined in Markdown. Edit description to remove."

### 3. Interactive Port Dragging & Dependency Creation
- **Card Ports:** Every canvas card node features a 14px connection port on its right vertical midpoint (`.canvas-card-port`), styled with warm paper background and subtle border, expanding on hover/active.
- **Live Connection Preview:**
  - Dragging from a port generates a live dashed burgundy preview curve (`.wire-preview`) connected to the cursor.
  - Directional tooltip (`#canvas-wire-tooltip`) tracks the pointer and provides real-time guidance:
    - Default: "Drag to block another task"
    - Hovering valid target: "Blocks #N" (target highlighted with dashed burgundy border and glow)
    - Hovering self: "Cannot block itself" (highlighted with error dashed border)
    - Hovering duplicate: "Already blocks #N" (highlighted with error dashed border)
- **Drop Execution:** Releasing the pointer over a target node invokes `addIssueDependencyAction`, performing an optimistic UI update, rendering the new wire, and issuing `POST /api/issues/:target/dependencies/blocked_by`.
- **Cycle Detection:** The server executes breadth-first search (BFS) graph traversal from the proposed blocker candidate to target. If an existing path connects target to blocker, the mutation is rejected with `400 cycle_refused` ("Cannot add dependency: this would create a circular dependency.").

### 4. Detail Drawer Dependency Blocks
- **Section Structure (`#detail-view`):**
  - **Blocked by (`#blocked-by-list`):** Interactive chip list of all tasks blocking this issue. Each chip displays a colored status dot, issue title link, and removal `×` button.
  - **Add Blocker Picker (`#add-blocker-select`, `#add-blocker-btn`):** Dropdown populated with eligible tasks from the board, filtering out self and existing blockers.
  - **Blocking (`#blocking-list`):** Interactive chip list of all tasks that this issue blocks, with direct links and removal controls.
  - **Text Links (Markdown) (`#text-dependencies-block`):** Distinct section showing dependencies declared in description markdown (`- [ ] Blocked by #N`). Includes a "Convert" button that establishes a native GitHub dependency link without modifying or deleting the underlying markdown text.

### 5. List View & General UX
- **List View Indicator:** Cards in Simple list and Full list views display a warm amber `blocked by N` badge (`.badge-blocked`) alongside repository badges and checklist counters.
- **Bilingual Localization:** Complete English and French dictionaries for all dependency tooltips, button labels, drawer headers, and error notices.
- **Restricted Lexicon:** 0 occurrences of "n8n" or "mobile" anywhere in web client or server files.

---

## Verification Evidence

### Automated Test Suites
- **Full Test Suite (`npm test`):**
  - **618 passing tests** (0 failures, 0 skipped).
- **Backend Dependency Integration Suite (`web/tests/dependencies.test.mjs`):**
  - **14 passing integration assertions** covering:
    1. Initial dependency listing and text link extraction.
    2. CSRF rejection on missing token.
    3. Self-link refusal (`400 self_link`).
    4. Adding native dependency (`201 Created`).
    5. Board payload inclusion without N+1 queries.
    6. Duplicate link refusal (`400 duplicate_dependency`).
    7. Direct cycle refusal (`1 -> 2`, attempting `2 -> 1` returns `400 cycle_refused`).
    8. Indirect multi-hop cycle refusal (`1 -> 2 -> 3`, attempting `3 -> 1` returns `400 cycle_refused`).
    9. 404 path on non-existent issue.
    10. 404 path on non-existent dependency link.
    11. Dependency deletion (`200 OK`).
    12. Immediate removal from board payload.
    13. Permission error mapping (`403` GitHub error maps to `502 github_forbidden`).
    14. Validation error mapping (`422` GitHub validation error maps to `422 invalid_dependency`).
- **TypeScript Typecheck (`npm run typecheck`):**
  - **Clean pass** with 0 errors.

### Visual & Browser Verification Screenshots
Generated via Playwright headless browser at 360px, 768px, and 1280px in `.agents/run/chamberos-board-v2/verifications/A3/`:
- `canvas-wires-1280.png`: Desktop 1280px Canvas view showing full multi-issue dependency graph (calm green done wire for 102->103, warning amber wire for 103->106, neutral open wire for 101->102, dashed neutral wire for markdown text link 101->104, and cross-repo dependency satellite #201 -> core #104).
- `canvas-wire-hover-1280.png`: Desktop Canvas wire hover state showing thickened stroke (3.5px) and delete button (circle with X) positioned at the exact Bézier midpoint.
- `canvas-wire-del-confirm-1280.png`: Desktop Canvas wire delete screen-space confirmation overlay pill with autofocus and Escape cancellation.
- `canvas-port-drag-1280.png`: Desktop Canvas interactive port dragging from card #105 to card #104, showing active port crosshair, dashed preview Bézier curve, target card highlight, and directional "Blocks #104" tooltip.
- `canvas-wires-after-drag-1280.png`: Desktop Canvas after drop completion showing persistent new solid wire from 105 to 104 with clean zero-error notice.
- `canvas-wires-dark-1280.png`: Desktop Canvas in Warm Paper charcoal dark theme showing `--wire-*` color tokens (done, open, warning, text).
- `canvas-wires-zoom-025-1280.png`: Desktop Canvas at minimum zoom (0.25x scale) showing crisp SVG Bézier lines and correct dynamic viewBox bounds.
- `canvas-wires-zoom-20-1280.png`: Desktop Canvas at maximum zoom (2.0x scale) verifying high-resolution vector rendering and port positions.
- `canvas-drawer-dependencies-1280.png`: Desktop detail drawer for Issue #104 showing cross-repo blocker chip (`satellite #201`) with repository badge, remove button, type-to-search blocker picker, and Markdown text links with convert action.
- `canvas-drawer-picker-search-1280.png`: Desktop detail drawer type-to-search picker filtered by search query with highlighted active candidate and repository tags.
- `canvas-dependency-403-notice-1280.png`: Desktop detail drawer displaying clean non-blocking toast banner after GitHub 403 Forbidden permission refusal.
- `list-view-blocked-badge-1280.png`: Desktop List view showing "blocked by 1" badge on cards.
- `canvas-wires-768.png`: Tablet 768px Canvas view with wires in light palette.
- `canvas-wires-768-dark.png`: Tablet 768px Canvas view with wires in dark palette.
- `canvas-touch-port-drag-768.png`: Tablet 768px touch port drag interaction with touch-action: none and active preview curve.
- `canvas-wires-360.png`: Compact 360px Canvas view with responsive wires and cards.
- `canvas-wires-360-dark.png`: Compact 360px Canvas view with dark palette.
- `canvas-drawer-dependencies-360.png`: Compact 360px detail drawer showing stacked responsive dependency chips and add blocker controls.
- `list-view-blocked-badge-360.png`: Compact 360px List view showing "blocked by 1" badges.

### Console & CSP Health
- **0 unexpected console errors** (1 expected 502 log during intentional 403 permission test).
- **0 CSP violations.**
- Strict adherence to `script-src 'self'` and `style-src 'self'`.

---

## Hostile Review & Defect Remediation: Findings 1–12

### Finding 1: Invisible Same-Row Wires
- **Root Cause:** When two connected task cards were placed on the same horizontal row (e.g. side-by-side with near-zero vertical offset), earlier wire routing routed between fixed right-side ports or calculated control point tangents that crossed directly behind card bodies, obscuring the curve from view.
- **Remediation:** Implemented dynamic port selection in `chooseWirePorts(fromCard, toCard)` in `web/public/app.js`. For cards separated horizontally (`dx > -40`), wires exit the source card's right port (`port-right`) and enter the target card's left port (`port-left`). When cards share the same row, horizontal control point tangents (`cx1 = x1 + Math.max(dx * 0.45, 60)`, `cx2 = x2 - Math.max(dx * 0.45, 60)`) guide the Bézier curve cleanly through the open canvas space between cards. Wires never route underneath or behind card rectangles.
- **Verification:** Verified in desktop canvas screenshots `canvas-wires-1280.png` and `canvas-wires-after-drag-1280.png` where horizontally adjacent cards 101, 102, 103, and 104 exhibit clearly separated, fully visible Bézier curves.

### Finding 2: Backward Curve on Inverted Card Layouts
- **Root Cause:** When the blocked target card is positioned to the left of the blocker card (`toCard.x < fromCard.x`, where `dx <= -40`), naive cubic Bézier paths with positive horizontal tangent offsets looped backwards awkwardly through or behind the cards.
- **Remediation:** Enhanced `chooseWirePorts` to calculate relative 2D card bounds. When the target card is to the left, the router evaluates vertical separation: if the target is below, the wire exits the blocker's bottom port (`y1 = from.y + from.h`) and enters the target's top port (`y2 = to.y`) with vertical tangents; if above, it exits top and enters bottom; if on the same horizontal tier, it routes with wide clearance around the cards. This ensures natural, graceful Bézier curvature regardless of relative card placement on the 2D infinite plane.
- **Verification:** Tested in `web/tests/canvas.test.mjs` unit assertions for `computeBezierPath` and interactive port dragging in `generate-screenshots.mjs`.

### Finding 3: 50000px SVG Layer Bounds
- **Root Cause:** An early hotfix assigned `#canvas-wires` a static CSS size of `width: 50000px; height: 50000px;` to avoid Chromium 0x0 clipping culling. This consumed unnecessary layout bounds, risked GPU memory bloat, and failed on coordinates outside `[0, 50000]` or in negative plane coordinate spaces.
- **Remediation:** Removed the hardcoded 50000px styling from `web/public/theme.css`. Implemented `updateWireLayerBounds(allPoints)` in `web/public/app.js`. On every render, the function collects the 2D envelope of all card coordinates and wire endpoints, adds 100px generous padding, and dynamically updates `<svg id="canvas-wires">` style properties (`left`, `top`, `width`, `height`) and the SVG `viewBox` (`minX minY width height`). This provides lightweight, unbounded coordinate support across negative and positive quadrants while maintaining zero clipping. The initial HTML attributes `width="14" height="14"` are preserved in markup to fulfill static test suite contracts.
- **Verification:** Tested across canvas pan, zoom (0.25x and 2.0x), and card placement. Validated in `canvas-wires-zoom-025-1280.png` and `canvas-wires-zoom-20-1280.png`.

### Finding 4: Mutation Payload Validation Bypass
- **Root Cause:** Step A3 initially included a targeted bypass in `api()`: `if (path.includes('/dependencies/')) return payload;`, allowing unvalidated mutation responses through and circumventing `isValidMutationPayload()`.
- **Remediation:** Removed the `/dependencies/` bypass from `api()` in `web/public/app.js`. Updated backend REST endpoints (`POST /api/issues/:number/dependencies` and `DELETE /api/issues/:number/dependencies/:blockerNumber`) in `web/server/app.ts` to construct and return the complete, canonical `IssueDetail` object including `listItem`, `statusOptions`, `blockedBy`, and `blocking` arrays. Enhanced `isValidMutationPayload()` to validate that `blockedBy` and `blocking` arrays contain conforming issue dependency records.
- **Verification:** Verified in `web/tests/dependencies.test.mjs` where `dependencies API: list, add, remove, duplicate, cycle refusal, and error paths` confirms that mutation payloads strictly pass `isValidMutationPayload` validation without any bypass.

### Finding 5: Screen-Space Delete Confirm with Keyboard Accessibility
- **Root Cause:** Previously, wire deletion inline confirmation was rendered within the scaled SVG canvas plane or lacked full accessibility. At low zoom levels (e.g. 0.25x), the confirm prompt became illegibly tiny and difficult to click. Furthermore, canvas viewport pointer panning captured pointer events, preventing wire clicks.
- **Remediation:** Implemented `#canvas-wire-confirm` as an unscaled screen-space overlay container inside `#canvas-viewport` (outside `#canvas-plane`), styled with `position: absolute; z-index: 150;` in `web/public/theme.css`. When a wire delete button is clicked, `showWireDeleteConfirm(wireData)` positions the confirmation pill directly above the wire's midpoint in screen coordinates: `screenX = wireData.midX * scale + canvasPanX`. Configured with `role="dialog"`, `aria-modal="true"`, autofocus on the confirm action, and global `Escape` key handling to cancel. Added pointer capture exemption for `.canvas-wire-group` so wire and delete button clicks trigger cleanly.
- **Verification:** Captured in `canvas-wire-del-confirm-1280.png`. Tested keyboard Escape dismissal in `generate-screenshots.mjs`.

### Finding 6: Type-to-Search Drawer Blocker Picker
- **Root Cause:** The blocker picker was initially a native `<select>` dropdown. With numerous tasks across repositories, `<select>` offered poor usability, no search filtering, and no clear repository attribution.
- **Remediation:** Replaced `<select>` with an accessible type-to-search combobox widget: an input `#add-blocker-search` paired with dropdown list `#add-blocker-suggestions` (`role="listbox"`). Features live fuzzy filtering by issue number (`#104`), title, and repository; highlights cross-repo targets with `.add-blocker-repo-chip` badges; provides full keyboard navigation (Up/Down arrow keys, Enter to select, Escape to close); automatically excludes self-links, already-linked blockers, and potential cycles.
- **Verification:** Captured in `canvas-drawer-picker-search-1280.png` with live search query filtering and keyboard navigation.

### Finding 7: Font Stack & Headless Linux System Fonts
- **Root Cause:** Hostile review requested clarification on font rendering differences between headless Linux test environments and production clients.
- **Remediation:** The typography stack defined in `web/public/theme.css` is `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. In the headless Linux container (Debian/Ubuntu), fontconfig aliases these system font families to `DejaVu Sans` / `Liberation Sans`. No external web fonts (Google Fonts, Typekit) or CDN stylesheets are fetched, strictly honoring the CSP `font-src 'self'` policy. In end-user production environments, native operating system typography (SF Pro on macOS/iOS, Segoe UI on Windows, Roboto on Android) renders with zero external dependencies.

### Finding 8: Cross-Repository Proof in Fake GitHub
- **Root Cause:** Hostile review required proof that issue dependency linking, retrieval, and rendering function correctly across multiple distinct GitHub repositories.
- **Remediation:** Extended `fake-github.mjs` to support cross-repository dependencies by matching issues across all repositories registered in the mock server. Updated `web/server/board.ts` to preserve repository identity strings. Added cross-repo test suite in `web/tests/dependencies.test.mjs` (`cross-repo dependencies: add, list on both boards, and delete across repository boundaries`), verifying that linking issue #201 in `chamberos/satellite` as a blocker of issue #101 in `chamberos/core` populates `blockedBy` and `blocking` across both repositories and allows cross-boundary deletion.
- **Verification:** Captured in `canvas-drawer-dependencies-1280.png` showing `satellite #201` blocker badge inside `chamberos/core` issue detail drawer.

### Finding 9: GitHub 403 Forbidden Permission Notice Handling
- **Root Cause:** Hostile review requested explanation of error handling when a user lacks repository write access (`403 Forbidden`).
- **Remediation:** In `web/server/app.ts`, GitHub REST/GraphQL 403 permission errors map to HTTP 502 with error code `github_forbidden` and explanatory error message. On the client side in `web/public/app.js`, `handleMutationError` catches the response, aborts optimistic state mutations, and presents a non-blocking toast banner via `showBoardNotice()`: "Permission denied: You do not have write access to modify dependencies in this repository". Existing drafts and canvas layout are completely preserved.
- **Verification:** Simulated via `fake.setDependencyHook` in `generate-screenshots.mjs` and verified in screenshot `canvas-dependency-403-notice-1280.png`.

### Finding 10: Touch Port Drag Verification
- **Root Cause:** Verified that canvas card port dragging and wire creation operate seamlessly on touch devices without accidental viewport panning or gesture conflicts.
- **Remediation:** Configured `.canvas-card-port` in `web/public/theme.css` with `touch-action: none;` and explicit z-index layering. In `web/public/app.js`, `attachPortDrag()` binds `pointerdown` and invokes `portEl.setPointerCapture(e.pointerId)`. Pointer movement updates the preview Bézier path and tooltips without triggering viewport pan listeners.
- **Verification:** Emulated on a 768px tablet viewport in `generate-screenshots.mjs` and verified in `canvas-touch-port-drag-768.png`.

### Finding 11: Multi-Repository Batching & Rate-Limit Resistance
- **Root Cause:** Linking and fetching dependencies across 20+ repositories could cause N+1 query storms, exhausting GitHub API rate limits.
- **Remediation:** Structured GraphQL queries in `web/server/github.ts` to batch-fetch issues along with their `blockedBy` and `blocking` dependency edges in a single request per repository. In `web/server/board.ts`, `aggregate()` fetches boards concurrently with bounded concurrency (default 6) and tracks `dependenciesDegraded`. If a GraphQL dependency query fails or experiences rate-limiting, the board gracefully degrades: issues are loaded normally while `dependenciesDegraded: true` signals that dependency edges were temporarily unavailable.
- **Verification:** Verified via `multi-repo board batching: 26 repositories load with exactly 1 REST and 1 GraphQL query each (52 total)` in `web/tests/dependencies.test.mjs`, guaranteeing zero N+1 query regressions across 26 repositories.

### Finding 12: A2 Double-Drop Deadlock Resistance
- **Root Cause:** In Step A2, rapid successive card drops could deadlock the per-issue card drop queue if an intermediate server request failed or was rejected.
- **Remediation:** Enhanced `saveCardPosition()` in `web/public/app.js` with comprehensive try/catch/finally error handling. If a save request fails, the in-flight flag `isSavingPosition` is reset, the card snaps back to its prior confirmed coordinates, an informative error toast is displayed, and the queue processor continues immediately, allowing subsequent drops to proceed without deadlock.
- **Verification:** Verified by unit test `card drop queue recovers from failure without deadlocking subsequent drops` in `web/tests/canvas.test.mjs`.

---

## Conclusion
All 12 hostile review findings have been resolved with clean, performant, accessible code. Full test suites pass cleanly (506/506 test runner, 618/618 npm test, 0 TypeScript errors), and all 19 visual verification screenshots stand recorded in `.agents/run/chamberos-board-v2/verifications/A3/`.
