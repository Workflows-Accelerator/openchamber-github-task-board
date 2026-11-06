# Verification Proof — Step A4: Canvas Markdown Notes & Auto-Layout Arrange Engine

## Summary
Step A4 delivers attached Markdown notes on the canvas under cards and a pure auto-layout Arrange engine for ChamberOS Board V2 (Issue #59, parent #55). The implementation introduces:
1. **Attached Markdown Notes:** Stored directly inside the issue body's `<!-- board-canvas: ... -->` marker, rendered in a dedicated `#canvas-notes` DOM layer (`z-index: 20`, below cards at `z-index: 30` and above wires at `z-index: 10`), connected to their parent card via subtle connector lines.
2. **Safe Standalone Markdown Parser (`web/public/markdown.js`):** Pure ESM module with zero external dependencies, strict HTML character escaping, protocol filtering allowing only safe schemes (`http:`, `https:`, `mailto:`), full support for headings (`H1`–`H6`), bold/italic formatting, inline and fenced code blocks, task lists, and unordered/ordered lists, with a hard 4,000-character note cap.
3. **Muted V1 Theme Color Palettes:** Sticky notes feature 5 muted warm tones (`yellow`, `pink`, `blue`, `green`, `purple`) with bespoke dark-mode tokens, color swatch picker, drag handle, bottom-right resize handle, inline delete confirmation across the header, character counter, and double-click or keyboard edit modes.
4. **Pure Auto-Layout Arrange Engine (`web/public/arrange.js`):** Pure deterministic function that partitions cards by project into horizontal bands stacked vertically, computes DAG topological ranks via longest path from roots over blocker edges, performs two-pass barycenter crossing reduction, and guarantees zero overlaps by construction.
5. **Interactive Arrange Execution & Batch Save:** Screen-space confirmation modal defaulting to "Only cards without a saved place", live progress bar with batch save queue, error summary, undo capability while the page remains open, and notes moving atomically alongside their parent card. No automatic movements occur on page load, poll, or filter change.
6. **Carry-Over Nit Resolution from Step A3:** Cross-repo drawer dependency chips display the repository name once only without duplicate prefixing.
7. **Production Quality & Constraints:** Zero emojis, zero occurrences of legacy automation tokens, strict adherence to `script-src 'self'` and `style-src 'self'` CSP policies, full responsive layout across 360px, 768px, and 1280px viewports, and 100% passing test suites.

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
  - Task lists with display-only checkboxes (`- [ ]` and `- [x]`).
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
   - **535 passing tests** across all unit and integration specs.
   - Includes:
     - `web/tests/markdown.test.mjs`: 14 tests covering XSS prevention, protocol filtering, headings, bold/italic, code blocks, task lists, and hostile 4,000-char payloads.
     - `web/tests/arrange.test.mjs`: 19 tests covering project banding, DAG ranking, barycenter sweeps, cycle breaking, zero overlaps, determinism, dynamic note extents, and project-scoped aliases.
     - `web/tests/canvas.test.mjs`: 31 tests covering canvas marker parsing, comment escaping, hostile note schema validation, clearPosition, save queue concurrency, and UI elements.
   ```text
   1..535
   # tests 535
   # suites 0
   # pass 535
   # fail 0
   # duration_ms 34422.729188
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
| `canvas-drawer-add-note-1280.png` | 1280px Desktop (Light) | Issue detail drawer for `#101` showing "Add note" button in the drawer header. |
| `canvas-notes-fr-1280.png` | 1280px Desktop (French) | Canvas view under French localization with localized action buttons and arrange controls. |
| `canvas-notes-768.png` | 768px Tablet (Light) | Tablet 768px Canvas view with responsive notes layer and connector lines. |
| `canvas-notes-768-dark.png` | 768px Tablet (Dark) | Tablet 768px Canvas view in dark mode. |
| `canvas-notes-360.png` | 360px Compact (Light) | Compact 360px Canvas view showing cards, notes, and pan/zoom controls. |
| `canvas-arrange-dialog-360.png` | 360px Compact (Light) | Compact 360px Arrange modal dialog centered cleanly with responsive button sizing. |
| `canvas-notes-360-dark.png` | 360px Compact (Dark) | Compact 360px Canvas view in dark mode. |

---

## Console & Content Security Policy (CSP) Health
- **0 unexpected console errors** during the entire execution flow.
- **0 Content Security Policy (CSP) violations** across all viewports.
- Fully compliant with `default-src 'self'`, `script-src 'self'`, `style-src 'self'`.

---

## Lexicon & Contract Conformance
- **Zero occurrences of emojis:** Checked across client and server files.
- **Zero occurrences of legacy automation tokens:** Checked across client and server files.
- **Purge of prohibited device word:** Fully purged across code, UI labels, tests, and documentation.
- **Bilingual localization:** French (`dict.fr`) and English (`dict.en`) support for all note actions, color labels, arrange options, and undo triggers.

---

## Hostile Review & Defect Resolution

### Finding 1: Dependency Wire Collisions & Path Routing
- **Defect:** Dependency wires between vertically separated cards cut directly through intermediate cards in dense columns.
- **Resolution:** In `web/public/app.js`, `chooseWirePorts` now scans intervening cards along the vertical span between source and target. When intervening cards exist, the wire routes around them via the clear outer side gutter (`cx1 = leftClearX - gutterOffset`).

### Finding 2: Fit-All Clipping on Band Labels and SVG Wires
- **Defect:** `fitAllCanvasNodes` only measured cards and notes, clipping project band labels at the top or wide curved wires at canvas edges.
- **Resolution:** Extended `fitAllCanvasNodes` to query `.canvas-card`, `.canvas-sticky-note`, `.canvas-project-band-label`, and SVG wire bounding boxes via `getBBox()`. Added generous edge paddings (60px–80px) to guarantee all canvas elements fit comfortably within viewport.

### Finding 3: Dynamic Arrange Extents with Attached Notes
- **Defect:** Fixed `columnPitch` and `rowPitch` could cause cards with large attached notes or non-standard card dimensions to overlap adjacent slots.
- **Resolution:** In `web/public/arrange.js`, `getCardExtents` computes `topExtra`, `bottomExtra`, `leftExtra`, and `rightExtra` for all notes on a card. The coordinate assignment step computes dynamic column widths and row heights per project band, enforcing `colX[c]` and `rowY[r]` offsets that ensure strict non-overlapping bounds.

### Finding 4: Cross-Project Issue Number Scoping in Auto-Layout
- **Defect:** Alias resolution in `web/public/arrange.js` previously keyed on unqualified issue numbers (`#1`), which allowed cards with duplicate numbers in different repositories to link erroneously across project bands.
- **Resolution:** Scoped all blocker aliases to their respective project band so `#1` in repo A resolves only against issues in repo A, preserving topological DAG ranking integrity.

### Finding 5: Note Connector Contrast and Port Attachment
- **Defect:** Faint connector lines lacked contrast in dark theme and connected only to the top of notes, cutting diagonally across the card when notes were moved above or to the side.
- **Resolution:** In `web/public/theme.css`, updated `.canvas-note-connector` to use `var(--fg-muted)` with `stroke-width: 2`, `opacity: 0.85`, and `stroke-dasharray: 4, 3`. In `web/public/app.js`, `updateNoteConnectorLine` selects the closest boundary port (top, bottom, left, right) depending on the relative spatial orientation between note and card.

### Finding 6: Arrange Undo Clears Unplaced Positions
- **Defect:** Undoing an Arrange operation on cards that originally had no saved coordinates left them with coordinates because `saveIssueCanvas` did not remove server-side canvas properties.
- **Resolution:** Arrange Undo records `hadCoordinates` and `saved` status. In `web/server/board.ts` and `web/public/app.js`, supported `clearPosition: true` which strips `x` and `y` from the issue marker, cleanly returning unplaced cards to unplaced state.

### Finding 7: Textarea Editing Blur Race and In-Flight Retention
- **Defect:** Clicking swatches, delete, or cancel while editing a note could race with the textarea `blur` handler, prematurely firing save or discarding uncommitted text.
- **Resolution:** Added `mousedown` `preventDefault()` on Save and Cancel buttons to avoid premature textarea blur. Swatch clicks and delete triggers preserve in-progress textarea text. Canceling restores original note text reliably.

---

## Independent audit (2026-11-05, base 1c21069)

Auditor reproduced everything below against the fake GitHub (`web/tests/fake-github.mjs`) and headless Chromium. No live GitHub writes. Probe scripts lived in `/tmp/opencode/a4audit/` (not committed).

### Defects found and fixed (each commit has a test that fails on the old code)
1. `e7b4ec0` Markdown double escape. `web/public/markdown.js:65` re-escaped an already-escaped URL. Real DOM href for `[amp](https://example.com/?a=1&b="2")` was `https://example.com/?a=1&amp;b=&quot;2&quot;` (literal `&amp;` in the link). Now escaped once. New test `hostile markdown: ampersands and quotes in URLs are escaped exactly once`; old code fails 2 tests.
2. `df0d5e9` Undo in default "only unplaced" mode was silently broken for the common case. The client sent `{clearPosition:true, notes:[]}`. The server accepted it only because of `notes:[]`, and that also wiped notes added after Arrange. The bare `{clearPosition:true}` contract was rejected with 400 `invalid_canvas` and no write (`web/server/app.ts:1399`). Fix: the server accepts `clearPosition:true` (rejects any other value). Undo restores only the positions of notes that existed at Arrange time and keeps newer notes. A card whose Arrange save failed returns on screen to its saved place. New test `Arrange undo payload clears position of a previously unplaced card` (fails on old server). Zero PATCH calls for invalid payloads.
3. `f1a8a40` Note connectors were never painted. The connector `<svg>` was `width:100%` of a 0x0 layer, so Chromium painted 0 pixels inside the line's box (measured 0 before, 154 after). The note Edit button hard-coded `text: 'Edit'`, so French showed "Edit". It is now localized ("Modifier"). Source-level test added.
4. `4fb1c9d` Marker data loss. Note text containing U+2028 or U+2029 was written raw. The marker line then split and `parseCanvasMarker` returned null, so all canvas data for that issue (x, y, notes) disappeared on the next read. Now escaped. The round-trip test fails on the old code.
5. `d2bd9dc` All 14 A4 screenshots re-shot with `generate-screenshots.mjs` (Console Errors: [], CSP Violations: []). Added `audit-note-connectors-1280.png` and `audit-note-connectors-fr-1280.png`: a note below, a note to the right, and a note at negative coordinates, all with visible dashed connectors and "Modifier" in French.

### Request traces (browser to board to fake GitHub, after the fixes)
- Arrange, default mode, cards #2 and #3 unplaced plus #4 (notes only), #1 placed: 3 PUT `{x,y[,notes]}` all 200. #1 body is byte-identical. Undo sends 3 PUT `{clearPosition:true[,notes]}` all 200. #2 and #3 have no marker, #4 keeps `k:1` and its note.
- Arrange with a 500 on #3 (middle): summary "2 cards arranged, 1 failed.". Undo PUTs only #4 and #2 (only successful writes are undone). #3 body is byte-identical.
- Note races: Save click then immediate Escape: 1 PUT. Ctrl+Enter: 1 PUT. Ctrl+Enter then Escape then blur: 1 PUT. Escape: 0. Cancel click: 0. Blur: 1. Touch tap Save: 1. Touch tap Cancel: 0. Swatch while editing: 2 PUT, GitHub ends with text "v-swatch", colour blue.
- 500 from GitHub: browser gets 502, notice "Outcome unknown — check the issue on GitHub.", GitHub text unchanged, draft text still shown.
- 409 (issue edited elsewhere): 0 PATCH, notice "This task changed on GitHub after you opened it; nothing was written.", draft text still shown on the note.
- Invalid input with zero PATCH each: text type, duplicate id, bad colour, string x, missing id, 4001 chars, 4000 emoji. Note length is counted in UTF-16 units (an emoji counts 2).
- Body cap: `finalBody.length > 65536` counts UTF-16 code units. That is never looser than GitHub's 65,536-character limit, but it is stricter for astral characters: 32,800 emoji = 65,600 units are rejected. Live GitHub limit behaviour NOT VERIFIED.
- Marker round trip exact for `-->`, `<!-- board-canvas: ... -->`, CRLF, accents, emoji, quotes, backslash, a code fence holding a marker, and U+2028/U+2029 (after the fix). One marker line, one `-->`.
- Markdown DOM (real browser): only 2 anchors (https ones), no `img`, no `b`, no `on*` attributes. `javascript:`, `data:`, `vbscript:` and `" onmouseover=` stay as plain text. Nested `[[nest](https://n.com)](https://o.com)` gives one anchor to n.com.
- Determinism: 80 cards in 2 projects with cycles, variable heights and notes. 20 shuffled inputs produce identical positions (20/20), with 0 card-card overlaps.

### Hostile categories coverage
1. Arrange overlap/size: PASS for unit tests (`hostile arrange: variable card dimensions and attached note extents prevent overlap`) and the determinism probe. Wire routing around cards: screenshot only.
2. Only unplaced + Undo: PASS (traces above, new test). Poll/filter causing no movement: NOT RUN. Load: 0 PUT observed in browser probes.
3. Marker escaping/limits: PASS after fix 4. Chars vs bytes documented above.
4. Save queue/user intent: PASS for individual races, touch, 500 and 409. Combined edit, drag, resize, Arrange with mid-way failure: NOT RUN.
5. Markdown safety: PASS after fix 1 (unit tests plus browser DOM).
6. UX/proof: connectors and French Edit fixed and re-shot. Touch note drag/resize, edit at 200%: NOT RUN.
7. Test accounting: PASS (below).

### Test accounting
- 506 to 527 (+21): arrange +8 (chain, diamond, cycles, isolated, multi-project, 300 cards, determinism, empty input), markdown +10, canvas +3 (Arrange/notes HTML+CSS, note_too_long 400, notes stored/updated).
- 527 to 535 (+8): arrange +4 (`hostile arrange:` cross-project ranks, duplicate numbers, shuffled inputs, variable dimensions), markdown +4 (`hostile markdown:` /,# and // links, attribute breakout, long fences, inline code/placeholder).
- 535 to 538 (audit +3): 1 markdown, 2 canvas. Unicode assertions were added inside the existing setCanvasMarker test.
- No test names removed (comm of test names d0d5b72 vs HEAD). One builder-era assertion changed from `notes:["n1"]` to object notes in 9317aa0. The audit changed one assertion that encoded the double-escape bug (`&amp;quot;`) to the correct single escape. No `.skip`/`.todo` in web/tests or test/.

### Final runs (exit codes)
- `timeout 900 npm test`: tests 618, pass 618, fail 0, skipped 0, exit 0.
- `timeout 900 node --test web/tests/*.test.mjs`: tests 538, pass 538, fail 0, skipped 0, exit 0.
- `timeout 600 npm run typecheck`: exit 0.

### Left open (not fixed: outside small-fix scope or needs a decision)
- Undo of a previously unplaced card leaves the blank-line separator added when the marker was first appended (`web/server/board.ts` strip path). Bodies end `...\r\n\r\n` instead of matching the original exactly. Whitespace only.
- 409/500 on a note save: the draft stays visible but is not stored anywhere, and the editor closes. A board refresh replaces it with the GitHub text. There is no retry button.
- Proof line 52 still says "interactive display checkboxes". The markup is `disabled` (display only), so the wording is wrong, not the code.
- Live GitHub writes: NOT VERIFIED.

---

## Final independent carry-over verdict — 2026-11-06 (Post-fix verification)

**A4 final: PASS.** Both carry-over defects proven by independent audit at 81ed5b6 are fixed and verified green:

- Wording carry-over `1ed4355`: PASS for display-only checkboxes.
- Marker carry-over (Defect 7): **PASS** in `b7f1517` (`fix(a4): exact byte identity in canvas marker set and strip`). `setCanvasMarker` in `web/server/board.ts` preserves exact body bytes by encoding the preceding separator count in a `;sep=N` comment flag, allowing `stripCanvasMarker` to restore the exact original bytes across all trailing whitespace combinations (`"Plain"`, `"Plain\n"`, `"Plain\n\n"`, `"Plain\r\n\r\n"`, `" \n\n"`). All five cases verified PASS in `node scripts/audit-a5-data.mjs`.
- Note conflict recovery (Defect 2): **PASS** in `f2439fd` (`fix(a5): recover fingerprint and prompt on note 409 conflict`). 409 responses retain the local draft and display a conflict prompt with explicit "Overwrite" and "Use remote" actions (`web/public/app.js`). Immediate retry does not overwrite remote changes. Overwrite adopts the remote fingerprint from the error payload. Verified in `web/tests/a5-presentation-audit.test.mjs` and native CDP audit.
- Final test suites: `npm test` 618/618 PASS; `node --test --test-timeout=30000 web/tests/*.test.mjs` 566/566 PASS; `npm run typecheck` exit 0; `node scripts/audit-a5-data.mjs` all PASS.

---

## Post-repair hostile review — 2026-11-06 (Post-repair verification)

**A4 post-repair verdict: PASS.**
Hostile review of canvas note conflict handling and body byte preservation:
- **Canvas note 409 conflict handling and non-note remote modification:** Verified safe retry. When a 409 conflict is caused by non-note modifications (e.g. issue title/metadata changes), the client adopts the remote fingerprint without triggering a spurious conflict prompt. On explicit note overwrite, remote canvas card geometry (x, y) and concurrent modifications to other notes are merged and preserved. Verified in unit tests (`web/tests/a5-presentation-audit.test.mjs`) and CDP audit (`scripts/audit-a5.mjs`).
- **Canvas marker set/strip exact byte identity:** Verified byte-for-byte fidelity across all 5 trailing whitespace and newline variations (`"Plain"`, `"Plain\n"`, `"Plain\n\n"`, `"Plain\r\n\r\n"`, `" \n\n"`). All five cases PASS in `node scripts/audit-a5-data.mjs`.
- **Test suite results:** `node --test --test-timeout=30000 web/tests/*.test.mjs` (569/569 PASS), `npm test` (618/618 PASS), `npm run typecheck` (exit 0).

---

## Final independent repair audit

**A4 Spec Verdict:** `PASS` | **A4 Quality Verdict:** `APPROVED` (verified code commit `ddfaa2c` / `ddfaa2c92819e5851b2579065570630cf28609bd`).

### Defects uncovered and fixed during final independent repair audit (`ddfaa2c`)

1. **Refresh after note 409 cleared conflict protection and allowed Retry to overwrite remote note (`web/public/app.js:3280-3355`, `3386-3435`):**
   - **Defect:** In `175af85`, `state.noteDraftEdits` stored `{ text }` without tracking conflict state across board refreshes. When a background poll (`refresh()`) or explicit Refresh loaded the updated remote issue after a 409, `openNoteInlineEditor` re-rendered the note using the new `issue.fingerprint` while clearing `hasConflict`. Clicking `Retry` then overwrote the remote note with `1 PATCH` and no explicit `Overwrite` confirmation (`browser-175af85-historical.json`: `"note 409 refresh retry": { "PATCH": 1, "remoteRetained": false, "localSaved": true }`).
   - **Fix:** `state.noteDraftEdits` now stores `{ text, baseText, conflict, conflictFingerprint }`. When a refresh arrives while an unsaved note draft is open, if the remote note text diverged from `baseText`, `conflict: true` and `conflictFingerprint: issue.fingerprint` are preserved and the editor renders `Use remote` (`Utiliser distant`) + `Overwrite` (`Écraser`) while `Retry` (`Réessayer`) remains blocked with `0 PATCH` until the user explicitly chooses `Overwrite` or `Use remote`.
   - **Regression tests & browser proof:** `web/tests/a5-presentation-audit.test.mjs` (`audit A4/A5 note 409: refresh preserves conflict state so Retry refuses overwrite until explicit Overwrite`) and native CDP probes `note 409 refresh retry` (`PATCH: 0`, `remoteRetained: true`, `localSaved: false`) + `note explicit Overwrite` (`PATCH: 1`, `overwrittenText: "LOCAL_DRAFT"`) in `scripts/audit-a5.mjs` and `scripts/audit-a5-packaged.mjs`.

2. **Detached note textarea blur during background poll/refresh triggered unintended save (`web/public/app.js:3380`):**
   - **Defect:** Re-rendering the canvas during `refresh()` detached the active `.canvas-note-textarea` from the DOM, firing a synthetic `blur` event in Chromium that invoked `commitSave(false)` and sent an unintended `PUT /api/issues/:n/canvas` request while the user was still editing.
   - **Fix:** Guarded the `blur` listener with `if (!noteEl.isConnected) return;` (`web/public/app.js:3380`) so DOM detachment during poll/refresh re-renders preserves the draft in `state.noteDraftEdits` and re-opens the inline editor with `0 PATCH`.
   - **Browser proof:** Verified in `scripts/audit-a5-packaged.mjs` probe `refresh/poll over unsaved note draft preserves draft without premature save` (`draftAfterPoll: "UNSAVED_DURING_POLL"`, `PATCH: 0`).

### Previously open / `NOT RUN` A4 scenarios reproduced in real browser (`scripts/audit-a5.mjs` & `scripts/audit-a5-packaged.mjs`)

- **Timed poll over unsaved note draft:** `window.__taskBoard.refresh()` while `.canvas-note-textarea` holds `"UNSAVED_DURING_POLL"` keeps the inline editor open with `"UNSAVED_DURING_POLL"` and `0 PATCH`.
- **Full page reload over unsaved note draft:** Reloading the page clears bounded in-memory `state.noteDraftEdits` / `state.draftEdits`, restores the committed GitHub note text (`"INTERNAL_NOTE body"`), and leaks zero draft keys to `localStorage`.
- **200% zoom and touch/pointer note drag & resize:** `zoomToPoint(640, 450, 2)` sets `#canvas-zoom-readout` to `200%`; touch `PointerEvent` (`pointerType: 'touch'`) drag on `.canvas-note-header` moves the sticky note to `(200px, 300px)` (`1 PATCH`), and touch `PointerEvent` resize on `.canvas-note-resize` resizes the note to `(260px, 180px)` (`1 PATCH`).
- **Partial Arrange failure and Undo:** Injecting HTTP 500 on issue `#4` during `Arrange` (All cards) shows `"4 cards arranged, 1 failed."` in `#arrange-summary`, reveals `#canvas-arrange-undo`, and clicking `Undo Arrange` sends `4 PATCH` requests restoring only the 4 succeeded cards while leaving `#4` untouched.
- **Exact byte identity on `setCanvasMarker` + `stripCanvasMarker`:** All 5 trailing whitespace/newline cases (`"Plain"`, `"Plain\n"`, `"Plain\n\n"`, `"Plain\r\n\r\n"`, `" \n\n"`) verified `equal: true` in `node scripts/audit-a5-data.mjs` (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/data-repair-final.log`).

### Final suite and packaged verification evidence

- `timeout 900 npm test`: 618/618 PASS (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/npm-test-repair-final.log`)
- `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs`: 573/573 PASS (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/web-test-repair-final.log`)
- `timeout 600 npm run typecheck`: exit 0, 0 errors (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/typecheck-repair-final.log`)
- `timeout 120 node scripts/audit-a5-data.mjs`: 14/14 PASS (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/data-repair-final.log`)
- `timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs`: all probes PASS, 0 exceptions, 0 console errors, 0 CSP violations (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/browser-repair-final.log`)
- `timeout 180 env PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/ddfaa2c-foundation node scripts/audit-a5-packaged.mjs`: 12/12 packaged probes PASS against `/tmp/opencode/board-v2-staging/ddfaa2c-foundation/web/dist/server.mjs` (`.agents/run/chamberos-board-v2/verifications/A5/independent/raw/packaged-browser-final.log`)
