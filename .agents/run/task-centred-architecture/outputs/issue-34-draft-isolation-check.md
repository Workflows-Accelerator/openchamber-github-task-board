# Independent Review & Verification: Issue #34 Draft Cache Isolation Check

**Target:** `panel/main.ts` (Commit `72f3f76`, Base `a8f55c2`)  
**Scope:** Answer draft cache isolation across repositories and questions (`saveQuestionDraft`, `getQuestionDraft`, `clearQuestionDraft` at lines 2268–2297 and all call sites)  
**Date:** 2026-10-25  
**Reviewer:** Independent Subagent (Doubt-Driven Hostile Verification)  

---

## 1. Two-Verdict Statement

- **Spec Compliance:** `FAIL`  
  *Justification:* The draft cache violates the multi-repository isolation model (Owner Decisions 11/12/13: "Board covers all repositories", writes routed by repository-qualified identity, no cross-repo contamination). Keys are formatted as `${issueNumber}::${questionText}` and `issue::${issueNumber}` without repository scoping via `repoForIssue`. Drafts leak across repositories sharing an issue number, leak across unrelated questions on the same issue via coarse issue fallback, and clearing/success on one repo/question destroys drafts belonging to another.
- **Quality:** `NEEDS-FIXES`  
  *Justification:* Destructive cross-talk occurs in common workflows: cancelling on Repo B deletes Repo A's draft; completing Q2 on a multi-question issue destroys the fallback for Q1; modified questions silently adopt stale answers from old questions without provenance or orphan indicators; and view renderers mutate global `userLayoutPreference` on direct execution.

---

## 2. Empirical Verification & Reproduction Matrix

Reproduced using real render functions and synthetic DOM host harness in `verifications/issue-34-draft/draft-isolation-probe.test.js` (6/6 passing probe assertions, logged in `verifications/issue-34-draft/draft-isolation-probe.log`).

| Hypothesis | Description | Empirical Result | Status |
|---|---|---|---|
| **Hypothesis A1** | Repo A #1 and Repo B #1 (identical question text): Draft typed on A pre-fills B; clearing on B deletes A's draft | **CONFIRMED DEFECT**: Typing draft on `owner/repo-a#1` populates `owner/repo-b#1`'s input; clicking Cancel on Repo B permanently wipes Repo A's draft. | `FAIL` |
| **Hypothesis A2** | Repo A #2 and Repo B #2 (different question text): Coarse fallback `issue::2` leaks draft from A to B | **CONFIRMED DEFECT**: Repo B Question Beta input is prefilled with Repo A Question Alpha draft `"Secret answer for Repo A"`. | `FAIL` |
| **Hypothesis B1** | Single issue with unrelated Q1 and Q2: Q1 draft pre-fills Q2; cancelling Q2 clears fallback, causing Q1 modified question to lose draft | **CONFIRMED DEFECT**: Q2 ("Launch date") mounts open with Q1 draft ("Postgres 16"); cancelling Q2 destroys `issue::10` fallback, permanently losing Q1 draft on remote revision. | `FAIL` |
| **Hypothesis B2** | Single issue with Q1 and Q2: Answering Q2 wipes `issue::11` fallback while leaving stale exact entry | **CONFIRMED DEFECT**: Completing Q2 PATCH clears `issue::11`; revised Q1 receives `undefined` while stale exact key `11::Q1` remains in memory. | `FAIL` |
| **Hypothesis C** | Question modified or deleted: Lack of orphan draft provenance / UI indicators | **CONFIRMED DEFECT**: Remotely modified question silently inherits old draft with zero orphan/provenance UI; deleted question leaves draft invisible and trapped in memory. | `NEEDS-FIXES` |
| **Hypothesis D** | Added `userLayoutPreference` assignments in `renderHumanTasksView` / `renderQuestionsView` | **CONFIRMED DEFECT**: Direct renderer execution permanently overwrites global `userLayoutPreference`, altering subsequent `renderViews()` output. | `NEEDS-FIXES` |

---

## 3. Hostile Investigation & Demonstrations

### Finding 1: Cross-Repository Contamination & Deletion (Hypotheses A1 & A2)
- **Root Cause:**
  `panel/main.ts:2268-2293`:
  ```typescript
  function saveQuestionDraft(issueNumber: number, questionText: string, answerText: string): void {
    const cleanQ = (questionText || '').trim();
    const cleanA = (answerText || '').trim();
    if (!cleanA) return;
    if (cleanQ) {
      questionAnswerDrafts.set(`${issueNumber}::${cleanQ}`, cleanA);
    }
    questionAnswerDrafts.set(`issue::${issueNumber}`, cleanA);
  }
  ```
  `saveQuestionDraft`, `getQuestionDraft`, and `clearQuestionDraft` take only `issueNumber: number`. Call sites across Questions View (`renderQuestionsView`), Human Tasks (`renderHumanTasksView`), Drawer (`renderQuestions`), and `answerQuestion` pass `issue.number` without passing `repoForIssue(issue)`.
