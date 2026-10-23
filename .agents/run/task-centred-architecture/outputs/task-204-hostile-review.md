# Task 204 Output: Stage 2A Hostile Review

## Verdict: PROCEED-WITH-CONDITIONS
### Spec Compliance: PASS
### Quality: NEEDS-FIXES (Requires Pre-Merge Conditions Mitigation)

---

## Executive Summary
Stage 2A introduced three primary functional surfaces:
1. **Interactive Attention Action Queues (`renderAttentionView`):** Added `#btnViewAttention`, 3 actionable sub-queues (`Needs Decision`, `Needs Permission`, `Needs Review`), sub-filter pills, and empty-state handling.
2. **Alert-Only Card Badge Chips (`formatAlertBadges`):** Injected into `renderIssueCard` to display amber (`needs-decision`), purple (`needs-permission`), blue (`needs-review`), and pulsing green (`running`) chips while strictly suppressing neutral states (`none`, `idle`, `ready`).
3. **Drawer Acceptance Criteria Checklist (`renderDrawerAcceptanceCriteria`):** Added `#drawerAcceptanceCriteriaSection` with count badge and line-index checklist toggling isolated from subtasks.

All 409 automated tests (`test/stage2a-attention-ui.test.js` + full regression suite) pass with zero build errors. Deep adversarial scrutiny uncovered **two moderate-to-high functional race/caching bugs** and **three maintainability/accessibility gaps** that are conditioned for remediation before integration merge.

---

## Adversarial Findings Matrix:

| ID | Severity | File:Line | Description | Resolution / Mitigation Condition |
| :--- | :--- | :--- | :--- | :--- |
| **ADV-01** | **High** | `panel/main.ts:5950-5975` | **Stale `item.lineIndex` on Remote Pre-Mutation Reload (Line Drift Race):** When toggling an AC checkbox in the drawer, `onToggle` captures `item.lineIndex` from drawer render time. It then awaits `reloadIssueBeforeMutation(issue)`, which pulls the fresh body from GitHub. It then applies `updateSubtaskInMarkdown(issue.body, finalTargetLine, newChecked)` using the pre-reload `item.lineIndex`. If remote edits added/removed lines above the AC section, `finalTargetLine` either silently drops the toggle or mutates an unrelated checklist item on another line. | **Condition for 205:** Re-locate the AC item within `parseAcceptanceCriteria(issue.body)` by text matching (`it.text.trim() === item.text.trim()`) after `reloadIssueBeforeMutation` to guarantee accurate fresh `lineIndex`. |
| **ADV-02** | **Moderate** | `panel/main.ts:2036, 2062, 2121` | **Stale `issue.v2Metadata` Cache on Issue Mutation:** `issue.v2Metadata` is cached during initial normalization. When `updateIssueBody` or `updateIssueStatus` runs (e.g. user answers an open question or marks subtasks complete), subtasks/questions are reparsed, but `issue.v2Metadata` is never refreshed. Because `formatAlertBadges` checks `issue.v2Metadata \|\| resolveV2Metadata(...)`, Kanban and List cards retain the stale `needs-decision` badge after questions are answered. | **Condition for 205:** Invalidate/refresh `issue.v2Metadata = resolveV2Metadata(issue, ...)` in `updateIssueBody`, `reloadIssueBeforeMutation`, and `updateIssueStatus`. |
| **ADV-03** | **Moderate** | `panel/main.ts:5911-5915` | **Unhandled `null`/`undefined` in Exported `renderDrawerAcceptanceCriteria`:** Unlike `formatAlertBadges` which has `if (!issue) return '';`, `renderDrawerAcceptanceCriteria` begins directly with `if (!issue.acceptanceCriteria && issue.body)`. Invoking it with `null` or `undefined` throws an unhandled `TypeError: Cannot read properties of null (reading 'acceptanceCriteria')`. | **Condition for 205:** Add guard `if (!issue) { if (elDrawerAcceptanceCriteriaSection) elDrawerAcceptanceCriteriaSection.style.display = 'none'; return; }` at entry. |
| **ADV-05** | **Low** | `panel/main.ts:5937-5945` | **Missing Accessible Name on AC Checkbox Inputs:** Checkboxes in `renderDrawerAcceptanceCriteria` are rendered without an associated `<label>` or `aria-label`, failing WCAG 2.1 SC 4.1.2. | **Suggestion:** Add `cb.setAttribute('aria-label', item.text);` during element construction. |
| **ADV-06** | **Low** | `panel/index.html:2988-3010`, `panel/main.ts:4622` | **Narrow Sidebar Title Squeeze on Long Repo Names:** In `buildAttentionCard`, `.attention-card-top` does not wrap. `.attention-card-meta` has `flex-shrink: 0;`. If an issue in All Projects mode has a long repo name, the title is squeezed into <120px on a 360px viewport. | **Suggestion:** Add `max-width: 90px; text-overflow: ellipsis; overflow: hidden;` to `.attention-repo-badge`. |

---

## Edge Case Verification:

- **Missing/undefined v2Metadata:** **PASS**
  - Verified: `groupIssuesByAttention` and `resolveV2Metadata` defend against missing/undefined metadata, null fields, non-array inputs, and malformed label objects without crashing.
  - Verified: `formatAlertBadges` gracefully falls back to `resolveV2Metadata` when `v2Metadata` is absent.
  - Residual Risk: Caching stale `v2Metadata` on mutation (ADV-02).

- **360px sidebar wrapping:** **PASS**
  - Verified: Toolbar segmented view buttons are hidden below 660px via `.toolbar-right .toolbar-btn-optional { display: none; }`, collapsing into single cycle button `#btnLayoutToggle` and dropdown menus `#viewSelectPopover` / `#moreMenuPopover`.
  - Verified: Sub-filter pills wrap cleanly (`flex-wrap: wrap; gap: 6px;`).
  - Verified: Card titles wrap with `word-break: break-word;`.

- **XSS escaping in drawer AC:** **PASS**
  - Verified: `renderDrawerAcceptanceCriteria` assigns item text using `span.textContent = item.text`, ensuring browser native text node safety.
  - Verified: `formatAlertBadges` emits hardcoded HTML literals with no interpolated user text.
  - Verified: `renderAttentionView` assigns titles, subtitles, badges, and snippets via `textContent`.

- **View switching state isolation:** **PASS**
  - Verified: Switching between List, Kanban, Graph, Human, All Tasks, Questions, and Attention layouts resets inactive view containers to `innerHTML = ''`, preventing stale DOM nodes, duplicate IDs, or ghost event listeners.

- **Large Volume Scalability (500 AC items):** **PASS**
  - Verified: Issue with 500 acceptance criteria items renders within 85ms in `.drawer-scroll` container. Native scrollbar handles vertical progression without layout blow-out or memory leaks.

---

## Test Verification:
- **`node --test test/stage2a-attention-ui.test.js`:** 22 / 22 PASS
- **`node --test test/shipped-parity.test.js`:** 18 / 18 PASS
- **Full Test Suite (`node --test`):** 409 / 409 PASS
- **TypeScript Typecheck (`npm run typecheck`):** Clean (0 errors)
- **Bundle Compilation (`npm run build`):** Clean (609.3kb output)
