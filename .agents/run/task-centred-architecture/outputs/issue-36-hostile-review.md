# Independent Hostile Review: Issue #36 Autonomous Closure Fix

**Review Target:** `git diff 9c235a9..7c6fd33`  
**Branch:** `fix/issue-36-autonomous-closure`  
**Reviewer:** Independent Hostile Adversary  
**Date:** Oct 24, 2026  

---

## 1. Two-Verdict Statement & Summary

- **Correctness Verdict:** `PASS`
- **Scope Verdict:** `PASS`
- **Spec Compliance Verdict:** `PASS`
- **Quality Verdict:** `APPROVED`

**Summary:**  
The fix cleanly and definitively severs all automatic paths that could produce a `state: 'closed'` PATCH to GitHub. Autonomous issue closure is blocked at two independent defensive boundaries: (1) inside `StatusReconciler.reconcile()` (`panel/labels.ts:618-620`), which unconditionally skips `targetCol === 'done'` and `issue.state === 'closed'`; and (2) inside `updateIssueStatus()` (`panel/main.ts:2307-2310`), which enforces an explicit `{ isHumanGesture: true }` flag before mutating issue state or issuing a closure PATCH. All six legitimate human gestures (Kanban drag-and-drop, setupDragAndDrop, card Next button, dependency graph completion checkbox, drawer Close/Reopen button, and drawer status dropdown) explicitly supply `{ isHumanGesture: true }` and retain identical UX. Card and drawer archive controls invoke `toggleArchiveIssue()` directly upon explicit human clicks. Non-terminal automatic reconciliation (`status:in-progress`, `status:needs-human`) remains fully functional. Prompt instructions in `DEFAULT_AI_ISSUE_PROMPT` concisely forbid agents from closing issues or setting terminal statuses.

---

## 2. Risk & Findings Matrix

| Finding ID | Severity | Description | Status / Disposition |
| --- | --- | --- | --- |
| **F-01** | `Low` | **Reproduction Premise Discrepancy (Missing Condition Documented):** The issue brief hypothesized that markdown body `phase:done` or `phase:archive` triggered closure through `panel/core.ts:3339-3341`. In reality, `StatusReconciler` (`panel/labels.ts:616`) relies on its local `resolveIssueColumn`, which inspects issue labels and session activity but lacks a body phase parser. Pre-fix code did, however, permit automatic closure if an open issue carried `done` or `status:done` labels. | **Mitigated & Defended:** Fix correctly acknowledged the missing condition and implemented defense-in-depth at both reconciler and status mutation levels. |
| **F-02** | `Low` | **Test Harness Gesture Injection:** Three pre-existing tests (`test/current-board.test.js:216, 339` and `test/stage2a-attention-ui.test.js:884`) required `{ isHumanGesture: true }` annotations to simulate user actions without being blocked by the automatic closure guard. | **Expected / Compliant:** These tests assert human UI workflow semantics (optimistic updates and metadata refreshes on user closure). |

*No Catastrophic, High, or Medium severity defects found.*

---

## 3. Comprehensive Closure-Path Audit Table

Every caller of `updateIssueStatus`, every write to `state: 'closed'`, archive toggles, drag/drop handlers, menus, and label projections was audited:

