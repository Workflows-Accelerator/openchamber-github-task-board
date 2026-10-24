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

## Hostile Review Findings Remediation Matrix

| Finding | Severity | Defect Description | RED Reproduction Test | Remediation Applied | GREEN Verification |
|---|---|---|---|---|---|
| **Finding 1** | CRITICAL | 5xx server errors, gateway timeouts, and regex matches misclassified as definitive rejections | `test/issue-34-answer-integrity.test.js` (Test 13) | Classified only HTTP 4xx (excluding 408) as definitive pre-commit rejections; all 5xx, 502/503/504, 408, network drops, and parse errors route to UNKNOWN | PASS (`verifications/issue-34/remediation-green.log`) |
| **Finding 2** | CRITICAL | Ambiguous write outcomes restored un-authoritative body risking silent overwrite | `test/issue-34-answer-integrity.test.js` (Test 14) | Reverted local state, marked `issue.unconfirmed = true`, added card/drawer unconfirmed warning badges, and blocked dependent writes until `reloadIssueBeforeMutation` reconciles | PASS (`verifications/issue-34/remediation-green.log`) |
| **Finding 3** | IMPORTANT | Dependency management call sites ignored `updateIssueBody` return, showing false success toast on write failure | `test/issue-34-answer-integrity.test.js` (Test 15) | Updated `handleAddDependency` and `handleRemoveDependency` to call `updateIssueBody(..., { suppressToast: true })` and only toast on confirmed success | PASS (`verifications/issue-34/remediation-green.log`) |
| **Finding 4** | IMPORTANT | Multi-question issue toast falsely attributed unrelated question text when question changed/removed | `test/issue-34-answer-integrity.test.js` (Test 16) | Checked open question counts; toasts neutral `Question changed on #${issue.number}; refreshed.` unless a single question unambiguously changed text | PASS (`verifications/issue-34/remediation-green.log`) |
| **Finding 5** | IMPORTANT | Rapid double-clicking Save sent duplicate PATCH requests and triggered false error toasts | `test/issue-34-answer-integrity.test.js` (Test 17) | Disabled submit button and input during submission across all three views; added `inFlightQuestions` guard per question key | PASS (`verifications/issue-34/remediation-green.log`) |
| **Finding 6** | IMPORTANT | Typed answers discarded upon question refusal across Questions View, Drawer, and Human Tasks | `test/issue-34-answer-integrity.test.js` (Test 18) | Preserved typed drafts in `questionAnswerDrafts` map across refusal re-renders and mounted/kept answer rows open | PASS (`verifications/issue-34/remediation-green.log`) |
| **Finding 7** | IMPORTANT | Post-mutation toast / agent notification failures triggered write rollback | `test/issue-34-answer-integrity.test.js` (Test 19) | Moved post-mutation toast and agent notification into isolated, non-throwing `try/catch` blocks outside the mutation write error boundary | PASS (`verifications/issue-34/remediation-green.log`) |

### Final Suite Metrics
- **Remediation Suite**: 19/19 passing (`node --test test/issue-34-answer-integrity.test.js`).
- **Full Extension Suite**: 510/510 passing (`npm test`).
- **Typecheck**: `tsc --noEmit` passed with 0 errors (`npm run typecheck`).
- **Bundle Parity**: Clean esbuild bundle `panel/main.js` with verified deterministic SHA-256 (`19f686e582ed3b9ee9deac0973fe88e48d9608e533f0157a7d6a719a4a94c213`).

