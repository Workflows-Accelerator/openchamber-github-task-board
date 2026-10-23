# Verification Proof: Issue #36 Autonomous Closure Prevention

## 1. Defect Investigation & Missing Condition
Investigation of the reported issue (autonomous closure when issue body carries `phase:done` or `phase:archive`) revealed that in pre-fix code, an issue with `phase:done` or `phase:archive` in the markdown body never triggered an automatic closure PATCH request.
- **Root Cause / Missing Condition**:
  1. The issue body has no V2 phase parser in the panel reconciler pipeline;
  2. `StatusReconciler` in `panel/labels.ts` delegates to `panel/labels.ts:resolveIssueColumn`, which only inspects GitHub issue `state` and labels (`status:*`), without evaluating body `phase:*` markers.
  3. Pre-fix code DID, however, allow automatic closure if an open issue carried legacy labels `done`, `closed`, or `state_reason: 'completed'`, or if any internal un-signaled call invoked `updateIssueStatus(issue, 'done')`.

## 2. Implemented Defense
1. **Reconciler Guard (`panel/labels.ts`)**:
   - `StatusReconciler.reconcile` strictly ignores any resolved `targetCol === 'done'`, guaranteeing that automatic status reconciliation never requests `'done'` or triggers issue closure.
2. **Explicit Human Gesture Requirement (`panel/main.ts`)**:
   - `updateIssueStatus` requires `options?.isHumanGesture === true` when `targetColumn === 'done'`. Any un-signaled autonomous call is dropped and logs a warning: `Blocked automatic closure of #<num>: closing requires human gesture`.
   - All legitimate human closure paths (moving card to Done via Next button, Kanban column drop / priority drop, dependency graph checkbox, drawer toggle close/reopen, and drawer status select) explicitly pass `{ isHumanGesture: true }`.
3. **Agent Instruction Guard (`panel/core.ts`)**:
   - Added zero-emoji rule to `DEFAULT_AI_ISSUE_PROMPT`:
     `An agent never sets phase:done, phase:archive or status:done and never closes an issue.`

## 3. Verification Log Artifacts
- `verifications/issue-36/autonomous-closure.log`: 6 targeted tests demonstrating reproduction check, automatic closure cut, reconciler guard, human gesture preservation, agent prompt guard, and non-terminal status reconciliation.
- `verifications/issue-36/full-suite.log`: 491/491 full suite test execution passing with 0 failures.
