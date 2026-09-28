# Issue Body Contract v1 — canonical spec

Status: ALIGNED 2026-09-26 (decisions D1-D8). This spec is the single source of truth.
Canonical location: `docs/issue-body-contract.md` (versioned next to the parsers that enforce it). Consumers reference this document; the lifecycle skill and the AI issue prompt mirror it.

## 1. Purpose & consumers

An issue body is a database record. Four consumers read it:

1. The board panel (`panel/core.ts` parsers -> views, drawer, counts).
2. The lifecycle skill (team agents write bodies that satisfy this contract).
3. The AI issue prompt (`DEFAULT_AI_ISSUE_PROMPT` in `panel/core.ts` / `panel/main.ts` — instructs agents to produce exactly these sections; asserted by `test/ai-prompt.test.js`).
4. chambervoice (TaskboardManager / voice tools — future `human_todo` action).

## 2. Sections (in recommended order)

Every section is optional except Friendly Title and Overview. Parsers accept the exact spellings below (see `panel/core.ts` for current regexes).

### 2.1 `### Friendly Title:`
One line, 3-6 words, plain English, no jargon, no technical prefixes. It is the ONLY title shown in the simplified views (Human Tasks, All Tasks, Questions). The GitHub issue title may carry the technical slug (e.g. `feat(board): ...`) and is rendered as a mono subtitle. Parser: `parseFriendlyTitle` (`panel/core.ts`).

### 2.2 Overview
`**Overview:**` or `## Overview` heading followed by free text: what and why.

### 2.3 `### Acceptance Criteria:`
Checkboxes `- [ ]`. The definition of done, phrased testably. This is what the human validates at the Needs-Human gate.

### 2.4 `### Actionable Subtasks Checklist:`
Checkboxes `- [ ]`. The agent's own work steps (parse: `parseSubtasks`, `panel/core.ts`).

### 2.5 `### Open Questions:`
Checkboxes `- [ ]`, each phrased as a question needing human alignment. Items must be **self-contained prose** (chambervoice reads raw issue bodies over REST and sees no drawer metadata). Unchecked = unanswered. Answering writes the answer inline and checks the box (`answerOpenQuestionInMarkdown`, `panel/core.ts`). Unanswered questions appear in the Questions view REGARDLESS of the issue's status column.

### 2.6 `### Human Tasks:` (NEW in v1 — decision D1)
Checkboxes `- [ ]`. Each item is ONE concrete action a human must take. Rules:
- Verb first: "Approve ...", "Grant access to ...", "Answer: ...", "Review PR #N", "Merge ...", "Deploy ...", "Run ...".
- Resolvable by a human without further context in one sitting; written as **self-contained prose** (voice reads raw issue bodies over REST without drawer metadata).
- Written/updated by the agent AT THE MOMENT it blocks on a human or hands off for validation — not before, not after.
- Checked = the human did it. The agent may remove stale items once they no longer apply, but never checks a box on the human's behalf.
Parser: `parseHumanTasks` (`panel/core.ts`). Extraction: `collectHumanTodos` (`panel/core.ts`), see Section 3.

### 2.7 `## Test Plan (Issue)` / `## Test Plan (Batch)` and `Blocked by #N`
Existing conventions (test plans: `panel/main.ts` and `panel/core.ts`; dependency edges: `panel/core.ts` dependency parsing). Unchanged in v1.
- **Cross-repo dependencies**: Cross-repo dependencies must use **full URLs** (e.g. `Blocked by https://github.com/owner/repo/issues/123`), never `#N` shorthand which causes wrong-repo links.

## 3. Human to-do extraction — `collectHumanTodos(issue, session?)`

Output: ordered list of `{ text: string, source: 'human-task' | 'open-question' | 'session-waiting', done: boolean }`.

### Extraction Algorithm (Pseudo-Code)

