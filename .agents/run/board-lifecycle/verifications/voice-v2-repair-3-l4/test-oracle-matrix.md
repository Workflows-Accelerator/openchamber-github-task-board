# Test Oracle Matrix: Repair 3 Test Classification

**Commit Audited:** `a7e3ac9` (`fix(v2): skip non-input external form fields in replyQuestion and question normalization (Finding 1)`)  
**Test File:** `test/v2-ratelimit-repair.test.js` (lines 218-318)  
**Auditor:** Independent L4 Hostile Reviewer  

---

## 1. Classification Methodology

In accordance with the Doubt-Driven Development and Verification Levels discipline:
- **Real Production Execution:** The test invokes the real application classes (`HostClient`) through their public interfaces with production code paths executed. Interception is restricted to standard network boundaries (`fetchImpl`), with assertions validating real runtime state transformations.
- **Mock Double / Simulation:** The test asserts against hand-crafted mock objects or duplicate logic that does not execute the production code paths.

---

## 2. Test Audit: Finding 1 (Repair 3)

| Metric | Details |
|---|---|
| **Test Name** | `Finding 1 (Repair 3): Form field of type external is skipped in replyQuestion and normalizeQuestionRequest` |
| **Location** | `test/v2-ratelimit-repair.test.js:218-318` |
| **Target Functions** | `HostClient.getPendingQuestion`, `HostClient.normalizeQuestionRequest`, `HostClient.replyQuestion` |
| **Boundary Intercepted** | HTTP `fetchImpl` (intercepts wire `/auth/session`, `/api/sessions/status`, `/api/session/:id/form/:id/reply`) |
| **Code Paths Executed** | - `service/host-client.ts:913-915`: `raw.fields.filter(f => f && f.type !== 'external')`<br>- `service/host-client.ts:1056-1065`: `delete answerObj[k]` for external fields in object replies<br>- `service/host-client.ts:1079-1080`: `formFields.filter(f => f && f.type !== 'external')`<br>- `service/host-client.ts:1107-1110`: `Number.isInteger(num)` validation<br>- `service/host-client.ts:1124-1127`: spoken label to machine value mapping (`Staging` $\rightarrow$ `stg`) |
| **Assertions Checked** | 1. `pending.questions.length === 2`<br>2. `pending.questions[0].key === 'environment'`<br>3. `pending.questions[1].key === 'timeout_seconds'`<br>4. `replyRes.ok === true`<br>5. `capturedReplyBody.answer` deep equals `{ environment: 'stg', timeout_seconds: 60 }`<br>6. `'docs_link' in capturedReplyBody.answer === false`<br>7. `replyObjRes.ok === true`<br>8. Object format strips `'docs_link'` from submitted payload |
| **Classification** | **Real Production Execution** |

---

## 3. Test Oracle Assessment

- The test uses zero synthetic mocks or copied simulation methods.
- The test executes the exact production `HostClient` class from `service/main.js`.
- Both the array-input path (used by voice dialogue in `ToolExecutor`) and the object-input path (used by API / programmatic callers) are verified end-to-end.
- The test confirms that external fields do not consume answer slots and do not pollute the answer payload sent over the wire.