| Path / Caller | Location | Type | Pre-Fix Behavior | Post-Fix Behavior | Can Still Close? |
| --- | --- | --- | --- | --- | --- |
| `StatusReconciler.reconcile()` calling `this.updateStatus` | `panel/labels.ts:642`, `panel/main.ts:2804` | Automatic | If `targetCol === 'done'` (e.g. open issue with `status:done` or `done` label), called `updateIssueStatus(issue, 'done')` and emitted closure PATCH. | Reconciler skips `targetCol === 'done'` (`labels.ts:618`) and `issue.state === 'closed'` (`labels.ts:620`). Also blocked by `isHumanGesture` guard. | **NO (Cut)** |
| Direct / unsignaled call to `updateIssueStatus(issue, 'done')` | `panel/main.ts:2307` | Automatic / Programmatic | Set `issue.state = 'closed'`, sent PATCH `{ state: 'closed', labels: [...] }`. | Guard `if (targetColumn === 'done' && !options?.isHumanGesture)` logs warning and aborts without mutation or PATCH. | **NO (Cut)** |
| Next button click on Card (`.card-btn-next`) | `panel/main.ts:3381` | Human | Called `updateIssueStatus(issue, target)`. | Passes `{ isHumanGesture: true }`. Issues PATCH `{ state: 'closed' }` when advancing from `in-review`. | **YES** |
| Kanban column drop handler | `panel/main.ts:3576` | Human | Called `updateIssueStatus(issue, col.id, { newPriorityGroup })`. | Passes `{ newPriorityGroup, isHumanGesture: true }`. Issues PATCH `{ state: 'closed' }` on drop into Done column. | **YES** |
| Dependency graph node checkbox click | `panel/main.ts:5423` | Human | Called `updateIssueStatus(node.issue, chk.checked ? 'done' : 'todo')`. | Passes `{ isHumanGesture: true }`. Issues PATCH `{ state: 'closed' }`. | **YES** |
| Drawer close/reopen toggle button click (`elBtnDrawerToggleClose`) | `panel/main.ts:6012` | Human | Called `updateIssueStatus(issue, isClosed ? 'todo' : 'done')`. | Passes `{ isHumanGesture: true }`. Issues PATCH `{ state: 'closed' }` on close toggle. | **YES** |
| Column drop handler in `setupDragAndDrop` | `panel/main.ts:7967` | Human | Called `updateIssueStatus(issue, colId)`. | Passes `{ isHumanGesture: true }`. Issues PATCH `{ state: 'closed' }` on drop into Done column. | **YES** |
| Drawer status dropdown select (`drawerStatusSelect`) | `panel/main.ts:8736` | Human | Called `updateIssueStatus(activeIssue, targetCol)`. | Passes `{ isHumanGesture: true }`. Issues PATCH `{ state: 'closed' }` when "Done" selected. | **YES** |
| Card Archive button click (`.card-btn-archive`) | `panel/main.ts:3391` | Human | Invoked `toggleArchiveIssue(issue)`. | Unchanged; calls `toggleArchiveIssue(issue)`. Sets `newState = 'closed'` and sends PATCH. | **YES** |
| Drawer Archive button click (`elBtnDrawerArchive`) | `panel/main.ts:6004` | Human | Invoked `toggleArchiveIssue(issue)`. | Unchanged; calls `toggleArchiveIssue(issue)`. Sets `newState = 'closed'` and sends PATCH. | **YES** |
| Launch preflight modal (`launchSessionFromModal`) | `panel/main.ts:6760` | Human | Called `updateIssueStatus(activeIssue, 'in-progress')`. | Unchanged; target is `'in-progress'`, never `'done'`. | **NO** |
| Batch package launch (`launchBatchPackageSession`) | `panel/main.ts:6859` | Human | Called `updateIssueStatus(issue, 'in-progress')`. | Unchanged; target is `'in-progress'`, never `'done'`. | **NO** |
| Batch separate sessions launch (`launchBatchSeparateSessions`) | `panel/main.ts:6918` | Human | Called `updateIssueStatus(issue, 'in-progress')`. | Unchanged; target is `'in-progress'`, never `'done'`. | **NO** |
| Batch action bar (`elBatchActionBar`) | `panel/main.ts:6790-6925`, `panel/index.html:4213` | Human | Only provides Package, Batch Start, Attach to Chat, Deselect. | No closure action exists. | **NO** |
| Keyboard shortcuts | `panel/main.ts:8661` | Human | Escape dismisses modals/drawer; Arrow/Enter navigate menus. | No shortcut closes issues. | **NO** |
| Label-driven status:done projection | `panel/labels.ts:340,345`, `panel/core.ts:3270,3280`, `panel/main.ts:2628,2633` | Read-only Projection | Issues with `status:done` or `done` label displayed in Done column, but triggered reconciler closure in pre-fix code. | Read-only projection renders issue in Done column, but reconciler guard prevents closure PATCH. | **NO** |

---

## 4. Legitimate Human Gesture Verification

