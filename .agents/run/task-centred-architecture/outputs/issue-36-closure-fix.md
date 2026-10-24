# Issue #36: Autonomous Closure Elimination Report

## Summary
Eliminated all autonomous paths that can set GitHub issue state to `closed`. Automatic issue closure is strictly prohibited; only explicit human gestures can transition an issue to `done` / `closed`. Legitimate human UI controls and non-terminal autonomous status reconciliation are fully preserved.

## Reproduction Analysis & Missing Condition
Per brief requirement 4, an investigation into autonomous closure triggered by `phase:done` or `phase:archive` in the issue body revealed:
- **Reproduction Result**: In pre-fix code, an issue whose markdown body contained `phase:done` or `phase:archive` did *not* trigger an automatic closure PATCH request.
- **Missing Condition Identified**:
  1. Panel status reconciliation lacks a markdown body phase parser;
  2. `StatusReconciler` in `panel/labels.ts` uses local `resolveIssueColumn(issue, session)`, which checks only `issue.state` and labels (`labels.includes('done')`, `status:*`), mapping idle sessions to `needs-human` rather than evaluating body `phase:*` tokens.
- Pre-fix code did, however, permit automatic closure if an open issue carried labels matching `done` or `closed`, or if any internal un-signaled code called `updateIssueStatus(issue, 'done')`.

## Changes Applied
1. **`panel/labels.ts` (Reconciler Guard)**:
   - Added `if (targetCol === 'done') continue;` inside `StatusReconciler.reconcile()`. The background reconciler will never emit `targetCol: 'done'` or request closure.
   - Added `if (issue.state === 'closed') continue;` to skip already-closed issues.
2. **`panel/main.ts` (Human Gesture Requirement)**:
   - Updated `updateIssueStatus(issue, targetColumn, options?: { newPriorityGroup?: string; isHumanGesture?: boolean })`:
     - If `targetColumn === 'done'` and `!options?.isHumanGesture`, the call is aborted and logged: `Blocked automatic closure of #${issue.number}: closing requires human gesture`.
   - Wired `{ isHumanGesture: true }` to all human interaction call sites:
     - Next button click on card (`btnNext.addEventListener`)
     - Kanban drag-and-drop & priority placement (`kanban-column` / `priority-bucket` drop handlers)
     - Graph card completion checkbox (`chk.addEventListener`)
     - Drawer status dropdown selection (`drawerStatusSelect.onchange`)
     - Drawer close/reopen toggle button (`elBtnDrawerToggleClose.onclick`)
3. **`panel/core.ts` (Agent Prompt Guard)**:
   - Appended one sentence to `DEFAULT_AI_ISSUE_PROMPT` (with zero emojis):
     `An agent never sets phase:done, phase:archive or status:done and never closes an issue.`
4. **`panel/main.js`**:
   - Rebuilt browser bundle via `npm run build:panel`.
5. **Tests**:
   - Created `test/autonomous-closure.test.js` validating:
     1. Investigation of body `phase:done` / `phase:archive` missing condition;
     2. Blocking of un-signaled `updateIssueStatus(issue, 'done')`;
     3. Strict reconciler guard preventing `done` targets;
     4. Human gesture preservation executing legitimate `state: 'closed'` PATCH requests;
     5. Agent prompt instruction guard presence;
     6. Preservation of non-terminal session status reconciliation (`in-progress`).
   - Updated simulated human gestures in `test/current-board.test.js` and `test/stage2a-attention-ui.test.js`.
   - Exported `statusReconciler` in `test/test-app-harness.js`.

## Verification Evidence
- `npm run typecheck`: PASS (0 errors).
- `npm run build`: PASS (`panel/main.js` 618.7kb, `service/main.js` byte-identical).
- `node --test test/autonomous-closure.test.js`: PASS (6/6 tests passing).
- `node --test test/current-board.test.js`: PASS (19/19 tests passing).
- `npm test`: PASS (491/491 tests passing, 0 failures).
- Proof artifacts recorded in `verifications/issue-36/autonomous-closure.log`, `verifications/issue-36/full-suite.log`, and `verifications/issue-36/verification-proof.md`.
