# Verification Proof — Step A2: Infinite Canvas View & Coordinate Persistence

## Summary
Step A2 delivers the infinite Canvas view for ChamberOS Board V2 (Issue #57, parent #55). The implementation introduces an infinite, non-clustering dot grid canvas plane with 4 ordered layers, full pan and zoom navigation, 250px V1 Linear-style node cards, hidden comment coordinate persistence via `PUT /api/issues/:n/canvas`, and seamless detail drawer integration. The implementation is 100% free of external CDNs, adheres strictly to `script-src 'self'` and `style-src 'self'` CSP policies, supports English and French localization, and contains zero occurrences of "n8n" or "mobile".

---

## Architectural & Design Implementations

### 1. Infinite Canvas Plane & 4-Layer Hierarchy
- **Canvas Viewport (`#canvas-viewport`):** Full-bleed workspace embedded inside `#board-view.mode-canvas` with hardware-accelerated pan and zoom transforms on `#canvas-plane`.
- **4 Strict Ordered Layers:**
  1. `wires` (`#canvas-wires`, `.canvas-layer-wires`, `z-index: 10`): SVG overlay for future dependency and workflow connection lines.
  2. `notes` (`#canvas-notes`, `.canvas-layer-notes`, `z-index: 20`): Container for freeform canvas notes.
  3. `cards` (`#canvas-cards`, `.canvas-layer-cards`, `z-index: 30`): Real issue node cards with pointer events and keyboard navigation.
  4. `overlay` (`#canvas-overlay`, `.canvas-layer-overlay`, `z-index: 40`): Non-blocking canvas overlay layer.
- **Unbounded Coordinates:** Plane has `width: 0; height: 0; position: absolute;` allowing unbounded spatial positioning in any direction.

### 2. Non-Clustering Dot Grid Scaling
- **Mathematical Specification:**
  - Grid pitch: `24px * scale`.
  - Dot radius: `Math.max(0.35, 1.25 * scale)` keeping dots fine and crisp without visual clustering at extreme zoom levels.
  - Dot opacity fading: Full opacity (0.35 in light, 0.28 in dark) for `scale >= 0.55`; smoothly fades between `0.55` and `0.40` down to `0` opacity at `scale <= 0.40`.
  - Synchronized Pan: Canvas dot background positions pan dynamically (`panX % pitch`, `panY % pitch`) matching plane movement seamlessly.
  - Semantic Color Tokens: `--canvas-dot-rgb: 24, 22, 19` (light mode) and `--canvas-dot-rgb: 244, 241, 234` (dark mode).

### 3. Pan, Zoom & Touch Physics
- **Zoom Range:** Clamped between `0.2` and `2.5`.
- **Focal Zoom:** Zooming via wheel or pinch centers smoothly around cursor/focal point:
  `newPanX = clientX - (clientX - panX) * (newScale / oldScale)`.
- **Floating Controls (`#canvas-controls`, `z-index: 50`):**
  - Zoom Out (`-`): Decrements zoom by 0.15 step.
  - Zoom Readout (`100%`): Displays current zoom percentage; click resets zoom to 1.0.
  - Zoom In (`+`): Increments zoom by 0.15 step.
  - Fit All: Dynamically computes bounding envelope of all cards and smoothly centers/scales them with comfortable padding.
  - Reset: Resets pan to `(60, 60)` and zoom to `1.0`.
- **Pan Navigation:**
  - Mouse/Trackpad: Drag background or scroll wheel to pan.
  - Touch: Single finger pan and dual finger pinch-to-zoom.
  - Keyboard: `+`/`=` to zoom in, `-` to zoom out, `0` to reset zoom to 100%.
- **View State Persistence:** Last canvas pan and zoom scale saved to browser `localStorage` (`tb_canvas_view_state`).

### 4. 250px V1 Issue Node Cards & Drawer Integration
- **Node Card Styling:**
  - Fixed 250px width matching V1 Linear/Atelier design aesthetic.
  - Header with repository color dot, short name, and issue number.
  - Stage status chip (`planned`, `in-progress`, `done`, `needs-human`).
  - Friendly title with 2-line clamp and technical subtitle.
  - Meta footer showing priority badge and checklist counts.
- **Unpositioned Layout:** Tasks without saved canvas coordinates are placed to the right of all positioned cards in organized grid columns without triggering auto-saves.
- **Drag-and-Drop Drop Persistence:**
  - Pointer capture with 4px threshold differentiating clicks from drags.
  - Card positions update optimistically on drop and persist via `PUT /api/issues/:n/canvas` (or `/api/repos/:owner/:repo/issues/:n/canvas`).
  - Reverts to previous position with alert notice on mutation failure.
- **Click to Detail Drawer:** Clicking any card opens the identical task detail drawer as List view, with drawer backdrop and full edit capabilities.

### 5. Hidden Comment Marker Format
- **Marker Syntax:** `<!-- board-canvas: {"x":420,"y":280} -->`.
- **Integrity Rules:**
  - Ignores code fences (backticks and tildes) and indented blocks.
  - Preserves unknown JSON keys (e.g., future notes, colors, dimensions).
  - Preserves CRLF line endings, hard break spaces, and existing `board-order` markers.
  - Stripped cleanly from human markdown previews, summaries, and title extraction.
  - Server endpoints use optimistic locking with ETag / fingerprint verification.

---

## Verification Evidence

### Automated Test Suites
- **Full Test Suite (`npm test`):**
  - **618 passing tests** (0 failures, 0 skipped).
- **Web Test Suite (`node --test web/tests/*.test.mjs`):**
  - **479 passing tests** (0 failures, 0 skipped).
  - `web/tests/canvas.test.mjs` (13 tests):
    - Marker parsing, stripping, and CRLF preservation.
    - Code fence and indented block safety.
    - Endpoint verification with ETag concurrency and 502 upstream error handling.
    - Viewport, controls, and 4-layer ordering assertions in `index.html`.
    - CSS token, z-index, and 250px card width assertions in `theme.css`.
    - Zero occurrences of "n8n" or "mobile" in web source files.
    - English and French localization dictionary assertions.
    - Non-clustering dot grid mathematical logic.
- **TypeScript Typecheck (`npm run typecheck`):**
  - **Clean pass** with 0 errors.

### Visual & Browser Verification Screenshots
Generated via Playwright headless browser at 360px, 768px, and 1280px in `.agents/run/chamberos-board-v2/verifications/A2/`:
- `canvas-1280.png`: Desktop 1280px Canvas view with dot grid, floating zoom controls, and 250px cards (Light palette).
- `canvas-1280-dark.png`: Desktop 1280px Canvas view in warm paper charcoal dark palette.
- `canvas-1280-zoom-025.png`: Desktop Canvas zoomed out to 0.25 proving non-clustering dot grid scaling and fading.
- `canvas-1280-zoom-200.png`: Desktop Canvas zoomed in to 2.0 showing clear typography and scaled dot grid.
- `canvas-1280-fr.png`: Desktop Canvas view in French localization ("Canevas", "Ajuster tout", "Réinitialiser").
- `canvas-card-dragged.png`: Card drag-and-drop verification showing successful `PUT /api/issues/:n/canvas` persistence.
- `canvas-drawer-1280.png`: Task detail drawer opened by clicking canvas card #101.
- `canvas-768.png`: Tablet 768px portrait Canvas view.
- `canvas-768-dark.png`: Tablet 768px Canvas view in dark palette.
- `canvas-360.png`: Compact 360px Canvas view with responsive toolbar.
- `canvas-360-dark.png`: Compact 360px Canvas view in dark palette.
- `canvas-360-touch.png`: Compact 360px Canvas after simulated touch pan gesture.

### Console & CSP Health
- **0 console errors.**
- **0 CSP violations.**
- All styles set via direct CSSOM properties (`card.style.left`, `card.style.top`, `card.style.transform`) to strictly comply with `style-src 'self'`.