```
function collectHumanTodos(issue, session?):
  body = extractIssueBody(issue)

  // 1. Unchecked ### Human Tasks: items first, in body order
  rawHumanTasks = issue.humanTasks or parseHumanTasks(body)
  uncheckedHumanTasks = filter(rawHumanTasks, item => not item.completed)
  if uncheckedHumanTasks is not empty:
    return deduplicatePreservingOrder(
      map(uncheckedHumanTasks, item => ({
        text: trim(item.text),
        source: 'human-task',
        done: false
      }))
    )

  // 2. If (1) is empty: unchecked ### Open Questions: items (source: open-question)
  rawQuestions = issue.openQuestions or parseOpenQuestions(body)
  uncheckedQuestions = filter(rawQuestions, item => not item.completed)
  if uncheckedQuestions is not empty:
    return deduplicatePreservingOrder(
      map(uncheckedQuestions, item => ({
        text: trim(item.text),
        source: 'open-question',
        done: false
      }))
    )

  // 3. If an attached agent session is in a waiting* state and (1)+(2) yield nothing:
  // one synthesized item from the waiting reason (source: session-waiting)
  activeSession = resolveSession(session, issue)
  if activeSession and isWaitingActivity(activeSession.activity):
    reason = trim(activeSession.waitingReason or activeSession.reason or "")
    if activeSession.activity == "waiting-permission":
      text = reason ? ("Agent waiting for permission: " + reason) : "Agent waiting for permission"
    else if activeSession.activity == "waiting-question":
      text = reason ? ("Agent waiting for question: " + reason) : "Agent waiting for question"
    else if activeSession.activity starts with "waiting-":
      kind = activeSession.activity.slice(8)
      text = reason ? ("Agent waiting for " + kind + ": " + reason) : ("Agent waiting for " + kind)
    else:
      text = reason ? ("Agent waiting: " + reason) : "Agent waiting"

    return [{
      text: text,
      source: 'session-waiting',
      done: false
    }]

  // 4. Dedupe identical texts; never fabricate items otherwise
  return []
```

Human to-do list scope (decision D3): every issue in `needs-human` (any waiting source) PLUS every unanswered open question in any status. The Questions view shows all open questions; the Human Tasks view shows `collectHumanTodos` for `needs-human` issues.

## 4. Status semantics v1 (decision D3)

Columns (`panel/types.ts`): draft, backlog, todo, planned, in-progress, in-review, needs-human, done.

- **draft** — passive ideas or notes awaiting drafting or alignment. Passive ideas stay in `status:draft` (they surface via the Questions view when questions exist).
- **in-progress** — agent session actively working.
- **in-review** — THE AI STEP: the agent is reviewing its own finished work (hostile review gate). Set by explicit `status:in-review` label. REWRITES the old meaning "awaiting human review or PR validation" (`panel/labels.ts`).
- **needs-human** — anything awaiting a human: permission, answers/alignment, or final validation. Issues actively blocked awaiting alignment sit in `status:needs-human` (not draft). This is the human work queue.
- **done** — validated by a human. No agent closes its own issue.

Auto-transitions (`panel/labels.ts`, reconciler `StatusReconciler`):
- session `waiting-permission` / `waiting-question` / any `waiting*` -> `needs-human` (unchanged).
- session `idle` -> `needs-human` (awaiting human validation or a human decision about the stalled session). CHANGED from `in-review` (`panel/labels.ts:403-468`).

## 5. Prompt contract

`DEFAULT_AI_ISSUE_PROMPT` must instruct agents to emit sections 2.1-2.6 with these exact spellings, including `### Human Tasks:` with verb-first items when blocking or handing off. `test/ai-prompt.test.js` asserts the required strings and ordering. Any change to this doc must land with matching parser + prompt + test changes in the same commit series.

## 6. Versioning

v1 = this file. Additions bump minor (v1.1), renames/removals bump major and must update parsers, prompt template, skill, and tests together.
