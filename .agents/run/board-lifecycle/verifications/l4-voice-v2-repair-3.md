# L4 Hostile Review: OpenChamber V2 Compatibility & Rate-Limit Repair (Repair 3)

**Target Repository:** `/workspace/extensions/chambervoice`  
**Commits Reviewed:** `a5ddb77..a7e3ac9`  
- `a7e3ac9` (`fix(v2): skip non-input external form fields in replyQuestion and question normalization (Finding 1)`)  
**Base Commit:** `a5ddb77` (`docs(voice-v2): add reproduction, repair log, and test evidence for repair 2`)  
**Branch:** `fix/v2-ratelimit-repair`  
**Review Type:** Independent Read-Only Hostile Adversarial Review (L4)  
**Host Environment:** OpenChamber v2.0.4, OpenCode v2.0.21, Node.js v22.23.3, Linux x86_64  
**Date:** October 2026  
**Auditor:** Independent Dynamic Subagent (L4 Hostile Reviewer)  
**Supporting Artifacts Directory:** `/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-3-l4/`  

---

## 1. Executive Verdict & Summary

### **OVERALL VERDICT: PROCEED**

Repair 3 surgically addresses the single residual defect identified in the Repair 2 hostile review (`Finding 1: Form Field Type "external" Rejection`):
1. **Non-Input External Form Field Skip (`service/host-client.ts:913-915, 938-940, 1079-1080`):**
   - `@opencode/protocol` (`form.d.ts:124-130`) specifies `type: "external"` for informational URL display items that do not take user answers.
   - In `normalizeQuestionRequest`, external fields are filtered out (`.filter((f) => f && f.type !== 'external')`) so they are never presented as answerable question prompts to the voice agent or end user.
   - In `replyQuestion`, `inputFields` filters out external fields prior to iterating over user answer slots. User answer index `i` maps strictly to `inputFields[i]`. Forms containing external fields alongside input fields (single-choice, integer, multiselect, string, boolean) can now be answered via voice without throwing `HostClientError: Unsupported form field type "external"`.
   - External fields consume zero answer slots, preventing misalignment when external fields appear at the beginning, middle, or end of a form.
2. **Object-Format Answer Sanitization (`service/host-client.ts:1056-1065`):**
   - If an external field key is supplied in an object-format answer payload, it is pruned (`delete answerObj[k]`) before the request is dispatched to `POST /api/session/:sessionID/form/:formID/reply`.
3. **ToolExecutor Bundling Harmony (`service/tool-executor.ts:1168-1170, 1202-1205`):**
   - Because `pending.questions` derives from `normalizeQuestionRequest`, its length reflects only real input fields. The multi-question bundling guard (`providedCount < expectedCount`) accurately validates against the count of input questions, preventing false rejections of user voice submissions.

Independent adversarial scratch testing confirmed the red baseline on `a5ddb77` (both `3 !== 2` question count mismatch and `UNSUPPORTED_FORM_FIELD` error). Green resolution is empirically verified at `HEAD` (`a7e3ac9`). A collateral sweep confirms zero regression across all 9 Repair 1 and 3 Repair 2 fixes.

---

## 2. Component Verdict & Delta Audit

| # | Item / Finding | Base State (`a5ddb77`) | Repaired State (`a7e3ac9`) | Verdict | Status & Verification |
|:---:|---|---|---|:---:|---|
| **1** | **Finding 1: Form Field Type `"external"` Rejection** | Omitted `"external"` from whitelist at line 1078; included external links in `normalizeQuestionRequest`; threw `UNSUPPORTED_FORM_FIELD`. | Filters `f.type !== 'external'` in `normalizeQuestionRequest` and `replyQuestion`; prunes external keys from object answers; preserves slot alignment. | **PROCEED** | Verified via scratch extraction red baseline and green resolution. Adversarial permutation harness confirms alignment for start, middle, and end positions. |

---

## 3. Hostile Defect Register & Resolution Status

### Finding 1: Form Field Type `"external"` Rejection in `replyQuestion`
- **File & Line:** `service/host-client.ts:913-915, 938-940, 1056-1065, 1079-1080`
- **Severity:** MEDIUM (PREVIOUSLY BLOCKED VOICE ANSWERING OF FORMS WITH INFORMATIONAL LINKS)
- **Protocol Contract:** `@opencode/protocol/dist/groups/form.d.ts:124-130` (`type: "external"` display elements).
- **Resolution:**
  - `normalizeQuestionRequest`: prunes external fields from `pending.questions`.
  - `replyQuestion`: filters `inputFields = formFields.filter(f => f && f.type !== 'external')` before answer-slot mapping; deletes external keys from object-format answers.
- **Status:** **RESOLVED (VERIFIED GREEN)**

---

## 4. Empirical Evidence & Verification Audit

### A. Full Gate Verification Suite
- **Command:** `npm run verify` (`tsc --noEmit && npm test`)
  - **Result:** **PASS (Exit 0)**
  - **Test Summary:** **460 passed**, 0 failed, 60 test suites, duration 19.7s.
  - **TypeScript:** `tsc --noEmit` exited 0 with 0 errors.
