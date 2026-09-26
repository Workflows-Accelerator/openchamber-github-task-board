# Issue Body Contract v1 — canonical spec

Owner: manager run `board-lifecycle` (ses_f22887e18ffem6RBrwgNhw5iNM).
Status: ALIGNED 2026-09-26 (decisions D1-D8). This spec is the single source of truth.
Publication target: `/workspace/extensions/github-task-board/docs/issue-body-contract.md`
(canonical home, versioned next to the parsers that enforce it). Consumers reference
that path; the lifecycle skill and the AI issue prompt must mirror it.

## 1. Purpose & consumers

An issue body is a database record. Four consumers read it:

1. The board panel (`panel/core.ts` parsers -> views, drawer, counts).
2. The lifecycle skill (team agents write bodies that satisfy this contract).
3. The AI issue prompt (`DEFAULT_AI_ISSUE_PROMPT` in `panel/main.ts` — must instruct
   agents to produce exactly these sections; asserted by `test/ai-prompt.test.js`).
4. chambervoice (TaskboardManager / voice tools — future `human_todo` action).

## 2. Sections (in recommended order)

Every section is optional except Friendly Title and Overview. Parsers accept the
exact spellings below (see `panel/core.ts:77-412` for current regexes).

### 2.1 `### Friendly Title:`
One line, 3-6 words, plain English, no jargon, no technical prefixes. It is the ONLY
title shown in the simplified views (Human Tasks, All Tasks, Questions). The GitHub
issue title may carry the technical slug (e.g. `feat(board): ...`) and is rendered as
a mono subtitle. Parser: `parseFriendlyTitle` (`core.ts:85`).

### 2.2 Overview
`**Overview:**` or `## Overview` heading followed by free text: what and why.

### 2.3 `### Acceptance Criteria:`
Checkboxes `- [ ]`. The definition of done, phrased testably. This is what the human
validates at the Needs-Human gate.

### 2.4 `### Actionable Subtasks Checklist:`
Checkboxes `- [ ]`. The agent's own work steps (parse: `parseSubtasks`, `core.ts:175`).

### 2.5 `### Open Questions:`
Checkboxes `- [ ]`, each phrased as a question needing human alignment. Unchecked =
unanswered. Answering writes the answer inline and checks the box
(`answerOpenQuestionInMarkdown`, `core.ts:223`). Unanswered questions appear in the
Questions view REGARDLESS of the issue's status column.

### 2.6 `### Human Tasks:` (NEW in v1 — decision D1)
Checkboxes `- [ ]`. Each item is ONE concrete action a human must take. Rules:
- Verb first: "Approve ...", "Grant access to ...", "Answer: ...", "Review PR #N",
  "Merge ...", "Deploy ...", "Run ...".
- Resolvable by a human without further context in one sitting.
- Written/updated by the agent AT THE MOMENT it blocks on a human or hands off for
  validation — not before, not after.
- Checked = the human did it. The agent may remove stale items once they no longer
  apply, but never checks a box on the human's behalf.
Parser: `parseHumanTasks` (new). Extraction: `collectHumanTodos` (new), see 3.

### 2.7 `## Test Plan (Issue)` / `## Test Plan (Batch)` and `Blocked by #N`
Existing conventions (test plans: `panel/main.ts:3761` region; dependency edges:
`core.ts` dependency parsing). Unchanged in v1.

## 3. Human to-do extraction — `collectHumanTodos(issue, session?)`

Output: ordered list of `{ text, source: 'human-task' | 'open-question' | 'session-waiting', done }`.

1. Unchecked `### Human Tasks:` items first, in body order.
2. If (1) is empty: unchecked `### Open Questions:` items (source `open-question`).
3. If an attached agent session is in a `waiting*` state and (1)+(2) yield nothing:
   one synthesized item from the waiting reason (source `session-waiting`), e.g.
   "Agent waiting for permission: <reason>".
4. Dedupe identical texts; never fabricate items otherwise.

Human to-do list scope (decision D3): every issue in `needs-human` (any waiting source)
PLUS every unanswered open question in any status. The Questions view shows all open
questions; the Human Tasks view shows `collectHumanTodos` for `needs-human` issues.

## 4. Status semantics v1 (decision D3)

Columns (`panel/types.ts:37`): draft, backlog, todo, planned, in-progress, in-review,
needs-human, done.

- **in-progress** — agent session actively working.
- **in-review** — THE AI STEP: the agent is reviewing its own finished work
  (hostile review gate). Set by explicit `status:in-review` label. REWRITES the old
  meaning "awaiting human review or PR validation" (`labels.ts:155`).
- **needs-human** — anything awaiting a human: permission, answers/alignment, or
  final validation. This is the human work queue.
- **done** — validated by a human. No agent closes its own issue.

Auto-transitions (`labels.ts:347-480`, reconciler `labels.ts:568-648`):
- session `waiting-permission` / `waiting-question` / any `waiting*` -> `needs-human`
  (unchanged).
- session `idle` -> `needs-human` (awaiting human validation or a human decision
  about the stalled session). CHANGED from `in-review` (`labels.ts:403-468`).

## 5. Prompt contract

`DEFAULT_AI_ISSUE_PROMPT` must instruct agents to emit sections 2.1-2.6 with these
exact spellings, including `### Human Tasks:` when blocking or handing off.
`test/ai-prompt.test.js` asserts the required strings. Any change to this doc must
land with matching parser + prompt + test changes in the same commit series.

## 6. Versioning

v1 = this file. Additions bump minor (v1.1), renames/removals bump major and must
update parsers, prompt template, skill, and tests together.
