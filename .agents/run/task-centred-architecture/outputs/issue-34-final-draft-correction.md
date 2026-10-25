# Final Draft Cache Correction & Isolation Report: Issue #34 Answer Integrity

**Target:** `panel/main.ts`, `panel/main.js`, `test/issue-34-answer-integrity.test.js`, `test/test-app-harness.js`  
**Base Commit:** `7f7e8cc`  
**Scope:** Strict Decision 14 answer draft isolation, repository scoping, recoverable orphan draft UI, and renderer layout decoupling  
**Date:** 2026-10-25  
**Status:** PASS / COMPLETE  

---

## 1. Executive Summary & Defect Root Causes

Following the initial hostile review of Issue #34 answer integrity remediation (`a8f55c2`), an audit of the in-memory draft cache (`questionAnswerDrafts`) uncovered four critical isolation and state leakage defects:

1. **Cross-Repository Draft Contamination & Deletion (Hypotheses A1 & A2):**
   - *Root Cause:* `saveQuestionDraft`, `getQuestionDraft`, and `clearQuestionDraft` took only `issueNumber: number` and keyed entries as `${issueNumber}::${questionText}` and `issue::${issueNumber}` without repository qualification.
   - *Consequence:* In multi-repo environments (All Projects mode or switching repositories), any two issues sharing the same number (e.g., `#1` on `owner/repo-a` and `#1` on `owner/repo-b`) shared draft state. Typing a draft on Repo A populated Repo B's answer input, and cancelling or submitting on Repo B permanently destroyed Repo A's draft.

2. **Intra-Issue Question Contamination & Fallback Wiping (Hypotheses B1 & B2):**
   - *Root Cause:* A generic fallback key `issue::${issueNumber}` was written whenever any question draft was saved.
   - *Consequence:* On issues with multiple questions ($Q_1, Q_2$), typing an answer to $Q_1$ caused $Q_2$ to mount open prefilled with $Q_1$'s text. Furthermore, cancelling or submitting $Q_2$ deleted `issue::${issueNumber}`, destroying the fallback for $Q_1$ and causing permanent draft loss if $Q_1$ was remotely modified.

3. **Silent Draft Attribution & Trapped Orphan Drafts (Hypothesis C):**
   - *Root Cause:* Stale answers were silently prefilled into changed question text without indicating provenance. If all questions were deleted remotely (0 questions remaining), `renderQuestionsView` rendered `No open questions` (`empty-box`), leaving the draft invisible and permanently trapped in memory.

4. **Renderer Global Preference Mutation (Hypothesis D):**
   - *Root Cause:* Direct execution of `renderHumanTasksView` and `renderQuestionsView` collaterally assigned `userLayoutPreference = 'human'` and `userLayoutPreference = 'questions'` and mutated `document.body` `data-layout`.
   - *Consequence:* Direct renderer calls unintentionally overrode global layout preferences and broke view isolation.

---

## 2. Decision 14 Architectural Principles & Implementation

Rather than adopting a fragile single-question fallback heuristic, Owner Decision 14 established a strict, robust isolation architecture:

1. **Strict Repository-Qualified Exact Keys:**
   - Keys are formatted strictly as `${repo}#${issueNumber}::${cleanQ}` via `repoForIssue(issue)`.
   - Unscoped issue number keys and coarse fallback keys (`issue::${issueNumber}`) were completely removed.
   - If `repoForIssue(issue)` cannot resolve a repository (unknown or missing repo), drafts are never saved, retrieved, or cleared.

2. **Exact Text Matching Only:**
   - Drafts only prefill when the current question text matches the draft's source question text exactly.
   - Drafts are never auto-reassigned or prefilled into changed or replaced questions, even if only one question exists on the issue.

3. **Dedicated Recoverable Draft Element:**
   - When a question is remotely modified or deleted, the current question input remains empty.
   - Any surviving drafts on the issue that do not match currently open questions are rendered in a dedicated, clearly labelled recoverable draft component (`.recoverable-drafts-box`).
   - The UI displays the original question text (`Original question: "..."`), the preserved draft answer, a **Copy** button (using clipboard API with fallback), and a **Discard** button (`clearQuestionDraft`).
   - This component is mounted across all three question surfaces: Questions View (`renderQuestionsView`), Drawer Questions (`renderDrawerQuestions`), and Human Tasks View (`renderHumanTasksView`).

