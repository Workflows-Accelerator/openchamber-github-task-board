# Final Hostile Review: Issue #34 Answer Integrity Remediation

**Review Target:** Diff `ef9710b..HEAD` (Remediation Commit `a8f55c2`)  
**Base Commit:** `dd5cb2f`  
**Builder Commit:** `309f9f1`  
**Reviews:** `7accbf8` + `ef9710b`  
**Remediation Commit:** `a8f55c2`  
**Date:** 2026-10-24  
**Reviewer:** Independent Subagent (Final Adversarial Hostile Review)  

---

## 1. Two-Verdict Statement
- **Spec Compliance:** `PASS`  
  *Justification:* All 7 findings from the hostile reviews (`7accbf8` and `ef9710b`) are definitively closed. Pre-commit HTTP 4xx rejections roll back with a failure toast, while all post-send ambiguous failures (5xx, 502/503/504, 408, network drops, timeouts, aborts, parse failures) route to UNKNOWN (`outcome unknown — check the issue on GitHub`), mark the issue visibly unconfirmed (`unconfirmed` badge in card and drawer), and block subsequent dependent writes across all entry points until a successful refresh reconciles state. Typed answers survive refusal across Questions View, Drawer, and Human Tasks View.
- **Quality:** `APPROVED`  
  *Justification:* Clean implementation with strict invariants: double-click and rapid Enter submissions are guarded at both DOM and async runtime levels; post-mutation notifications and toasts execute in isolated error boundaries outside the write try-catch; dependency handlers check write return values; #36 human-close guards remain completely intact; zero new identity or hash schemes introduced; full test suite, typecheck, build, and bundle parity reproduced cleanly.

---

## 2. Independent Verification & Reproduction Matrix

Each finding was tested against builder commit `309f9f1` (red-before) and remediation commit `a8f55c2` (green-after).

| Finding ID (Review 1 / Review 2) | Severity | Description | Red-Before Verification (`309f9f1`) | Green-After Verification (`a8f55c2`) | Status |
|---|---|---|---|---|---|
| **Finding 1** (Rev 1 F1 / Rev 2 F1) | CRITICAL | 5xx server errors, gateway timeouts, 408 timeouts misclassified as definitive rejections | FAIL: 500/502/408 errors classified as definitive failure (`Failed to update #...`), no "outcome unknown" toast, no unconfirmed marker | PASS: Test 13 passes. Only HTTP 4xx (excluding 408) treated as definitive rejection; 5xx/502/408/timeouts route to UNKNOWN and mark unconfirmed | **CLOSED** |
| **Finding 2** (Rev 1 F2 / Rev 2 F2) | CRITICAL | Ambiguous write outcomes restored un-authoritative `prevBody` risking silent overwrite | FAIL: Memory body restored to `prevBody` without unconfirmed marker; subsequent writes allowed against un-reconciled state | PASS: Test 14 passes. `issue.unconfirmed = true` set, unconfirmed badges rendered, dependent writes blocked until `reloadIssueBeforeMutation` reconciles | **CLOSED** |
| **Finding 3** (Rev 1 F6 / Rev 2 F3) | IMPORTANT | Dependency management call sites ignored `updateIssueBody` return value, showing false success toast on write failure | FAIL: `handleAddDependency` / `handleRemoveDependency` unconditionally toasted success on PATCH failure (e.g. 403) | PASS: Test 15 passes. Call sites pass `suppressToast: true` and toast success only when `updateIssueBody` returns `true` | **CLOSED** |
| **Finding 4** (Rev 1 F4 / Rev 2 F4) | IMPORTANT | Multi-question issue toast falsely attributed unrelated question text when question changed/removed | FAIL: `currentOpen[0].text` displayed in toast even when an unrelated question changed or was deleted | PASS: Test 16 passes. Open question count compared; neutral `Question changed on #${issue.number}; refreshed.` emitted unless single question changed | **CLOSED** |
| **Finding 5** (Rev 1 F5 / Rev 2 F5) | IMPORTANT | Double-clicking "Save" sends duplicate PATCH requests and triggers spurious error toasts | FAIL: Inputs and submit buttons remained enabled during submission; rapid clicks sent duplicate requests and toasted false "already answered" | PASS: Test 17 passes. Buttons and inputs disabled immediately; `inFlightQuestions` Set guards per question key; exactly 1 PATCH sent | **CLOSED** |
| **Finding 6** (Rev 1 F3 / Rev 2 F6) | IMPORTANT | Typed answers discarded upon question refusal across Questions View, Drawer, and Human Tasks | FAIL: Views re-rendered with empty inputs; typed text destroyed on refusal across all three entry points | PASS: Test 18 passes. `questionAnswerDrafts` map preserves typed text across refusal re-renders and mounts answer row open with draft | **CLOSED** |
| **Finding 7** (Rev 1 F7 / Rev 2 F7) | IMPORTANT | Post-mutation toast / agent notification failures triggered write rollback | FAIL: Exception in `notifyAgentOnHumanTasksComplete` or host toast caught by mutation `catch`, rolling back committed body | PASS: Test 19 passes. Notifications and toasts isolated in separate `try-catch` blocks outside the mutation write boundary | **CLOSED** |