- **Demonstrated Impact:**
  1. In All Projects mode or when switching repositories, any two issues sharing the same number (e.g., `#1`) share the draft cache.
  2. If a user types a draft in Issue #1 on Repo A, navigates to Repo B and opens Issue #1, the answer box mounts open with Repo A's draft.
  3. If the user on Repo B dismisses the prompt ("Cancel"), `clearQuestionDraft(1, ...)` deletes both `1::${questionText}` and `issue::1`, silently deleting Repo A's draft.
  4. If the question text differs between Repo A #2 and Repo B #2, Repo B #2 still pulls Repo A's draft via `issue::2` fallback.
- **Minimal Correction:**
  Scope cache keys with `repoForIssue(issue)`:
  `${repo}#${issueNumber}::${cleanQ}` and `issue::${repo}#${issueNumber}`.
  Pass `issue` (or `repoForIssue(issue)`) into `saveQuestionDraft`, `getQuestionDraft`, and `clearQuestionDraft`.

---

### Finding 2: Intra-Issue Question Leakage & Destruction (Hypotheses B1 & B2)
- **Root Cause:**
  To retain drafts across remote question modifications, `saveQuestionDraft` introduces a generic issue fallback `questionAnswerDrafts.set(\`issue::\${issueNumber}\`, cleanA);`.
  When an issue has multiple questions ($Q_1, Q_2$), `getQuestionDraft(issueNumber, "Q2 text")` falls back to `issue::${issueNumber}`, returning $Q_1$'s draft for $Q_2$.
- **Demonstrated Impact:**
  1. On an issue with multiple open questions, typing an answer to Question 1 causes Question 2's answer row to mount open prefilled with Question 1's text.
  2. When Question 2 is cancelled or successfully submitted, `clearQuestionDraft(issueNumber, "Q2 text")` executes `questionAnswerDrafts.delete(\`issue::\${issueNumber}\`)`.
  3. This wipes out the fallback for Question 1. If Question 1 is subsequently modified remotely, Question 1's draft cannot be recovered and is permanently lost.
- **Minimal Correction:**
  Fallback `issue::${repo}#${issueNumber}` should only be written and consulted if the issue contains exactly ONE question (`issue.openQuestions.length === 1`). When multiple questions exist on an issue, drafts must bind strictly to the specific question identity.

---

### Finding 3: Stale Attribution & Trapped Orphan Drafts (Hypothesis C)
- **Root Cause:**
  Current refusal and preservation logic in `answerQuestion` (lines 2472–2524) preserves the draft when a question changes remotely (`!result.found`), but the UI renders the refreshed question with the old draft directly in the input box without indication.
- **Demonstrated Impact:**
  1. If question text changes remotely (e.g., from "What is the timeout threshold?" to "What is the retry interval?"), the new question silently renders with the old draft pre-filled. The user is not notified that the draft was authored for a different question.
  2. If the question is deleted remotely (0 questions remaining on the issue), `renderQuestionsView` displays `No open questions` (`empty-box`). The draft is invisible in the DOM and trapped in the `questionAnswerDrafts` map.
- **Minimal Correction:**
  If a draft is loaded via fallback where exact text differs, render a small contextual notice ("Draft restored from previous question text") so the user can verify relevance before submitting. Do not fallback if multiple questions exist.

---

### Finding 4: Global Preference Mutation in View Renderers (Hypothesis D)
- **Root Cause:**
  Commit `a8f55c2` introduced:
  - `panel/main.ts:4033`: `userLayoutPreference = 'human';` inside `renderHumanTasksView`
  - `panel/main.ts:4674`: `userLayoutPreference = 'questions';` inside `renderQuestionsView`
- **Demonstrated Impact:**
  1. None of the other five view renderers (`list`, `kanban`, `graph`, `all-tasks`, `attention`) mutate `userLayoutPreference`.
  2. Direct invocation of `renderHumanTasksView` or `renderQuestionsView` mutates the global variable `userLayoutPreference` as a side effect.
  3. Subsequent calls to `renderViews()` switch the user permanently to `human` or `questions` view, overriding user preference (e.g. `auto` or `kanban`).
  4. In standard UI clicks, toolbar buttons (`elBtnViewHuman`, `elBtnViewQuestions`, etc.) already assign `userLayoutPreference` prior to calling `applyLayoutMode()`, making the internal renderer assignments redundant and harmful to isolation.
- **Minimal Correction:**
  Remove `userLayoutPreference = 'human';` and `userLayoutPreference = 'questions';` from inside `renderHumanTasksView` and `renderQuestionsView`.

---

## 4. Minimal Scope Remediation Guidance

No new storage engines, hashing schemes, or generation counters are required. The fix adheres to Decision D9:
1. **Cache Key Signature:**
   Change signatures from `(issueNumber: number, questionText: string, ...)` to `(repo: string, issueNumber: number, questionText: string, ...)`.
   Exact key format: `${repo}#${issueNumber}::${cleanQuestionText}`.
2. **Conditional Fallback:**
   Issue-level fallback key format: `issue::${repo}#${issueNumber}`.
   Set and consult `issue::${repo}#${issueNumber}` ONLY when `issue.openQuestions.length === 1`.
3. **Renderer Clean-up:**
   Remove `userLayoutPreference = 'human'` and `userLayoutPreference = 'questions'` from inside view render functions.

---

## 5. Artifacts & Evidence Files
- Probe source: `verifications/issue-34-draft/draft-isolation-probe.test.js`
- Probe test output log: `verifications/issue-34-draft/draft-isolation-probe.log`