4. **Input Emptying Deletes Cached Drafts:**
   - When a user clears an input field (backspace to empty string), `saveQuestionDraft` deletes the draft entry immediately from `questionAnswerDrafts`.
   - Re-rendering the view will never resurrect a previously cleared draft.

5. **Decoupled View Renderers:**
   - Removed all `userLayoutPreference` and `data-layout` mutations from `renderHumanTasksView` and `renderQuestionsView`.
   - Layout mode selection remains strictly managed by user action toolbar handlers via `applyLayoutMode()` and `renderViews()`.

6. **Preservation of All 7 Prior Issue #34 Protections:**
   - Non-4xx ambiguous transport errors classify as UNKNOWN (`outcome unknown — check the issue on GitHub`).
   - Unconfirmed write locks prevent dependent writes on ambiguous issues until fresh reload reconciles state.
   - Button/input disabling and `inFlightQuestions` guards prevent duplicate clicks and double PATCH requests.
   - Exact source targeting and duplicate detection prevent misdirected writes.
   - Notification and toast failures remain isolated in error boundaries and cannot roll back committed writes.
   - Dependency management checks write outcomes before toasting success.
   - Human-only close guards (#36) remain fully enforced.

---

## 3. Red Baseline & Green Verification Evidence

### Red Baseline (Before Fix: Commit `7f7e8cc`)
Executed dedicated regression probe suite `verifications/issue-34-final-draft/draft-isolation-regression.test.js`:
- Captured log: `verifications/issue-34-final-draft/red.log`
- Assertions failed: **7 of 7 failed**
  - Desired A1 (Cross-repo identical text isolation): FAILED (Repo B prefilled with Repo A draft)
  - Desired A2 (Cross-repo different text isolation): FAILED (Repo B prefilled via issue fallback)
  - Desired B1 (Intra-issue Q1/Q2 isolation & cancel immunity): FAILED (Q2 prefilled with Q1 draft)
  - Desired C1 (Emptying input deletes draft without resurrection): FAILED (Resurrected stale draft)
  - Desired C2 (Changed question leaves input empty, renders recoverable UI): FAILED (Silent prefill)
  - Desired C3 (Deleted question renders recoverable draft): FAILED (Trapped in memory, empty-box rendered)
  - Desired D1 (Direct renderers do not mutate layout preference): FAILED (Mutated layout preference)

### Green Verification (After Fix)
- Executed dedicated regression probe suite `verifications/issue-34-final-draft/draft-isolation-regression.test.js`:
  - Captured log: `verifications/issue-34-final-draft/green.log`
  - Assertions passed: **7 of 7 passed (100%)**
- Executed core answer integrity test suite `node --test test/issue-34-answer-integrity.test.js`:
  - Assertions passed: **26 of 26 passed (100%)**
- Executed full test suite `npm test`:
  - Assertions passed: **517 of 517 passed (100%)**
- Executed typecheck `npm run typecheck`:
  - Output: **0 errors**
- Executed build `npm run build`:
  - Output: Clean esbuild IIFE build (`panel/main.js`, 645.3kb)
  - SHA-256 Bundle Checksum: `0ec437c5e6a5b2d4d63b53c3ced634a992357b4ac2e73ba9ca4f82fe40c3dc8a`

---

## 4. Modified Files

- `panel/main.ts`: Strict repository-scoped draft caching, removal of coarse fallbacks, recoverable draft UI component, and renderer layout decoupling.
- `panel/main.js`: Compiled client bundle matching `panel/main.ts`.
- `test/test-app-harness.js`: Test harness extensions exposing draft helpers and user layout preference accessors.
- `test/issue-34-answer-integrity.test.js`: Updated Test 18 for Decision 14 recoverable draft behavior; added comprehensive Decision 14 isolation tests (A1, A2, B1, C1, C2, C3, D1).
- `verifications/issue-34-final-draft/draft-isolation-regression.test.js`: Dedicated Decision 14 regression probe suite.
- `verifications/issue-34-final-draft/red.log`: Captured 7-failure baseline log.
- `verifications/issue-34-final-draft/green.log`: Captured 7-pass verification log.
- `.agents/run/task-centred-architecture/outputs/issue-34-final-draft-correction.md`: This report.