Every legitimate human UI control was verified:
1. **Card Drag & Drop to Done:** Both the Kanban view cards container (`panel/main.ts:3576`) and the global column drop handler (`panel/main.ts:7967`) forward `{ isHumanGesture: true }`.
2. **Next Button on Card:** Advances from `in-review` to `done` (`panel/main.ts:3381`) with `{ isHumanGesture: true }`.
3. **Graph View Completion Checkbox:** Direct node completion toggle (`panel/main.ts:5423`) passes `{ isHumanGesture: true }`.
4. **Drawer Close / Reopen Toggle:** Toggle button (`panel/main.ts:6012`) passes `{ isHumanGesture: true }`.
5. **Drawer Status Dropdown:** Manual selection change (`panel/main.ts:8736`) passes `{ isHumanGesture: true }`.
6. **Card & Drawer Archive Buttons:** Explicit user clicks invoke `toggleArchiveIssue()` (`panel/main.ts:3391, 6004`), preserving archive closure semantics and category preservation.

Zero human closure paths were dropped or degraded.

---

## 5. Non-Terminal Automatic Reconciliation Verification

Automatic reconciler transitions for active sessions remain functional:
- Active session with `activity: 'running'` resolves to `'in-progress'`. `StatusReconciler.reconcile()` passes `targetCol: 'in-progress'`. `updateIssueStatus()` processes non-terminal columns without requiring `isHumanGesture`.
- Active session with `activity: 'idle'` or `waiting-*` resolves to `'needs-human'`. `StatusReconciler.reconcile()` transitions `targetCol: 'needs-human'` cleanly.
- Verified in `test/autonomous-closure.test.js` (Test 6) and `test/status-model.test.js` (Test 13, PASS).

---

## 6. Red-First Evidence & Pre-Fix Failure Proof

Running the new test suite `test/autonomous-closure.test.js` against pre-fix code (`git checkout 9c235a9 -- panel/`) produced 3 immediate failures out of 6 tests:
```
# Subtest: 2. Automatic closure path cut: un-signaled updateIssueStatus(issue, "done") is blocked
not ok 2 - 2. Automatic closure path cut: un-signaled updateIssueStatus(issue, "done") is blocked
  ---
  error: Un-signaled updateIssueStatus("done") must not produce a PATCH request
  expected: 0, actual: 1

# Subtest: 3. Reconciler guard cut: StatusReconciler never requests done or closes an issue
not ok 3 - 3. Reconciler guard cut: StatusReconciler never requests done or closes an issue
  ---
  error: StatusReconciler must ignore targetCol === "done" and not reconcile it
  expected: 0, actual: 1

# Subtest: 5. Agent instruction guard: DEFAULT_AI_ISSUE_PROMPT contains autonomous closure prohibition
not ok 5 - 5. Agent instruction guard: DEFAULT_AI_ISSUE_PROMPT contains autonomous closure prohibition
  ---
  error: DEFAULT_AI_ISSUE_PROMPT must explicitly forbid agents from closing or setting terminal status
  expected: true, actual: false
```
On post-fix commit `7c6fd33`, all 6 tests in `test/autonomous-closure.test.js` pass (6/6).

---

## 7. Build Parity & Clean Diff Verification

- **SHA-256 Parity:**  
  `panel/main.js` hash before fresh build: `d8724be557a753f58c0e5b4222f4632e3f530eea78a5711ce98a8d6a69cfc976`  
  `panel/main.js` hash after `npm run build`: `d8724be557a753f58c0e5b4222f4632e3f530eea78a5711ce98a8d6a69cfc976`  
  Result: **Byte-identical (100% build parity)**.
- **Agent Prompt Guard Line:**  
  `panel/core.ts:1846`: `"An agent never sets phase:done, phase:archive or status:done and never closes an issue."`  
  Result: Short (77 characters), zero emojis, exact keywords present.
- **Typecheck:** `npm run typecheck` PASS (0 errors).
- **Test Suite:** `npm test` PASS (491/491 tests green).
- **Scope Compliance:** Strictly confined to closure prevention, gesture plumbing, the single prompt line, tests, and documentation. No service or web files touched.
