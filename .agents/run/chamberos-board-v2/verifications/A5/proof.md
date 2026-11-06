# Verification Proof — Step A5: Sidebar Data Views & Real-Data Section Integration

## Summary
Step A5 completes the integration of every sidebar section in ChamberOS Board V2 (Issue #60, parent #55), connecting all navigation destinations to real backend data and live interactive actions:
1. **Decisions Section:** Aggregates every unanswered open question across token-visible repositories, grouped by issue card, sorted newest activity first. Includes an inline answering form calling `POST /api/issues/:n/questions/:index/answer`, appending answers with timestamps and checking off questions while preserving surrounding body bytes.
2. **Blocked Section:** Aggregates issues requiring human attention (`status:needs-human`), containing unchecked Human Tasks, or blocked by open native dependencies, sorted newest activity first. Features interactive checkboxes connected to `POST /api/issues/:n/human-tasks/:index/toggle` with byte-for-byte markdown preservation.
3. **Operations Overview:** Displays authentic operational telemetry with zero invented or vanity metrics: open vs. closed counts, needs-human count, blocked count, closed in the last 7 days count, oldest open in-progress task (with days elapsed and direct link), project status matrix, and last fetched timestamp.
4. **Archive & Backburner:** Dual-tab view partitioning open backburner tasks from bounded closed issue history (`limit: 30` with "Load More"). Features "Remove backburner label" (`POST /api/issues/:n/labels/remove` and `DELETE /api/issues/:n/labels/:label`) with strict 400 precondition checks (0 GitHub PATCH calls when label is absent), and "Reopen task" (`POST /api/issues/:n/reopen`).
5. **Client View Switch:** Presentation filter toggle persisted in `localStorage['tb_client_view']`, accompanied by an explicit disclaimer banner ("Presentation filter only; not a security boundary. Confidential data must not be exposed.") that filters draft items, questions, and internal notes from the presentation.
6. **Honest Discussions Placeholder:** Clear, respectful notice that GitHub Discussions are not configured for the repository and decision workflows are managed through task issues, with a direct "Back to List" navigation action.
7. **Dynamic Sidebar Badges:** Live count badges on Decisions and Blocked items in both desktop sidebar and compact navigation drawer.
8. **Bilingual Localization (EN & FR):** Full dictionary translations for every view title, subtitle, stat label, button, disclaimer, and empty state.
9. **Strict CSP & Zero Emojis:** Full compliance with `default-src 'self'`, `script-src 'self'`, and `style-src 'self'`. Zero emojis anywhere in UI or server responses.

---

## Architectural & Design Implementations

### 1. Decisions Section & Inline Question Answering
- **Aggregation & Sorting:** Scans all normalized board issues for `openQuestions` where `!completed`. Groups active questions under their parent issue card, sorted in descending order of issue activity (`updatedAt`).
- **Inline Question Answer Form:**
  - Each question card features an inline submission form with an input field and "Answer" action button.
  - Submits to `POST /api/issues/:n/questions/:index/answer` with the answer text and issue fingerprint.
  - Body mutation updates the question in the markdown body from `- [ ] <question>` to `- [x] <question>` followed by a sub-bullet `  - Answer: <text> (<timestamp>)`, preserving all surrounding markdown indentation and CRLF/LF line endings.
  - Updates the in-memory board state optimistically and recalculates sidebar badge counts immediately.

### 2. Blocked Section & Byte-for-Byte Human Task Toggling
- **Filter Criteria:** An issue appears in the Blocked section if it satisfies any of:
  - `statusLabel === 'status:needs-human'`
  - Contains unchecked human tasks: `humanTasks.some(t => !t.completed)`
  - Blocked by open native dependencies: `blockedBy.some(dep => dep.state === 'open' || dep.state === undefined)`
- **Markdown Byte Preservation:**
  - Implemented `parseWebHumanTasks` and `toggleHumanTaskInMarkdown` in `web/server/board.ts`.
  - Checkboxes under `## Human Tasks` (or legacy aliases) are indexed with exact character byte offsets.
  - The toggle route `POST /api/issues/:n/human-tasks/:index/toggle` toggles only the single character between `[` and `]` (`' '` <-> `'x'`).
  - Indentation, bullet symbols, surrounding whitespace, CRLF line endings, and following sections remain completely unaltered.
  - Verified by dedicated unit tests in `web/tests/a5-sections.test.mjs`.

### 3. Operations Overview & Zero Invented Metrics
- **Strict Authenticity Standard:** No estimations, synthetic health scores, or speculative velocity metrics. Every figure is directly derived from GitHub API data:
  - **Open Tasks:** Total open issues across repositories.
  - **Closed Tasks:** Total closed issues across repositories.
  - **Needs Human Attention:** Issues with `status:needs-human` or open human tasks.
  - **Blocked Tasks:** Issues blocked by dependencies or in needs-human status.
  - **Closed (Last 7 Days):** Closed issues with `closedAt >= Date.now() - 7 * 86400000`.
  - **Oldest Open In-Progress Task:** Issue in `status:in-progress` with the earliest `createdAt` timestamp, showing exact days in progress and clickable link.
  - **Project Breakdown Matrix:** Clean tabular matrix showing tasks partitioned by project repository and status column.
  - **Data Timestamp:** Explicit timestamp of the latest board data fetch.

### 4. Archive & Backburner Dual-Tab View
- **Backburner Tab:**
  - Displays open issues carrying the `backburner` label.
  - Action button: "Remove backburner label" calling `POST /api/issues/:n/labels/remove` or `DELETE /api/issues/:n/labels/:label`.
  - **Precondition Safety:** If the label is absent from the issue, the endpoint immediately returns HTTP 400 `label_not_present` and makes zero GitHub API PATCH calls.
- **Closed Issues Tab:**
  - Displays closed issues fetched via `GET /api/archive?limit=30&offset=0`.
  - Bounded pagination with "Load More" functionality.
  - Action button: "Reopen task" calling `POST /api/issues/:n/reopen`. Reopens the issue (`state: 'open'`), removes `status:done`, and applies `status:backlog`. Reopening an already open issue returns HTTP 400.

### 5. Client View Switch
- **Presentation Filter:**
  - Toggled via the "Client view" item in the sidebar navigation.
  - Saved to `localStorage['tb_client_view']` as `'true'` or `'false'`.
  - In Client view mode, issues with `status:draft`, internal decision questions, unchecked subtasks, and internal labels are excluded from board presentation.
- **Explicit Disclaimer Banner:**
  - Prominently styled alert banner at the top of the view:
    > "Presentation filter only; not a security boundary. Confidential data must not be exposed."
  - Contains an immediate "Exit Client View" button to revert to the full operator view.

### 6. Discussions View Placeholder
- Respectful placeholder card rendered at `#placeholder-view`:
  - Title: "Discussions"
  - Description: "GitHub Discussions are not enabled for this repository. Open questions and decision workflows are managed through task issues."
  - Button: "Back to List" returning directly to the main task board list.

### 7. Dynamic Sidebar Badges
- Sidebar items for "Decisions" and "Blocked" display live numerical badges.
- Badges update automatically on page load, background refresh, question answer submission, and human task checkbox toggling.
- Badges hide cleanly when count is zero.

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
   # duration_ms 19079.161949
   ```

2. **Web Tests Integration Suite (`node --test web/tests/*.test.mjs`):**
   - **549 passing tests** across all unit and integration specs.
   ```text
   1..549
   # tests 549
   # suites 0
   # pass 549
   # fail 0
   # duration_ms 27986.116161
   ```

3. **Step A5 Dedicated Integration Suite (`node --test web/tests/a5-sections.test.mjs`):**
   - **9 passing tests** (0 failures).
   - Tests:
     - `parseWebHumanTasks` extracts checkboxes and byte offsets accurately.
     - `toggleHumanTaskInMarkdown` preserves markdown byte-for-byte except single checkbox character.
     - `toggleHumanTaskInMarkdown` preserves CRLF line endings byte-for-byte.
     - `parseWebHumanTasks` ignores code fences and indented code.
     - `POST /api/issues/:n/human-tasks/:index/toggle` toggles checkbox and preserves body byte-for-byte.
     - `POST /api/issues/:n/reopen` reopens closed issue and refuses already open issues.
     - `POST /api/issues/:n/labels/remove` and `DELETE /api/issues/:n/labels/:label` enforce precondition check failing 400 with 0 GitHub PATCH calls when label is absent.
     - `GET /api/archive` returns backburner and closed issues with bounded pagination.
     - `GET /api/operations` returns real counts with zero invented metrics.
   ```text
   1..9
   # tests 9
   # suites 0
   # pass 9
   # fail 0
   # duration_ms 1804.286908
   ```

4. **TypeScript Typecheck (`npm run typecheck`):**
   - **Clean pass** with 0 errors.

---

## Visual & Multi-Viewport Verification Screenshots

Generated via Obscura headless browser in `.agents/run/chamberos-board-v2/verifications/A5/screenshots/` across 1280px (desktop), 768px (tablet), and 360px (compact) viewports in dark and light themes:

| Screenshot File | Viewport & Theme | Description |
|---|---|---|
| `01-decisions-1280-dark.png` | 1280px Desktop (Dark) | Decisions section with open questions grouped by issue, activity timestamps, and inline answer forms. |
| `02-decisions-1280-light.png` | 1280px Desktop (Light) | Decisions section in light theme with high-contrast text and inputs. |
| `03-decisions-768-dark.png` | 768px Tablet (Dark) | Decisions section on 768px tablet layout with responsive card widths. |
| `04-decisions-360-dark.png` | 360px Compact (Dark) | Decisions section on 360px compact viewport with compact header and stacked answer form controls. |
| `05-blocked-1280-dark.png` | 1280px Desktop (Dark) | Blocked section showing issues requiring human tasks and dependencies with interactive checkboxes. |
| `06-blocked-1280-light.png` | 1280px Desktop (Light) | Blocked section in light theme with clear warning badges and dependency chips. |
| `07-blocked-768-dark.png` | 768px Tablet (Dark) | Blocked section on 768px tablet layout. |
| `08-blocked-360-dark.png` | 360px Compact (Dark) | Blocked section on 360px compact viewport with responsive human task items. |
| `09-operations-1280-dark.png` | 1280px Desktop (Dark) | Operations overview with real stat cards, oldest in-progress task metric, and project breakdown table. |
| `10-operations-1280-light.png` | 1280px Desktop (Light) | Operations overview in light theme with tabular figures and status badges. |
| `11-operations-768-dark.png` | 768px Tablet (Dark) | Operations overview on 768px tablet layout with responsive metric grid. |
| `12-operations-360-dark.png` | 360px Compact (Dark) | Operations overview on 360px compact viewport with horizontal table scrolling. |
| `13-archive-backburner-1280-dark.png` | 1280px Desktop (Dark) | Archive Backburner tab showing tasks on hold and "Remove backburner label" action buttons. |
| `14-archive-closed-1280-light.png` | 1280px Desktop (Light) | Archive Closed Issues tab in light theme with "Reopen task" actions and "Load More" pagination. |
| `15-archive-768-dark.png` | 768px Tablet (Dark) | Archive Backburner view on 768px tablet layout. |
| `16-archive-360-dark.png` | 360px Compact (Dark) | Archive Closed Issues view on 360px compact viewport. |
| `17-client-1280-dark.png` | 1280px Desktop (Dark) | Client view with active presentation filter, amber disclaimer warning banner, and filtered task list. |
| `18-client-1280-light.png` | 1280px Desktop (Light) | Client view in light theme showing security disclaimer and exit action button. |
| `19-client-768-dark.png` | 768px Tablet (Dark) | Client view on 768px tablet layout. |
| `20-client-360-dark.png` | 360px Compact (Dark) | Client view on 360px compact viewport with responsive banner stacking. |
| `21-discussions-1280-dark.png` | 1280px Desktop (Dark) | Honest Discussions placeholder explaining that task issues manage decision workflows. |
| `22-discussions-360-dark.png` | 360px Compact (Dark) | Discussions placeholder on 360px compact viewport with centered card and "Back to List" button. |
| `23-bilingual-fr-decisions-1280-dark.png` | 1280px Desktop (French) | Decisions section in French: "Arbitrages", "Répondre", localized timestamps and headings. |
| `24-bilingual-fr-operations-1280-dark.png` | 1280px Desktop (French) | Operations overview in French: "Vue Opérations", "Tâches ouvertes", "Besoin d'attention humaine". |

---

## Console & Content Security Policy (CSP) Health
- **0 unexpected console errors** during the entire execution flow.
- **0 Content Security Policy (CSP) violations** across all viewports.
- Fully compliant with `default-src 'self'`, `script-src 'self'`, and `style-src 'self'`.

---

## Lexicon & Contract Conformance
- **Zero occurrences of emojis:** Checked across client and server files.
- **Bilingual localization:** Full dictionary coverage for English (`en`) and French (`fr`).
- **No invented metrics:** Zero vanity numbers; all operational telemetry directly reflects real GitHub data.

---

## Hostile Review & Defect Resolution

### Finding 1: DOM Helper `el()` Child Type Handling
- **Defect:** In `web/public/app.js`, `el()` iterated over `children` assuming an Array. When callers passed a string or single Node, `(children || []).forEach` threw a TypeError or ignored string text content.
- **Resolution:** Updated `el(tag, props, children)` to check `typeof children === 'string'` (setting `node.textContent`), `Array.isArray(children)` (appending each non-null child), and `children.nodeType` (appending the single node), ensuring robust DOM creation across all sections.

### Finding 2: Button Text Wrapping on Small Viewports
- **Defect:** On narrow screens (360px) or multi-column layouts, buttons such as "Answer", "Reopen task", "Remove backburner label", and tabs wrapped onto multiple lines.
- **Resolution:** Added `white-space: nowrap` and `flex-shrink: 0` to `.decision-answer-form .button`, `.section-card-meta .button`, `.archive-tab`, and `.client-disclaimer-banner .disclaimer-action .button` in `web/public/theme.css`.

### Finding 3: Human Task Markdown Checkbox Preservation
- **Defect:** Modifying markdown tasks by regex replace on the entire file risked corrupting identical checkbox text in other sections (such as Acceptance Criteria or Subtasks) or altering newlines and indentation.
- **Resolution:** Implemented character-offset slicing in `toggleHumanTaskInMarkdown`. The function parses human task checkboxes, locates the exact start and end offset of the checkbox mark `[ ]` or `[x]` for `taskIndex`, and returns `markdown.slice(0, start) + newChar + markdown.slice(end)`, preserving 100% of surrounding bytes.

### Finding 4: Precondition Guard on Label Removal
- **Defect:** Attempting to remove a label not present on the issue could trigger an unnecessary upstream GitHub PATCH request or return a confusing response.
- **Resolution:** Added an explicit precondition check in `POST /api/issues/:n/labels/remove` and `DELETE /api/issues/:n/labels/:label`. If the label is not currently attached, the backend returns HTTP 400 `invalid_edit` with zero GitHub PATCH calls executed.

### Finding 5: Mandatory Fingerprint Enforcement Across All Write Paths
- **Defect:** `writeIssue` previously relaxed fingerprint verification on `reopen`, `remove-label`, and `human-task`, exposing those endpoints to lost updates and race conditions. Furthermore, missing fingerprint bypassed conflict detection.
- **Resolution:** Made fingerprints mandatory across all `writeIssue` operations without exception. Missing fingerprint returns 400 `fingerprint_required`, stale fingerprint returns 409 `conflict` with 0 GitHub writes.

### Finding 6: Reopen Lifecycle & Status Reconciliation
- **Defect:** Reopening closed issues patched `state: 'open'` without reconciling status labels, leaving issues stranded with `status:done` or stale stage markers.
- **Resolution:** Updated reopen handler in `web/server/app.ts` to patch both `state: 'open'` and `labels: applyStatusChange(fresh.item, 'status:backlog')`, properly returning the issue to the backlog with active verification.

### Finding 7: Operations Breakdown 8-Column Matrix & Accurate `closed7Days` Metric
- **Defect:** Operations breakdown omitted `planned` and mapped `in-review` to non-standard columns. `closed7Days` incorrectly referenced `updatedAt` rather than `closedAt`, misclassifying recently edited historical closed tasks.
- **Resolution:** Updated `operationsData` in `web/server/app.ts` and table headers in `web/public/index.html` to align with the 8 standard status columns (`draft`, `backlog`, `todo`, `planned`, `in-progress`, `needs-human`, `in-review`, `done`). Exclusively used `closedAt` for `closed7Days` calculation and preserved authentic `fetchedAt`, `truncated`, `partial`, and `failures` metadata.

### Finding 8: Global Client Presentation Mode & Clean Overview Previews
- **Defect:** Presentation mode was local to Client view, leaving Canvas, List, drawer, and other sidebar sections exposing internal draft tasks, raw markdown slices, and canvas sticky notes.
- **Resolution:** Implemented persistent global presentation mode with body-level class `client-presentation-active`, hiding draft tasks in List and Canvas views, suppressing canvas notes, displaying clean overview previews without leaking raw markdown, and offering a persistent exit banner.

### Finding 9: Native Obscura CDP Automation & Lexicon Sanitization
- **Defect:** Screenshot generation previously used an HTTP proxy with injected `<script>` tags and CSS overrides, violating native viewport and authentic asset fidelity constraints. Banned terminology appeared in test artifacts and markdown text.
- **Resolution:** Refactored `scripts/generate-a5-screenshots.mjs` to interface natively with Obscura CDP via Node's native WebSocket (`ws://127.0.0.1:9222/devtools/browser`, `Target.attachToTarget`, `Emulation.setDeviceMetricsOverride`), generating authentic 1280px, 768px, and 360px screenshots directly. Sanitized all occurrences of non-compliant terms to `compact` or `narrow`.

---

## Final Verification Summary
- `npm test`: 618 passed, 0 failed (PASS)
- `node --test web/tests/*.test.mjs`: 549 passed, 0 failed (PASS)
- `npm run typecheck`: 0 errors (PASS)
- Obscura CDP native screenshots: 24/24 captured at authentic viewports (PASS)
- Forbidden lexicon scan: 0 occurrences of prohibited terms or `n8n` in proof/code (PASS)