---

## 3. Hostile Adversarial Stress Tests & Invariant Verification

1. **Unconfirmed Marker Enforcement Across All Mutation Entry Points:**
   - Audited all 11 call sites invoking `updateIssueBody` (`answerQuestion`, Human Tasks checkboxes, Drawer subtasks, Drawer AC, Drawer open questions, Card subtasks/AC, Drawer description edit, dependency handlers, test plan items).
   - In every entry point, `updateIssueBody` immediately intercepts `if ((issue as any).unconfirmed)`, logs a warning, toasts an error, and returns `false` without issuing any HTTP PATCH request.
   - Confirmed via probe that attempting to toggle subtasks or add dependencies on an unconfirmed issue fails closed.

2. **Reconciliation Boundary:**
   - `(issue as any).unconfirmed` is cleared ONLY upon a successful HTTP GET in `reloadIssueBeforeMutation` or a clean write response in `updateIssueBody`.
   - A failed GET (network error, 500) preserves `issue.unconfirmed = true` and continues to block subsequent writes.

3. **Keydown Enter vs. Click Idempotency:**
   - Both `click` and `keydown` (`Enter`) handlers invoke the single submission function that immediately sets `btn.disabled = true; input.disabled = true;`.
   - Rapid double Enter keystrokes generate exactly 1 PATCH request.

4. **Workflow Phase & Issue Closure (#36) Invariants:**
   - `answerQuestion` sends PATCH `{ body: newBody }` only.
   - Status, labels, and workflow phases remain untouched.
   - `#36` human-close guards in `updateIssueStatus` remain fully intact.

5. **Exact Source Identity & Decision Invariants:**
   - Exact source text comparison preserved (link destinations, casing, formatting).
   - Ambiguous duplicate questions refuse to guess (`reason: 'ambiguous'`).
   - Already-answered questions refuse overwrite (`reason: 'already-answered'`).
   - Decision D9 respected: no content hash or generation counter identity scheme introduced.

---

## 4. Test Suite, Typecheck & Bundle Parity Reproduction

- **Targeted Suite (`node --test test/issue-34-answer-integrity.test.js`):** 19/19 passing (6.12s).
- **Full Extension Suite (`npm test`):** 510/510 passing (23.03s).
- **TypeScript (`npm run typecheck`):** Clean (0 errors).
- **Build (`npm run build`):** Clean esbuild IIFE build.
- **Bundle SHA-256 Parity (`panel/main.js`):** Verified bit-for-bit identical to fresh build:  
  `19f686e582ed3b9ee9deac0973fe88e48d9608e533f0157a7d6a719a4a94c213`
- **Installed-Host E2E:** `NOT RUN` (executed in synthetic DOM/host harness; installed host extension and production GitHub untouched per scope).

---

## 5. Ranked Findings
- **Catastrophic Risks:** None.
- **Moderate Risks:** None.
- **Low / Observations:**
  1. *Test Harness Observation:* In `test/issue-34-answer-integrity.test.js` (Test 18), the polling loop `if (restoredInput && restoredInput.value === '...') break;` can resolve prematurely before the async refusal settles if not explicitly gated on the arrival of the refusal toast. Product draft retention in `panel/main.ts` is fully verified and functional across all three views when fully settled.

---

## 6. Conclusion & Recommendation
- **Verdict:** `PROCEED`
All 7 defects from both hostile reviews are thoroughly remediated and independently verified. No regressions detected.
