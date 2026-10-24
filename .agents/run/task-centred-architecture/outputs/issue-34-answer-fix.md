# Issue #34 Fix Report: Answer Integrity & Robust Question Resolution

## Overview & Defect Root Causes
Issue #34 addresses answering questions on GitHub issues through the task board UI, ensuring an answer either writes to the exact viewed question or fails visibly with clear diagnostic feedback, preventing false success toasts and misdirected writes.

Prior defects identified on dd5cb2f:
1. **Wrong-question fallback**: In `panel/core.ts`, `resolveOptimisticQuestionAnswer` fell back to matching among all questions (including completed ones), then passed that index to `answerOpenQuestionInMarkdown` which indexed only unresolved questions. This could attach an answer to an unrelated open question or corrupt the markdown.
2. **False success toasts**: In `panel/main.ts`, Questions view and Drawer submitted answers without verifying `result.found`. If the question had changed remotely or was not found, a success toast was still displayed.
3. **Stale write on failed fresh reload**: `reloadIssueBeforeMutation` returned `null` upon failure, and mutations proceeded against stale cached bodies.
4. **Local state corruption on failed write**: `updateIssueBody` applied optimistic updates locally before the PATCH succeeded and did not revert the local issue state on HTTP rejection.

## Reproduction (RED Phase)
All four reproduction paths were isolated and proven failing prior to patch application in `test/issue-34-answer-integrity.test.js`:
- **Path (a)**: `resolveOptimisticQuestionAnswer` claimed `found: true` on already-answered fallback and modified another question index.
- **Path (b)**: Questions view and Drawer showed "Recorded answer to question" toast even when `result.found` was `false`.
- **Path (c)**: Fresh reload failure continued to issue PATCH against cached stale body.
- **Path (d)**: Failed PATCH retained optimistic modified body in local issue state instead of rolling back to `prevBody`.

Captured red test log: `verifications/issue-34/red-tests.log`.

## Surgical Changes Applied
1. **`panel/core.ts` (`resolveOptimisticQuestionAnswer`)**:
   - Removed the broken fallback to completed questions.
   - Enforced exact, case-preserving match on source question text (including markdown link destinations and formatting).
   - Added duplicate detection: if multiple identical unresolved questions exist, returns `reason: 'ambiguous'` and refuses to guess.
   - Accurately checks whether target was already completed by stripping trailing `*(Answer: ...)*` suffix, returning `reason: 'already-answered'`.
   - Returns typed `ResolveQuestionAnswerResult { updatedBody, found, reason }`.

2. **`panel/main.ts` (`answerQuestion`, `updateIssueBody`, UI entry points)**:
   - Created unified `answerQuestion(issue, questionText, answerText)` helper shared across all three UI entry points: Questions View, Drawer Questions, and Human Tasks View.
   - Requires successful fresh reload via `reloadIssueBeforeMutation(issue)`; aborts visibly if fresh read fails.
   - Refuses write on mismatch, presenting owner Decision D3 semantics:
     - Already answered remotely: alerts user and refreshes view.
     - Ambiguous duplicates: alerts user and refuses to guess.
     - Changed question text: alerts user with the current remote question text.
   - Updated `updateIssueBody`:
     - Reverts local issue state (`body`, `subtasks`, `openQuestions`, `humanTasks`, `acceptanceCriteria`, `v2Metadata`) upon write rejection.
     - Differentiates explicit HTTP rejections (status >= 400 or HTTP error text) from ambiguous transport errors (network drop / fetch failure after send).
     - On ambiguous transport loss: toasts `"outcome unknown — check the issue on GitHub"`, never repeats automatically, and reconciles local state so it is never displayed as confirmed.
     - Retains all #36 workflow phase and status guards (only PATCHes body, never labels or status).

3. **Generated Bundle & Test Harness**:
   - Rebuilt `panel/main.js` via `npm run build`.
   - Extended `test/test-app-harness.js` with `focus`/`blur` stubs and proper host SDK error message formatting (`code` and `error` wire properties).
   - Added complete 12-test suite `test/issue-34-answer-integrity.test.js`.

## Verification & Proof
- **Failing tests before**: 4/4 paths reproduced red (`verifications/issue-34/red-tests.log`).
- **Targeted suite after**: 12/12 passing (`verifications/issue-34/green-tests.log`).
- **Full test suite**: 503/503 passing (`verifications/issue-34/full-suite.log`).
- **TypeScript**: `tsc --noEmit` clean (0 errors).
- **Bundle build**: Clean build, esbuild IIFE target chrome100.
- **Bundle parity**: SHA-256 matches fresh build identically:
  `3d8483d4938cae4c894a9c6c88dd61d4841041423332e6f44f1dc9b51df3066d`

## Hostile Review Notes & Invariants
- Zero atomic claims: all comments and UI strings follow best-effort semantics.
- No #31 content hash / generation scheme introduced; uses source question text and fresh GET before mutation.
- Closed issue #36 guards intact: status transitions remain untouched during question answering.