- **Command:** `npm run build`
  - Output Assets:
    - `panel/main.js`: 100kb (**0 bytes diff** against `a5ddb77`)
    - `live/main.js`: 74kb (**0 bytes diff** against `a5ddb77`)
    - `live/worklet.js`: 1.6kb (**0 bytes diff** against `a5ddb77`)
    - `service/main.js`: 315kb (surgical bundle updates matching `service/host-client.ts`)
  - **Working Tree State:** `git status` clean, no unstaged changes.

### B. Independent Red Baseline Reproduction Against Base `a5ddb77`
Executed via scratch archive extraction of `a5ddb77` into `/tmp/antigravity/scratch_a5ddb77`:
1. **Normalization Test:**
   - Failure: `External field must be excluded from pending questions: 3 !== 2`.
   - Reason: `normalizeQuestionRequest` mapped `docs_link` into `pending.questions`.
2. **Reply Submission Test:**
   - Failure: `HostClientError: Unsupported form field type "external" for field "docs_link"` (code: `UNSUPPORTED_FORM_FIELD`).
   - Reason: `replyQuestion` evaluated `docs_link` against the input field whitelist and threw.

### C. Green Resolution Verification at HEAD `a7e3ac9`
- `test/v2-ratelimit-repair.test.js` executed directly:
  - `Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest`: **PASS (3.7ms)**.
  - All 23 tests in `v2-ratelimit-repair.test.js` passed in 72.0ms.

### D. Adversarial Permutation Stress Test
An independent Node.js harness evaluated forms with external fields placed:
1. At index 0 (before input fields).
2. In the middle (between two input fields).
3. At the end (trailing input fields).
4. Multiple external fields simultaneously.
5. Polluted object-format answer records.

**Result:** All permutations passed. In all cases, input fields mapped to sequential answer slots without shifts, and external keys were excluded from the wire payload.

### E. Collateral Sweep of All 12 Prior Repairs
All prior repairs remain intact:
1. **Permission Normalization:** PASS (V2 `action`/`resources` mapped to `permission`/`patterns`).
2. **Multiselect Detection:** PASS (Array formatting and `multiple: true` intact).
3. **Empty V2 Route Lists:** PASS (Returns terminal `null` without querying legacy V1 routes).
4. **Form Field Key Hallucination:** PASS (Throws `SCHEMA_UNAVAILABLE` before network dispatch).
5. **Option Value vs Label Mapping:** PASS (Labels translated to machine values; duplicate collisions flagged).
6. **Cursor Pagination:** PASS (Traverses pages; cyclic cursors throw `INVALID_CURSOR`).
7. **Direct Model Lookup:** PASS (Direct `GET /api/session/:id` bypassing directory listings).
8. **Issue #17 Collision Guarantee:** PASS (Sequential searches across open and closed issues detect collisions).
9. **Cache Generation & In-Flight Races:** PASS (In-flight reads completing after `clearCache` discarded).
10. **Integer Form Field Validation (Repair 2):** PASS (Accepts 42, rejects 42.5 and non-numeric strings).
11. **Dead V1 Route Probes Elimination (Repair 2):** PASS (Direct V2 reply POST; rethrows typed `NOT_FOUND`).
12. **Multi-Repo Aggregate Cache Poisoning Guard (Repair 2):** PASS (Guarded aggregate cache on repo failure; retries failed repos).

### F. Read-Only Live Host Probes (`127.0.0.1:3000`)
- `listGlobalSessions()` traversed **1,376 sessions** across 28 pages in **1,391 ms** with zero cyclic errors.
- `getSessionModel()` direct lookup on `ses_f270c21cdffe35Uy1c26spUrvS` returned `{ providerID: '9router', modelID: 'genius' }` via single `GET /api/session/:id`.
- Negative entity lookup: `getPendingPermission` and `getPendingQuestion` on non-existent sessions returned `null` without calling legacy V1 routes.

---

## 5. Test Oracle Matrix (Production vs Mock Classification)

- **Test Audited:** `test/v2-ratelimit-repair.test.js:218-318` (`Finding 1 (Repair 3)`).
- **Classification:** **Real Production Execution (HTTP Transport Boundary Interception)**.
- **Audit Verification:**
  - Instantiates real `HostClient` from `service/main.js`.
  - Invocations call real `getPendingQuestion`, `normalizeQuestionRequest`, and `replyQuestion` (both array and object formats).
  - Only network wire transport is intercepted via `fetchImpl`. Zero simulated methods or tautological passes.

---

## 6. Positive Proof Gap (NOT RUN)

- **Status:** **NOT RUN**
- **Justification:** The local loopback host (`127.0.0.1:3000`) is the live developer's instance, sharing persistent SQLite storage (`opencode.db`). Creating synthetic sessions or submitting live replies on the shared host would pollute developer state. Wire serialization and validation are verified at the HTTP transport boundary in test suites; real browser voice interaction is deferred to human validation (L5) on the preview deployment.

---

## 7. Actionable Conclusion

- **Verdict:** **PROCEED**
- All 13 items across Repairs 1, 2, and 3 are verified and defect-free.
- No further code changes are required on branch `fix/v2-ratelimit-repair`.
- Ready for integration and human validation (L5).
