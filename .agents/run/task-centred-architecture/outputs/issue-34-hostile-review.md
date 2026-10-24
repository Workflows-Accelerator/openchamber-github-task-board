# Hostile Review Report: Issue #34 Answer Integrity

## Two-Verdict Statement
- **Spec Compliance:** `PARTIAL`
- **Quality:** `NEEDS-FIXES`

---

## Executive Summary
Commit `309f9f1` successfully resolved the primary defect paths (a)-(d) from `dd5cb2f`: it eliminated the cross-question index corruption in `resolveOptimisticQuestionAnswer`, unified the three UI entry points (`QuestionsView`, `Drawer`, `HumanTasksView`) into `answerQuestion`, enforced a mandatory fresh reload before mutation, and rolled back local issue state upon PATCH rejection.

However, hostile verification identified multiple defects and specification deviations:
1. **Critical Ambiguity Violation:** Post-send 5xx server/gateway errors (500, 502, 503, 504) are falsely classified as explicit HTTP rejections instead of ambiguous unknown outcomes (`status>=400` check and regex directly violate the brief).
2. **Decision D3 Multi-Question Regression:** When an issue has multiple questions and a non-first question is modified or deleted remotely, the toast blindly displays `currentOpen[0].text`, attributing the change to an unrelated question.
3. **Shared Helper False Success:** Callers of `updateIssueBody` in `handleAddDependency` and `handleRemoveDependency` do not inspect the return boolean, emitting false success toasts even when `updateIssueBody` returns `false`.
4. **Unconfirmed Ambiguous State:** Local body restored to `prevBody` on ambiguous transport loss has no unconfirmed marker and allows immediate un-reconciled dependent writes.
5. **Double-Click Race Condition:** UI submit buttons lack pending disable guards, causing rapid double clicks to issue duplicate PATCH mutations and duplicate toasts.

---

## Verification of Builder Claims
- **Original Reproduction Paths (a)-(d):** Verified red-before and green-after across `test/issue-34-answer-integrity.test.js`.
- **Full Test Suite:** 503/503 passing (`npm test`).
- **TypeScript:** 0 errors (`npm run typecheck`).
- **Bundle Parity:** SHA-256 matches fresh build identically:
  `3d8483d4938cae4c894a9c6c88dd61d4841041423332e6f44f1dc9b51df3066d`
- **Issue #36 Guards:** Intact. Only body is mutated; status transitions and human gesture constraints remain untouched.
- **Issue #31 Scope:** Issue revision binding and hash generation counter are absent as future scope per owner decision 9.

---

## Ranked Hostile Findings

### Finding 1: Post-Send 5xx and Gateway Errors Falsely Treated as Explicit HTTP Rejection
- **Severity:** High / Blocker for PROCEED
- **Location:** `panel/main.ts:2312-2325`
- **Concrete Input / Interleaving:**
  GitHub API or intermediate reverse proxy returns HTTP 500, 502, 503, or 504 on `PATCH /repos/.../issues/...`.
- **Observed Output:**
  ```ts
  const isExplicitHttpRejection = Boolean(
    (typeof err?.status === 'number' && err.status >= 400) ||
    (typeof err?.statusCode === 'number' && err.statusCode >= 400) ||
    /\b(?:API error:\s*|failed\s*\(?|HTTP\s*|status\s*:?\s*)(\d{3})\b/i.test(err?.message || '')
  );
  ```
  `isExplicitHttpRejection` evaluates to `true` for any status >= 400 or matching 3-digit error code. The app toasts `"Failed to update #${issue.number} on GitHub"`.
- **Specification Deviation:**
  The brief explicitly mandated:
  > *"Unknown outcomes: response-header success then body-read drop, proxy/SDK 5xx after commit, transport timeout after send and failed readback. Do NOT accept status>=400 or matching HTTP text as proof of rejection: potentially post-send 5xx/parse errors are UNKNOWN unless proven otherwise. No automatic repeat."*
  Because 5xx server or gateway errors occur after request transmission where the server transaction may have committed before crashing, the remote state is unknown.
- **Minimum Correction:**
  Narrow explicit rejection strictly to client 4xx status codes (`status >= 400 && status < 500`). Any 5xx status or unclassified error must route to the ambiguous outcome branch: `"outcome unknown — check the issue on GitHub"`.
- **Proof:** Verified in `verifications/issue-34/adversarial-review.test.js` (Test 1).

---

### Finding 2: Decision D3 "Changed Question" Toast Displays Wrong Question on Multi-Question Issues
- **Severity:** Moderate
- **Location:** `panel/main.ts:2381-2391`
- **Concrete Input / Interleaving:**
  Issue has multiple open questions (e.g. Question 1: Database?, Question 2: Cloud?, Question 3: Port?). User answers Question 3. While typing, Question 3 is modified remotely (or deleted remotely while Questions 1 and 2 remain).
