# Independent Hostile Review: Issue #34 Answer Integrity Fix

**Review Target:** Diff `dd5cb2f..309f9f1` (Branch `fix/issue-34-answer-integrity`)  
**Base Commit:** `dd5cb2f`  
**Builder Commit:** `309f9f1`  
**Date:** 2026-10-24  
**Reviewer:** Independent Subagent (Adversarial Hostile Review)  

---

## 1. Two-Verdict Statement
- **Spec Compliance:** `PARTIAL`  
  *Justification:* Core question resolution and exact source-text matching were fixed, resolving the 4 primary reproduction paths. However, ambiguous outcome handling violates the brief requirement: `status >= 400` and all 5xx server errors / regex matches are incorrectly treated as explicit rejections rather than ambiguous outcomes, local state rollback leaves unconfirmed stale state prone to silent overwrite, and typed answers do not survive refusal across any of the 3 UI entry points.
- **Quality:** `NEEDS-FIXES`  
  *Justification:* 7 ranked defects identified in the diff, including missing double-click / re-entry guards, unchecked `updateIssueBody` return values causing false success toasts in dependency management, wrong-question reporting on refusal when multiple questions exist, and fragile post-mutation notification error handling.

---

## 2. Independent Verification & Reproduction

### 2.1 Base Reproduction (`dd5cb2f`)
Re-executed tests against base commit `dd5cb2f` logic:
- **Path (a) Wrong-question fallback:** Reproducible. `resolveOptimisticQuestionAnswer` matched completed questions and passed that index to `answerOpenQuestionInMarkdown`, modifying an unrelated question or corrupting markdown.
- **Path (b) False success toasts:** Reproducible. Both Questions View and Drawer submitted answers and toasted success without checking `result.found`.
- **Path (c) Failed fresh reload proceeding on stale cache:** Reproducible. `reloadIssueBeforeMutation` logged a warning and returned `null`, but callers ignored the return value and proceeded with the stale cached body.
- **Path (d) Failed PATCH retaining optimistic body:** Reproducible. `updateIssueBody` updated local issue body optimistically and never reverted local issue state on PATCH rejection.

### 2.2 Builder Commit Verification (`309f9f1`)
- **Targeted Test Suite (`test/issue-34-answer-integrity.test.js`):** 12/12 passing.
- **Full Test Suite (`npm test`):** 501/503 passed under heavy load (2 timing-threshold benchmarks flaked on CPU load: `scale-and-adversarial` and `stage1-dual-mode`), 503/503 passed cleanly when executed in isolation.
- **Typecheck (`npm run typecheck`):** 0 errors.
- **Build (`npm run build`):** Clean build.
- **Bundle Parity (`panel/main.js`):** SHA-256 matches fresh build identically:  
  `3d8483d4938cae4c894a9c6c88dd61d4841041423332e6f44f1dc9b51df3066d`

---

## 3. Ranked Findings & Defect Analysis

### Finding 1 [CRITICAL]: `isExplicitHttpRejection` misclassifies 5xx Server Errors and regex matches as definitive rejections
- **File:Line:** `panel/main.ts:2311-2325`
- **Concrete Interleaving:**
  `const isExplicitHttpRejection = Boolean((typeof err?.status === 'number' && err.status >= 400) || (typeof err?.statusCode === 'number' && err.statusCode >= 400) || /\b(?:API error:\s*|failed\s*\(?|HTTP\s*|status\s*:?\s*)(\d{3})\b/i.test(err?.message || ''));`
  When a write request is sent to GitHub, the write can be committed in the GitHub database, but a reverse proxy (e.g. host proxy, Cloudflare) or GitHub returns HTTP 500, 502 Bad Gateway, 503 Service Unavailable, or 504 Gateway Timeout. The regex `/\b(?:API error:\s*|failed\s*\(?|HTTP\s*|status\s*:?\s*)(\d{3})\b/i` matches ANY 3-digit status code (including 500, 502, 504), and `err.status >= 400` includes all 5xx codes.
- **Observed Behavior:**
  The error is classified as an explicit rejection (`isExplicitHttpRejection = true`). The system logs `Failed to sync body` and toasts `"Failed to update #${issue.number} on GitHub"`, completely suppressing `"outcome unknown — check the issue on GitHub"`. The user is falsely told the write failed, when it may have committed. This directly violates the brief contract: *"Do NOT accept status>=400 or matching error text as proof of rejection when the request may already have been applied."*
- **Minimum Correction:**
  Restrict explicit rejection strictly to HTTP 4xx client errors (`status >= 400 && status < 500`). 5xx server/gateway errors and unclassified error strings must route to the ambiguous outcome branch (`outcome unknown — check the issue on GitHub`).

---

### Finding 2 [CRITICAL]: Restoring un-authoritative `prevBody` on ambiguous write outcomes risks silent overwrite
- **File:Line:** `panel/main.ts:2298-2309`
- **Concrete Interleaving:**
  When an ambiguous outcome occurs (transport timeout after send, 502/504 gateway timeout, or JSON parse failure after 200 OK headers), `updateIssueBody` catches the error and unconditionally resets `issue.body = prevBody;` in memory.
- **Observed Behavior:**
  Local state is restored to `prevBody` with no `unconfirmed` flag, no visual warning badge on the issue card/drawer, and no scheduled reconciliation. If the write committed on GitHub (e.g., socket closed after 200 OK headers sent), GitHub has the answer, but the client memory has `prevBody`. Any subsequent edit (subtask toggle, description edit) by user or agent will push `prevBody` and silently wipe GitHub's committed answer.
