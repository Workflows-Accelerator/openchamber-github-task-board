# Hostile Final Review: Issue #34 Answer Draft Integrity & Decision 14 Correction

**Review Target:** Diff `7f7e8cc..eef57bd` (Candidate Commit `eef57bd`)  
**Base Commit:** `7f7e8cc` (Remediation base `a8f55c2`)  
**Scope:** Decision 14 draft cache isolation, repo scoping, recoverable orphan draft UI across three entry points, and layout preference decoupling  
**Date:** 2026-10-25  
**Reviewer:** Independent Subagent (Doubt-Driven Adversarial Review)  

---

## 1. Two-Verdict Statement

- **Spec Compliance:** `PASS`  
  *Justification:* All Decision 14 requirements and all draft isolation defects from `7f7e8cc` are cleanly closed. Draft keys are strictly scoped with `repoForIssue(issue)#${number}::${cleanQ}`. Issues with unknown repositories fail closed and never save or leak drafts. Cross-repo and intra-issue cross-talk are eliminated; clearing an input field immediately deletes the cache entry without resurrection. Stale answers are never prefilled into modified questions; instead, modified/deleted/already-answered source drafts are safely surfaced in a dedicated, clearly labelled recoverable draft component (`.recoverable-draft-box`) across Questions View, Drawer, and Human Tasks View with Copy and Discard actions. Direct renderer layout preference side effects are eliminated.
- **Quality:** `APPROVED`  
  *Justification:* Zero unnecessary abstractions or persistent architecture added; clean DOM and event lifecycle; strictly decoupled view renderers; all 7 prior Issue #34 safety guarantees preserved; Test 18 updated per explicit owner Decision 14; 100% test pass rate across suite (517/517), typecheck (0 errors), clean build, and verified bundle parity.

---

## 2. Independent Empirical Verification Matrix

Independent adversarial probe suite executed in `verifications/issue-34-draft-final-review/hostile-draft-isolation-audit.test.js` (11/11 passing tests, logged in `verifications/issue-34-draft-final-review/hostile-draft-isolation-audit.log`).

| Hypothesis / Requirement | Scenario / Adversarial Input | Observed Empirical DOM Result | Status |
|---|---|---|---|
| **H1: Cross-Repo Identical Text Isolation** | Repo A #1 and Repo B #1 share exact question text. Draft typed on A; open Drawer on B; cancel on B; answer on B; inspect A. | Repo B input mounts empty and closed; cancelling or submitting on Repo B leaves Repo A draft intact. | `PASS` |
| **H2: Cross-Repo Different Text Isolation** | Repo A #2 and Repo B #2 have distinct question text. Draft typed on A; open Drawer on B. | Repo B input mounts empty; coarse issue fallback eliminated; zero draft leakage across repos. | `PASS` |
| **H3: Intra-Issue Multi-Question Isolation** | Single issue with Q1 and Q2. Draft typed for Q1; check Q2; cancel Q2; answer Q2; verify Q1. | Q2 mounts closed and empty; cancel and submit on Q2 do not wipe Q1 draft. | `PASS` |
| **H4: Input Clearing Deletion & No Resurrection** | User types draft, then empties input (or inputs whitespace only); re-render Drawer. | `questionAnswerDrafts` deletes entry immediately; view re-render leaves input empty; no draft resurrection. | `PASS` |
| **H5: Remotely Changed Question Recovery** | Single question modified remotely on answer attempt. Refusal triggered. | Current question input remains empty; `.recoverable-draft-box` renders original question and draft; Copy toasts; Discard cleans DOM. | `PASS` |
| **H6: Remotely Deleted Questions (0 Open Questions)** | User types draft; question deleted remotely (0 open questions remaining). | Rendered across all 3 entry points: Questions View shows notice + draft box; Drawer shows empty notice + draft box; Human Tasks includes issue with draft box. Discard restores true empty state. | `PASS` |
| **H7: Already-Answered Question Recovery** | User types draft; remote question completed (`- [x]`). | Completed question excluded from open list; typed draft renders in recoverable draft UI with original question text. | `PASS` |
| **H8: Duplicate Exact Questions Ambiguity** | Two identical open questions on same issue. User answers one. | Refuses write (`reason: 'ambiguous'`); emits toast; no PATCH sent; draft preserved safely. | `PASS` |
| **H9: Unknown Repository Failure Closed** | Issue with empty repo string or undefined repo. | `getDraftKey` returns `null`; `saveQuestionDraft` does not store; no throw; no key collision across unknown repos. | `PASS` |
| **H10: View Layout Preference Decoupling** | Direct calls to `renderQuestionsView` / `renderHumanTasksView`. | Neither renderer mutates `userLayoutPreference` or `document.body` `data-layout`; toolbar clicks operate normally. | `PASS` |
| **H11: Prior Fix Smoke (7 Invariants)** | 500 error UNKNOWN + unconfirmed write lock; dependency 403; rapid double-click guard; toast failure error boundary. | All 7 prior fixes verified intact: 500 routes to UNKNOWN, blocks dependent writes until reload; double-click sends 1 PATCH; toast failure does not rollback body. | `PASS` |