- **Observed Output:**
  `currentOpen[0]` is evaluated:
  ```ts
  const currentOpen = parseOpenQuestions(freshBody).filter((q) => !q.completed);
  const currentText = currentOpen.length > 0 ? currentOpen[0].text : '';
  const msg = currentText
    ? `Question changed on #${issue.number}. Current text: "${currentText}"`
    : `Question on #${issue.number} is no longer open; refreshed.`;
  ```
  The toast displays: `Question changed on #... Current text: "Question 1: Database?"`.
- **Specification Deviation:**
  Misleading user feedback violates Decision D3: the user is told that Question 3 changed into Question 1, rather than seeing the updated Question 3 or an accurate notification.
- **Minimum Correction:**
  Match target question text against remote questions using text similarity or historical index. If the question was deleted or cannot be correlated, report `"Question on #${issue.number} is no longer open; refreshed."` rather than picking `currentOpen[0]`.
- **Proof:** Verified in `verifications/issue-34/adversarial-review.test.js` (Test 2).

---

### Finding 3: `handleAddDependency` and `handleRemoveDependency` Emit False Success Toasts on Write Rejection
- **Severity:** Moderate
- **Location:** `panel/main.ts:5291-5295` and `5303-5307`
- **Concrete Input / Interleaving:**
  User adds or removes a dependency blocker. `updateIssueBody` fails (returns `false`).
- **Observed Output:**
  ```ts
  await updateIssueBody(targetIssue, newBody);
  if (host?.toast) {
    await host.toast({ kind: 'info', message: `Linked #${targetNum} as blocked by #${blockerNum}` });
  }
  ```
  The caller ignores the returned boolean `false`. The user sees the error toast from `updateIssueBody` followed immediately by the success toast `"Linked #... as blocked by #..."`.
- **Minimum Correction:**
  Check `const ok = await updateIssueBody(targetIssue, newBody, { suppressToast: true });` and only toast success if `ok` is `true`.
- **Proof:** Verified in `verifications/issue-34/adversarial-review.test.js` (Test 3).

---

### Finding 4: Unconfirmed Local State After Ambiguous Write Allows Un-Reconciled Dependent Writes
- **Severity:** Moderate
- **Location:** `panel/main.ts:2297-2311`
- **Concrete Input / Interleaving:**
  Transport drops after send. Outcome is unknown. `updateIssueBody` catches error and sets `issue.body = prevBody`.
- **Observed Output:**
  The local issue is restored to `prevBody` without any unconfirmed indicator or lock. If a subsequent mutation is performed (e.g., editing description, toggling a checkbox), it mutates against `prevBody`, clobbering what GitHub may have persisted.
- **Minimum Correction:**
  Flag issue with `unconfirmed: true` or invalidate freshness cache so subsequent mutations require reconciliation before proceeding.

---

### Finding 5: Double-Click Race Condition Triggers Duplicate PATCH Mutations and Toasts
- **Severity:** Moderate
- **Location:** `panel/main.ts:4161-4164`, `4762-4765`, `6458-6461`
- **Concrete Input / Interleaving:**
  User rapidly clicks "Save" / "Answer" twice.
- **Observed Output:**
  Because the button is not disabled during asynchronous execution, two concurrent requests run. Both read the open question, both issue PATCH requests to GitHub, and two success toasts are emitted.
- **Minimum Correction:**
  Disable the submit button upon click and re-enable in a `finally` block.
- **Proof:** Verified in `verifications/issue-34/adversarial-review.test.js` (Test 4).

---

### Finding 6: User-Typed Answer Destroyed on Refusal or Error
- **Severity:** Low / UX
- **Location:** `panel/main.ts:2307`, `2353`
- **Concrete Input / Interleaving:**
  PATCH fails or question is refused because remote text changed.
- **Observed Output:**
  `renderViews()` and `renderDrawer()` re-render DOM elements, resetting the `<input>` element and discarding what the user typed.
- **Minimum Correction:**
  Preserve user input in the form control or state so the user does not have to retype upon refusal.

---

## Verification Evidence & Logs
- `verifications/issue-34/adversarial-review.test.js` (4 tests covering Findings 1, 2, 3, 4)
- `verifications/issue-34/adversarial-review.log`
- `verifications/issue-34/full-suite.log` (503 passing unit tests)

## Scope Boundaries & Unverified Items
- **L3 Installed Host:** NOT RUN (synthetic DOM test harness only; real OpenChamber container iframe execution requires live host deployment).
- **Live GitHub API:** NOT RUN (probed via mock host SDK proxy; real rate limits and network latency unverified).
- **Human Acceptance:** Pending review by owner/manager.
