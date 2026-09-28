# L4 hostile review — THREE VIEWS (ses_a666af59d1eb6423a9bc5d0c)

Reviewed: issue #23 work (b55eec5 + fixes). Verdict: PASSED, 9 findings fixed and
COMMITTED as 3729b6a. Suite 234 passing, typecheck + build green.

## Findings (all fixed in 3729b6a)
1. [HIGH] panel/main.ts:2890 — renderAllTasksView dropped non-selected tabs via activeTab
   filtering instead of rendering all 8 columns (parity with kanban). Fixed: render all 8
   from STATUS_COLUMNS; hide .status-tabs in all-tasks mode via CSS (panel/index.html:437).
2. [HIGH] panel/main.ts:2118 — stale DOM + listener leaks on layout transitions
   (human/all-tasks/questions/list/kanban). Fixed: clear inactive containers when
   currentRenderedLayout !== activeLayout.
3. [HIGH] panel/main.ts:2764 — duplicate-text checkbox write-back always hit the first
   matching line. Fixed: match on `t.completed !== cb.checked` and exact target line index.
4. [MEDIUM] panel/main.ts:1406 — updateIssueBody() left issue.humanTasks stale. Fixed:
   sync `issue.humanTasks = parseHumanTasks(newBody)`.
5. [MEDIUM] panel/main.ts:3101 — question-card click targeted nonexistent
   `drawerQuestionsCollapsible`. Fixed: `drawerQuestionsContainer` + scroll into view.
6. [MEDIUM] panel/main.ts:2811,2901,3045 — premature empty state during load. Fixed:
   loading spinner (.spin-fast) while `isLoading && issues.length === 0`.
7. [LOW] panel/main.ts:2838,2936,3077 — empty title fallback rendered blank strings.
   Fixed: `titles.title.trim() || issue.title?.trim() || 'Issue #' + number`.
8. [LOW] panel/index.html:2764, main.ts:2913,3139 — ARIA gaps (mode buttons aria-label,
   task groups role=region/aria-level, question forms aria-expanded). Fixed in markup + TS.
9. [MEDIUM] test/simplified-views.test.js:379 — weak string-regex assertions. Fixed: 8 new
   test cases (8-column parity, duplicate resolution, container clearing, ARIA).

## Known blind spots for L5 (not verified)
- No live-network behavior (mocks only); no real-browser visual verification yet —
  the "amazing visual" polish pass is still pending and will verify in a real panel.
- Focus preservation during background page streaming (#19) intentionally untouched.