---

## 3. Hostile Investigation & Invariant Verification

1. **Exact-Question Matching & Rejection of Heuristic Fallbacks:**
   - Candidate commit `eef57bd` removed all unscoped issue fallback keys (`issue::${issueNumber}`).
   - Even when an issue contains exactly 1 question, if the question text does not match the draft's source question, the draft is never prefilled into the active input.
   - This strictly adheres to Decision 14 ("Never auto-reassign to a changed/replaced question, even when only one open question exists").

2. **Recoverable Draft UI Lifecycle & Invariants Across 3 Entry Points:**
   - In Questions View (`renderQuestionsView`), Drawer (`renderQuestions`), and Human Tasks View (`renderHumanTasksView`), `renderRecoverableDraftsElement` mounts unsaved orphan drafts.
   - The UI includes `.recoverable-draft-badge` ("Recoverable Draft (Unsaved)"), the original question text, the monospace answer text, a Copy button, and a Discard button.
   - Clicking Discard calls `clearQuestionDraft(issue, draft.questionText)` which removes strictly that key and triggers clean re-render.
   - When 0 questions remain on an issue, `issuesWithQuestions` and `humanIssues` explicitly check `getRecoverableQuestionDrafts(issue).length > 0`, ensuring orphan drafts are never trapped or hidden behind empty-state banners.

3. **Decoupled View Renderers & Test Parity:**
   - Removal of `userLayoutPreference` and `data-layout` assignments from `renderHumanTasksView` and `renderQuestionsView` leaves layout switching exclusively to toolbar handlers via `applyLayoutMode()`.
   - Test 18 was properly updated to invoke `applyLayoutMode()` and assert the Decision 14 recoverable draft UI rather than the obsolete automatic prefill behavior. No tests were weakened.

4. **Security & Data Isolation:**
   - Cache keys use `${repo}#${issueNumber}::${cleanQ}`.
   - If `repoForIssue(issue)` is blank or unknown, `getDraftKey` returns `null`, preventing cross-tenant or unauthenticated collisions.
   - HTML injection in original question text is prevented via `escapeHtml()`, while answers are rendered via `textContent`.

---

## 4. Test Suite, Typecheck & Bundle Parity

- **Targeted Hostile Probe Suite (`verifications/issue-34-draft-final-review/hostile-draft-isolation-audit.test.js`):** 11/11 passed (2.01s).
- **Builder Regression Suite (`verifications/issue-34-final-draft/draft-isolation-regression.test.js`):** 7/7 passed (1.06s).
- **Core Answer Integrity Suite (`node --test test/issue-34-answer-integrity.test.js`):** 26/26 passed (4.90s).
- **Full Extension Suite (`npm test`):** 517/517 passed (20.63s).
- **TypeScript Typecheck (`npm run typecheck`):** Clean (0 errors).
- **Build (`npm run build`):** Clean esbuild IIFE build.
- **Bundle SHA-256 Checksum (`panel/main.js`):** Verified bit-for-bit identical to fresh build:  
  `0ec437c5e6a5b2d4d63b53c3ced634a992357b4ac2e73ba9ca4f82fe40c3dc8a`
- **Real Browser Render:** `NOT RUN` (no browser engine in container environment; distinguish from installed authenticated host E2E, synthetic DOM L2/L3 tested in node test harness).
- **Installed Host & Production GitHub E2E:** `NOT RUN` (synthetic DOM/host harness only; production GitHub untouched per scope).

---

## 5. Ranked Findings
- **Catastrophic Risks:** None.
- **Moderate Risks:** None.
- **Low / Observations:** None.

---

## 6. Conclusion & Recommendation
- **Verdict:** `PROCEED`
Candidate commit `eef57bd` fully satisfies Owner Decision 14 and closes all answer draft integrity and isolation defects with zero regressions.
