# Issue Body Contract v1.3 — canonical spec

Status: ALIGNED 2026-11-13 (v1.3 adds §2.9 human review artifacts and §2.10 waiting-state presentation; D1-D8 unchanged). This spec is the single source of truth.
Canonical location: `docs/issue-body-contract.md` (versioned next to the parsers that enforce it). Consumers reference this document; the lifecycle skill and the AI issue prompt mirror it.

## 1. Purpose & consumers

An issue body is a database record. Four consumers read it:

1. The board panel (`panel/core.ts` parsers -> views, drawer, counts).
2. The lifecycle skill (team agents write bodies that satisfy this contract).
3. The AI issue prompt (`DEFAULT_AI_ISSUE_PROMPT` in `panel/core.ts` / `panel/main.ts` — instructs agents to produce exactly these sections; asserted by `test/ai-prompt.test.js`).
4. chambervoice (TaskboardManager / voice tools — future `human_todo` action).

## 2. Sections (in recommended order)

Every section is optional at issue creation except Friendly Title and Overview (the `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence stating the work type and the concrete reason). Parsers accept the exact spellings below (see `panel/core.ts` for current regexes).

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

#### Preset answer options (optional)

A question may carry recommended answers. Put each recommendation on its own line directly after the question line, indented two spaces, in this exact form:

```markdown
## Open Questions
- [ ] Which database should we use for the audit trail?
  - PostgreSQL :: Mature and familiar :: **Operations stay unchanged**; `pg_dump` already works.
  - SQLite :: Zero operations :: A single file, but no concurrent writers.
```

Format rules (`parseWebOpenQuestions` in `web/server/board.ts` is the only parser for these option lines):

- `  - label :: gist :: details`: two spaces, a list marker (`-`, `*`, `+` or `1.`), the label, ` :: `, a one-line gist, then optional details. Only the label is required; the gist is one line; the details field is free Markdown and keeps any later ` :: ` separators.
- At most 8 options per question. Labels are at most 120 characters. An option with an empty label, or a label longer than 120 characters, is skipped.
- The option block ends at the first blank line, unindented line, indented code block or heading. A malformed line is skipped; when every line is invalid, the question falls back to the plain question with no options.
- A nested checklist item (`  - [ ] step`) is a subtask, not an option.
- Answering writes the answer inline and checks the box; the option lines stay in the body.

**Reconciliation with self-contained prose.** Option lines are recommendation metadata that the board renders; they are not part of the question's prose. The question must still read correctly as plain prose when the option lines are stripped, because chambervoice and every raw-body reader never see the drawer. The free-text answer path always stays valid: presets are suggestions, never a required choice, and every question must remain answerable in prose.

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

### 2.8 `### Work Log:` (NEW in v1.1 — decision D1 / issue #30)
Freeform execution log and evidence record. The `### Work Log:` section is optional at issue creation; once work starts, the Work Log must contain exactly one sentence stating the work type and the concrete reason for it (for example the observed behaviour that contradicts a stated expectation, or the desired outcome that does not exist yet). Keep it one line; do not add fields, counters or machine state to the issue body.

Rules:
- Existing `bug` and `enhancement` labels are the only work-type source.
- When both or neither are present, the work type is undecided and must be asked about, not guessed; never infer a type from the title, the mood of the report, or the area of the code.
- Never introduce a `type:*` label or a body work-type field.
- Proportionate paths:
  - Bug path: observed versus expected behaviour, reproduction evidence, cause, minimal regression-tested fix, hostile review.
  - Feature path: desired outcome, research and alternatives, user decisions, then implementation.
  - Both paths retain existing empirical proof and human authority over release and closure; never close an issue or claim human release approval.
- Questions: Only block work that depends on the unanswered question; independent authorised work continues. Undecided work type is an alignment question to the user, not a default.

### 2.9 `### Human Review:` — the only human gate (NEW in v1.3)

A task may sit in `status:needs-human` only when the human can settle it by clicking: a screenshot, a short video, a link, or a question with preset answers. The board reads exactly one section for this, following the same body-section convention as the canvas marker, notes and questions:

```markdown
### Human Review:
- Artifact: image
- URL: https://example.com/screenshots/login-empty.png
- Instruction: Compare the empty state with the approved mockup.
```

Format rules (`parseHumanReview` in `web/server/board.ts` is the only parser):

- The heading is `Human Review` at any level 1-6, case-insensitive, with an optional colon. The last such unfenced section wins.
- Fields are single-line list items `- Name: value`: `Artifact`, `URL`, `Instruction`. Blank lines and ordinary prose inside the section are ignored. Repeating a known field is malformed.
- `- Artifact:` is exactly `image`, `video`, `link` or `question`.
- `video` and `link` require `- URL: http://...` or `https://...` (at most 2048 characters) and a one-line `- Instruction:` of at most 200 characters saying what to look at. `image` requires an `https://...` URL because the board renders it inline under a CSP that allows only https images; an http image is refused with its precise reason instead of silently failing to load.
- `question` takes no URL. The artifact points at the first unanswered `### Open Questions:` item; that item's text is the instruction. Its `  - label :: gist :: details` preset lines (§2.5) render through the same V4-2 question renderer, with the same details disclosure and free-text answer path. At least one preset line is required: a question artifact with none is malformed (`missing_options`), because a typed answer is not a click. Answering the question settles the artifact: the task must then move back to the agent, and the board says so instead of showing a wait.
- A fenced or indented-code heading is not a section. A malformed artifact is reported with its precise reason, never silently accepted as a gate.
- The server rejects putting an issue into `status:needs-human` (at creation, through a status write, or by a body edit that would break an existing valid gate) with a 4xx `human_review_required` message naming the missing or malformed part. Nothing is written to GitHub in that case.
- Legacy data that already waits without a valid artifact stays visible as "waiting for an artifact" with the precise reason. It is never presented as a silent wait.

**Reconciliation with self-contained prose.** The section is gate metadata, not a second issue format, and it never replaces the human-readable body. For `image`, `video` and `link` the instruction must make sense on its own. For `question`, the `### Open Questions:` item must still read correctly as prose when the option lines are stripped, because raw-body readers (chambervoice, scripts, GitHub itself) never see the board. For a `question` artifact the presets are mandatory (at least one) and the free-text answer path stays available alongside them.

### 2.10 Waiting-state presentation (NEW in v1.3)

`status:in-review` means an agent is reviewing its own work; it asks nothing of the user and reads as "Agent reviewing" / "Agent en revue". `status:needs-human` is the only state that asks the user to decide, and only when §2.9 carries a ready artifact. The board presents the artifact inline (image), the one-line instruction and exactly one primary action per type: "Ouvrir la capture", "Regarder la vidéo", "Ouvrir le lien", "Répondre" (EN: "Open screenshot", "Watch the video", "Open the link", "Answer"). The gate and its panel are keyed on the canonical `status:needs-human` / `status:in-review` labels, which are what the server enforces; a task that only looks waiting through attention or session state keeps its existing badges and is never accused of a missing artifact. No new label was introduced for this distinction: the two existing status labels already carry the meaning, so the separation is presentation-level.

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

`DEFAULT_AI_ISSUE_PROMPT` must instruct agents to emit sections 2.1-2.6 with these exact spellings, including `### Human Tasks:` with verb-first items when blocking or handing off. It and `DEFAULT_AI_ALIGNMENT_PROMPT` also name the §2.5 preset-option convention so generated questions can carry recommendations while keeping a free-text answer path. `test/ai-prompt.test.js` asserts the required strings and ordering. Any change to this doc must land with matching parser + prompt + test changes in the same commit series.

## 6. Versioning

v1 = this file. Additions bump minor (v1.1), renames/removals bump major and must update parsers, prompt template, skill, and tests together.
v1.1 = adds Section 2.8 Work Log contract with single-line work-type justification and proportionate paths (decision D1 / issue #30).
v1.2 = documents preset answer options in Section 2.5 and their authoring prompts.