- **Minimum Correction:**
  Mark the issue as unconfirmed/diverged in state (`issue.unconfirmed = true`), surface an unconfirmed indicator in the UI, and block subsequent writes until fresh reload / reconciliation occurs.

---

### Finding 3 [IMPORTANT]: Typed answer does not survive question refusal across all three UI entry points
- **File:Line:** `panel/main.ts:2362-2370` (and `renderQuestionsView:4668`, `renderQuestions:6369`, `renderHumanTasksView:4085`)
- **Concrete Interleaving:**
  User types an answer into an inline input in Questions view, Drawer, or Human Tasks view, and submits. If the question was modified or answered remotely between opening the view and submitting, `answerQuestion` detects `!result.found` and immediately calls `renderViews()` and `renderDrawer(issue, true)`.
- **Observed Behavior:**
  `renderViews()` and `renderDrawer()` reset `innerHTML = ''` on the containers, destroying the active input elements. The user's typed text is discarded, and the answer row collapses (`display: none`). Although Decision D3 requires displaying the new question text so the user can answer again, the user cannot copy, view, or reuse their typed text; they must retype it from scratch.
- **Minimum Correction:**
  Do not wipe active inputs or preserve `answerText` in state/input upon refusal so the user can review and adapt their typed response against the new question text.

---

### Finding 4 [IMPORTANT]: Question change toast displays wrong question text when multiple open questions exist or a question is deleted
- **File:Line:** `panel/main.ts:2384-2391`
- **Concrete Interleaving:**
  An issue has two open questions: Q1 ("Cloud provider?") and Q2 ("Database?"). The user answers Q2. On GitHub, Q2 was deleted or modified to Q3.
  Lines 2385-2386 execute:
  `const currentOpen = parseOpenQuestions(freshBody).filter((q) => !q.completed);`
  `const currentText = currentOpen.length > 0 ? currentOpen[0].text : '';`
- **Observed Behavior:**
  `currentText` unconditionally selects `currentOpen[0].text` (Q1: "Cloud provider?"). The toast displays: `Question changed on #101. Current text: "Cloud provider?"`, falsely claiming Q2 changed into Q1.
- **Minimum Correction:**
  Do not assume `currentOpen[0]` is the changed question. If the specific question text is missing and multiple open questions remain, report that the question was removed or modified without attributing unrelated question text.

---

### Finding 5 [IMPORTANT]: Double-clicking "Save" sends duplicate PATCH requests and triggers spurious error toasts
- **File:Line:** `panel/main.ts:4749-4765`, `4150-4165`, `6435-6455`
- **Concrete Interleaving:**
  Rapid double-clicking or pressing Enter twice on the submit button in Questions view, Drawer, or Human Tasks view triggers concurrent executions of `answerQuestion`.
- **Observed Behavior:**
  The submit button and input are not disabled during async submission. Both calls issue GET and PATCH requests. If the first PATCH completes before the second's GET, the second call displays an error toast: `"Question on #... was already answered; refreshed."`, presenting a false error for the user's own successful action.
- **Minimum Correction:**
  Disable the submit button and input immediately on submit click/Enter (`btnSave.disabled = true`), or track an `isSubmitting` flag per question until completion.

---

### Finding 6 [IMPORTANT]: Dependency management call sites ignore `updateIssueBody` return value, showing false success toasts on failure
- **File:Line:** `panel/main.ts:5291-5294`, `5303-5306`
- **Concrete Interleaving:**
  In `handleAddDependency` and `handleRemoveDependency`, `await updateIssueBody(...)` is called.
- **Observed Behavior:**
  `updateIssueBody` was updated in 309f9f1 to return `boolean`. These callers ignore the return value. If `updateIssueBody` fails (e.g. 403 or network drop) and displays an error toast, the caller immediately displays a success toast: `"Linked #... as blocked by #..."` or `"Removed dependency: ..."`, showing conflicting success and error toasts for the same failed action.
- **Minimum Correction:**
  Check `const ok = await updateIssueBody(...); if (ok && host?.toast) { ... }`.

---

### Finding 7 [IMPORTANT]: Post-mutation notifications placed inside mutation write `try` block trigger false-failure rollback
- **File:Line:** `panel/main.ts:2293-2295`
- **Concrete Interleaving:**
  In `updateIssueBody`, `notifyAgentOnHumanTasksComplete(issue, repo)` is called inside the `try` block after `githubRequestWithRetry` and `finishWrite(true)` succeeded.
- **Observed Behavior:**
  If an unhandled exception occurs in `notifyAgentOnHumanTasksComplete`, control jumps to `catch (err)`: `updateIssueBody` marks `finishWrite(false)`, reverts `issue.body` to `prevBody`, and toasts an error, despite the mutation having successfully committed to GitHub.
- **Minimum Correction:**
  Move post-mutation notifications outside the mutation `try-catch` block or wrap them in an isolated `try-catch` that cannot trigger state rollback.

---

## 4. Verification Invariants & Boundaries
- **Workflow Phase & Issue Closure (#36):** Confirmed. Answering questions PATCHes `{ body: newBody }` only; labels, state, and #36 human-close guards remain untouched.
- **Exact Question Identity:** Confirmed. Matching compares raw markdown question text including link destinations and case without stripping.
- **Duplicate Unresolved Questions:** Confirmed. Matching multiple identical unresolved questions returns `reason: 'ambiguous'` and refuses to guess.
- **#31 Generation Counter Limit:** Accepted by owner decision 9; absence of generation counter in this bugfix is expected.
- **Harness Scope:** Synthetic DOM harness verification passed; installed-host E2E remains NOT RUN; human validation remains pending.
