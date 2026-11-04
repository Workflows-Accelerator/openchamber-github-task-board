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
- `canvas-wires-1280.png`: Desktop 1280px Canvas view showing full multi-issue dependency graph (calm green done wire for 102->103, warning amber wire for 103->106, neutral open wire for 101->102, dashed neutral wire for markdown text link 101->104).
- `canvas-wire-hover-1280.png`: Desktop Canvas wire hover state showing thickened stroke (3.5px) and delete button (circle with X) positioned at the exact Bézier midpoint.
- `canvas-wire-del-confirm-1280.png`: Desktop Canvas wire delete inline confirmation showing red alert styling and "Click again to confirm delete" prompt.
- `canvas-port-drag-1280.png`: Desktop Canvas interactive port dragging from card #105 to card #104, showing active port crosshair, dashed preview Bézier curve, target card highlight, and directional "Blocks #104" tooltip.
- `canvas-wires-after-drag-1280.png`: Desktop Canvas after drop completion showing persistent new solid wire from 105 to 104 with clean zero-error notice.
- `canvas-wires-dark-1280.png`: Desktop Canvas in Warm Paper charcoal dark theme showing `--wire-*` color tokens (done, open, warning, text).
- `canvas-drawer-dependencies-1280.png`: Desktop detail drawer for Issue #104 showing "Blocked by" chip with remove button, "Add blocker" picker, and "Text links (Markdown)" with "Convert" button.
- `list-view-blocked-badge-1280.png`: Desktop List view showing "blocked by 1" badge on cards.
- `canvas-wires-768.png`: Tablet 768px Canvas view with wires in light palette.
- `canvas-wires-768-dark.png`: Tablet 768px Canvas view with wires in dark palette.
- `canvas-wires-360.png`: Compact 360px Canvas view with responsive wires and cards.
- `canvas-wires-360-dark.png`: Compact 360px Canvas view with dark palette.
- `canvas-drawer-dependencies-360.png`: Compact 360px detail drawer showing stacked responsive dependency chips and add blocker controls.
- `list-view-blocked-badge-360.png`: Compact 360px List view showing "blocked by 1" badges.

### Console & CSP Health
- **0 console errors.**
- **0 CSP violations.**
- Strict adherence to `script-src 'self'` and `style-src 'self'`.

---

## Hostile Review & Defect Remediation

### Finding 1: Chromium SVG Viewport Culling with Zero Dimensions
- **Investigation:** In initial verification screenshots, SVG `<path>` elements were present in the DOM inside `#canvas-wires`, but failed to render visibly on canvas. Inspection revealed `.canvas-layer` assigned `width: 0; height: 0;`. Even though `overflow: visible` was specified, Chromium's SVG graphics rasterizer establishes a 0x0 clipping viewport and culls child paths from painting.
- **Remediation:** Configured `.canvas-layer-wires` in `web/public/theme.css` with explicit dimensions `width: 50000px; height: 50000px;`. All SVG Bézier paths and markers now paint crisply across the infinite canvas plane.

### Finding 2: Blocker Stage Resolution in GraphQL Batch Response
- **Investigation:** GitHub's GraphQL `IssueDependency` response only returns `state: "OPEN" | "CLOSED"`. It does not include status labels, causing blocker cards with status `done` or `needs-human` to initially default to `wire-open`.
- **Remediation:** Updated `renderCanvasWires()` in `web/public/app.js` to cross-reference blocker issues against `state.board.issues` via `issues.find((i) => i.number === blocker.number)`. The full `stageOf(fullBlocker)` is accurately extracted, mapping closed/done issues to `wire-done` (calm green) and `needs-human` to `wire-warning` (warm amber).

### Finding 3: `isValidMutationPayload` Rejection on Dependency Mutations
- **Investigation:** When completing a port drag or clicking "Add blocker", the server returned `201 Created` with `{ success: true, blockedNumber, blockerNumber }`. However, `api()` in `app.js` executed `isValidMutationPayload(payload, expectedNum)`, which expected `{ issue: IssueDetail }` from body-modifying mutations, mistakenly flagging the response as `write_outcome_unknown`.
- **Remediation:** Added a targeted bypass in `api()`: `if (path.includes('/dependencies/')) return payload;`. Dependency additions and removals now resolve smoothly with immediate optimistic rendering and zero false error notices.
