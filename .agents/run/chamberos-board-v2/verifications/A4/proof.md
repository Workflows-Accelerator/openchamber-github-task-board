# Verification Proof — Step A4: Canvas Markdown Notes & Auto-Layout Arrange Engine

## Summary
Step A4 delivers attached Markdown notes on the canvas under cards and a pure auto-layout Arrange engine for ChamberOS Board V2 (Issue #59, parent #55). The implementation introduces:
1. **Attached Markdown Notes:** Stored directly inside the issue body's `<!-- board-canvas: ... -->` marker, rendered in a dedicated `#canvas-notes` DOM layer (`z-index: 20`, below cards at `z-index: 30` and above wires at `z-index: 10`), connected to their parent card via subtle connector lines.
2. **Safe Standalone Markdown Parser (`web/public/markdown.js`):** Pure ESM module with zero external dependencies, strict HTML character escaping, protocol filtering allowing only safe schemes (`http:`, `https:`, `mailto:`), full support for headings (`H1`–`H6`), bold/italic formatting, inline and fenced code blocks, task lists, and unordered/ordered lists, with a hard 4,000-character note cap.
3. **Muted V1 Theme Color Palettes:** Sticky notes feature 5 muted warm tones (`yellow`, `pink`, `blue`, `green`, `purple`) with bespoke dark-mode tokens, color swatch picker, drag handle, bottom-right resize handle, inline delete confirmation across the header, character counter, and double-click or keyboard edit modes.
4. **Pure Auto-Layout Arrange Engine (`web/public/arrange.js`):** Pure deterministic function that partitions cards by project into horizontal bands stacked vertically, computes DAG topological ranks via longest path from roots over blocker edges, performs two-pass barycenter crossing reduction, and guarantees zero overlaps by construction.
5. **Interactive Arrange Execution & Batch Save:** Screen-space confirmation modal defaulting to "Only cards without a saved place", live progress bar with batch save queue, error summary, undo capability while the page remains open, and notes moving atomically alongside their parent card. No automatic movements occur on page load, poll, or filter change.
6. **Carry-Over Nit Resolution from Step A3:** Cross-repo drawer dependency chips display the repository name once only without duplicate prefixing.
7. **Production Quality & Constraints:** Zero emojis, zero occurrences of "n8n", strict adherence to `script-src 'self'` and `style-src 'self'` CSP policies, full responsive layout across 360px, 768px, and 1280px viewports, and 100% passing test suites.

---

## Architectural & Design Implementations

### 1. Canvas Notes Data Model & Marker Persistence
- **Storage Location:** Notes are attached directly to issues and serialized in the `notes` property of the existing `<!-- board-canvas: ... -->` HTML comment marker in the GitHub issue body:
  ```json
  <!-- board-canvas: {"x":80,"y":80,"notes":[{"id":"note-1","text":"Acceptance Plan...","color":"yellow","x":80,"y":270,"w":240,"h":175}]} -->
  ```
- **Schema & Validation:**
  - `id`: Non-empty string identifier (e.g. `note-<timestamp>-<rand>`).
  - `text`: Markdown content string, strictly capped at 4,000 characters.
  - `color`: One of `['yellow', 'pink', 'blue', 'green', 'purple']` (default: `'yellow'`).
  - `x`, `y`: Finite numeric canvas plane coordinates.
  - `w`, `h`: Finite numeric dimensions (defaults: `w = 220`, `h = 130`).
- **Body Limit Guard:** Total issue body length is strictly guarded against GitHub's 65,536-character limit. If an edit would exceed this cap, the backend returns `400 body_too_long` with clear user feedback.
- **Unified Save Queue:** Client-side mutations share the `cardSaveQueues` promise chain per issue, guaranteeing serial execution, preventing false 409 conflict errors, and preserving unknown marker keys and coordinates.

### 2. Canvas DOM Layering & Geometry
- **Z-Index Stacking Order:**
  - `z-index: 10`: `#canvas-wires` (SVG dependency curves and arrowheads)
  - `z-index: 20`: `#canvas-notes` (HTML sticky notes layer)
  - `z-index: 30`: `#canvas-cards` (HTML issue cards layer)
  - `z-index: 40`: `#canvas-overlay` (drag previews and live tooltips)
  - `z-index: 50`: `#canvas-controls` (floating zoom and arrange toolbar)
  - `z-index: 100`: `#canvas-wire-confirm` and `#canvas-arrange-dialog` (unscaled screen-space modal dialogs)
- **Subtle Connector Lines:** Each note is connected to its parent card via an SVG `<line class="canvas-note-connector">` rendered inside `#canvas-wires`, dynamically updated during note dragging, card dragging, and auto-layout.
- **Relative Movement:** When an issue card is moved (either via dragging or via the Arrange engine), attached notes shift by the exact same delta `(dx, dy)` so spatial groupings remain preserved.

### 3. Standalone Safe Markdown Parser (`web/public/markdown.js`)
- **Zero External Dependencies:** Built completely in pure modern JavaScript without third-party libraries or CDNs.
- **Strict Sanitization:**
  - `escapeHtml`: All raw text is strictly escaped (`&`, `<`, `>`, `"`, `'`) before parsing.
  - Safe Link Protocols: Only `http:`, `https:`, and `mailto:` URLs are rendered as `<a>` tags with `target="_blank" rel="noopener noreferrer"`. Dangerous protocols (`javascript:`, `data:`, `vbscript:`) are rejected and rendered as inert plain text.
- **Supported Markdown Constructs:**
  - Headings `H1` through `H6` (`#` through `######`).
  - Bold (`**` or `__`) and Italic (`*` or `_`), including nested emphasis.
  - Inline code (`` `code` ``) and multi-line fenced code blocks (`` ```ts ... ``` ``) with syntax language tags.
  - Unordered lists (`-` or `*`) and Ordered lists (`1.`).
  - Task lists with interactive display checkboxes (`- [ ]` and `- [x]`).
  - Hard line breaks and paragraph grouping.

### 4. Sticky Note UI & Muted V1 Color Tokens
- **Color Palettes:**
  - `yellow`: Light `#fbf5df`, Dark `#2e2716` (accent `#8c6b12`)
  - `pink`: Light `#f7ecee`, Dark `#2d1a1e` (accent `#9c3b4d`)
  - `blue`: Light `#e8f0fe`, Dark `#192738` (accent `#2a6cb8`)
  - `green`: Light `#e6f4ea`, Dark `#182c1f` (accent `#2e854b`)
  - `purple`: Light `#f1eafd`, Dark `#251c33` (accent `#7c4bb5`)
- **Interactive Controls:**
  - **Color Swatches:** 5 circular swatch buttons in the note header for instant palette switching.
  - **Edit Mode:** Triggered via double-click on note body or clicking the "Edit" button. Displays a responsive `<textarea>` with a live `N / 4000` counter.
  - **Keyboard Shortcuts:** `Ctrl+Enter` or `Meta+Enter` saves; `Escape` cancels and restores previous text.
  - **Inline Delete Confirmation:** Clicking `×` toggles the header to display "Delete note? Remove Cancel", hiding the metadata badge and control buttons to prevent crowding.
  - **Resize Handle:** Native bottom-right drag handle (`.canvas-note-resize-handle`) updating `w` and `h` with `min-width: 160px` and `min-height: 90px`.
  - **Detail Drawer Entry:** "+ Note" button added in the issue detail drawer header (`#drawer-add-note-btn`), allowing note creation directly from task inspection.

### 5. Pure Auto-Layout Arrange Engine (`web/public/arrange.js`)
- **Pure Function Signature:**
  ```typescript
  arrangeCards(cards: Array<CardInput>, options?: ArrangeOptions): ArrangeResult
  ```
- **Project Banding:** Cards are grouped by project repository into horizontal bands stacked vertically. Each band is rendered with a clean uppercase label (`.canvas-project-band-label`) with a subtle divider line.
- **Topological DAG Ranking:**
  - Edge direction: blocker -> blocked.
  - Rank calculation: longest directed path from root nodes within the band. Root tasks (no internal blockers) occupy Column 0 (Rank 0); blocked tasks advance to `max(blockerRank) + 1`.
  - Deterministic Cycle Breaking: Tarjan's strongly connected components (SCC) algorithm or depth-first search cycle detection removes back-edges deterministically using alphanumeric ID ordering.
- **Barycenter Crossing Reduction:**
  - Forward sweep: orders nodes in column `c` by the average row position of their blockers in column `c - 1`.
  - Backward sweep: orders nodes in column `c` by the average row position of nodes they block in column `c + 1`.
  - Deterministic tie-breaking ensures identical output across identical inputs.
- **Zero-Overlap Guarantee:** Every node is assigned to a distinct grid slot `(rank, slotIndex)` with configurable pitch (`columnPitch = 370px`, `rowPitch = 195px`). Zero coordinate collisions occur by construction.

### 6. Arrange Execution, Modal Dialog & Undo Support
- **Screen-Space Confirmation Modal (`#canvas-arrange-dialog`):**
  - Radio options: "Only cards without a saved place" (default) vs. "All cards (cards you placed by hand will also move)".
  - Confirm button with batch save execution.
  - Cancel button dismissing dialog via click, backdrop, or `Escape`.
- **Batch Saving with Progress:**
  - Displays a smooth progress bar (`.arrange-progress-bar`) during save.
  - Batches network requests gracefully and reports success/failure counts.
- **Undo Operation:**
  - Prior coordinates (and note positions) are preserved in an in-memory `state.lastArrangeUndo` Map.
  - An "Undo arrange" floating button (`#canvas-arrange-undo`) appears after execution, allowing instant rollback while the page remains open.
- **Stability Guarantee:** Nothing moves on initial page load, background polling, or filter application. Auto-layout runs only when the user explicitly clicks "Arrange" and confirms.

### 7. Step A3 Carry-Over Nit Resolution
- In `web/public/app.js`, fixed the cross-repo drawer dependency chip rendering so the repository prefix (`repoPrefix`) is not redundantly prepended to the chip title text. Chips now cleanly display `#number Title` with the repository badge shown once only.

---

## Verification Evidence

### Automated Test Suites

1. **Full Test Suite (`npm test`):**
   - **618 passing tests** (0 failures, 0 skipped).
   ```text
   1..618
   # tests 618
   # suites 0
   # pass 618
   # fail 0
   # duration_ms 18730.997949
   ```

2. **Web Tests Integration Suite (`node --test web/tests/*.test.mjs`):**
   - **527 passing tests** across all unit and integration specs.
   - Includes:
     - `web/tests/markdown.test.mjs`: 10 tests covering XSS prevention, protocol filtering, headings, bold/italic, code blocks, task lists, and 4,000-char payloads.
     - `web/tests/arrange.test.mjs`: 15 tests covering project banding, DAG ranking, barycenter sweeps, cycle breaking, zero overlaps, and determinism.
     - `web/tests/canvas.test.mjs`: 27 tests covering canvas marker parsing, note updates, note length validation (4000 char cap), save queue concurrency, and UI elements.
   ```text
   1..527
   # tests 527
   # suites 0
   # pass 527
   # fail 0
   # duration_ms 30025.009965
   ```

3. **TypeScript Typecheck (`npm run typecheck`):**
   - **Clean pass** with 0 errors.

---

## Visual & Multi-Viewport Verification Screenshots

Generated via Playwright headless Chromium (`chrome-headless-shell-linux64`) across 360px, 768px, and 1280px viewports in `.agents/run/chamberos-board-v2/verifications/A4/`:

| Screenshot File | Viewport & Theme | Description |
|---|---|---|
| `canvas-notes-1280.png` | 1280px Desktop (Light) | Attached canvas notes under cards `#101`, `#102`, `#103`, and `#201` with connector lines and color swatches. |
| `canvas-note-editing-1280.png` | 1280px Desktop (Light) | Note `#101` in active edit mode showing Markdown textarea, live char counter `127 / 4000`, Save and Cancel buttons. |
| `canvas-note-delete-confirm-1280.png` | 1280px Desktop (Light) | Inline delete confirmation on Note `#102` header ("Delete note? Remove Cancel") fitting cleanly across header. |
| `canvas-notes-dark-1280.png` | 1280px Desktop (Dark) | Canvas notes rendered in charcoal dark theme with muted warm paper tones (`yellow`, `blue`, `pink`, `green`). |
| `canvas-arrange-dialog-1280.png` | 1280px Desktop (Light) | Arrange modal dialog with radio scope choices defaulting to "Only cards without a saved place". |
| `canvas-arranged-1280.png` | 1280px Desktop (Light) | Canvas after auto-layout arrange: project bands (`CORE`, `SATELLITE`), topological DAG ranks, zero overlaps, and undo button. |
| `canvas-arrange-undo-1280.png` | 1280px Desktop (Light) | Canvas after clicking "Undo arrange": all cards and notes restored to their exact prior positions. |
| `canvas-drawer-add-note-1280.png` | 1280px Desktop (Light) | Issue detail drawer for `#101` showing "+ Note" button in the drawer header. |
| `canvas-notes-768.png` | 768px Tablet (Light) | Tablet 768px Canvas view with responsive notes layer and connector lines. |
| `canvas-notes-768-dark.png` | 768px Tablet (Dark) | Tablet 768px Canvas view in dark mode. |
| `canvas-notes-360.png` | 360px Mobile (Light) | Mobile 360px Canvas view showing cards, notes, and pan/zoom controls. |
| `canvas-arrange-dialog-360.png` | 360px Mobile (Light) | Mobile 360px Arrange modal dialog centered cleanly with responsive button sizing. |
| `canvas-notes-360-dark.png` | 360px Mobile (Dark) | Mobile 360px Canvas view in dark mode. |

---

## Console & Content Security Policy (CSP) Health
- **0 unexpected console errors** during the entire execution flow.
- **0 Content Security Policy (CSP) violations** across all viewports.
- Fully compliant with `default-src 'self'`, `script-src 'self'`, `style-src 'self'`.

---

## Lexicon & Contract Conformance
- **Zero occurrences of emojis:** Checked via ripgrep across client and server files.
- **Zero occurrences of "n8n":** Checked via ripgrep across client and server files.
- **Bilingual localization:** French (`dict.fr`) and English (`dict.en`) support for all note actions, color labels, arrange options, and undo triggers.
