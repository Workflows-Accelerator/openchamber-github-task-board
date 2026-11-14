# Extension design — Work Status section, sidebar marks, agent text

Status: DESIGN ONLY. No source file was edited, no service was restarted, no
GitHub call was made. This document is written so implementation is transcription.

Read for this design:

- `openchamber-extensions` skill (status section, marks, instructions/skills recipes).
- `node_modules/@openchamber/sdk/API.md` and `GUEST_SERVICES.md` (SDK 2.7.1).
- `node_modules/@openchamber/sdk/dist/parse.js` and `status-view-schemas.js`
  (the parser is newer than `API.md`; see §9).
- `.agents/run/chamberos-board-v2/verifications/extension-audit/README.md`.
- `.worktrees/team-dev-board-v3/verifications/usability-audit-2026-11-13/README.md`
  (the brief's path is relative to that worktree; the file is absent in this one).
- `docs/issue-body-contract.md` as shipped on `master` (v1.3, with §2.9 Human
  Review). The working-tree copy is v1.1 and lags `master`; §9 records that.

The three surfaces serve the audit's top findings: three different "needs me"
counts (finding 2), progress invisible outside the drawer (finding 3), and the
owner's verdict that the board is scary even for them. The design adds no new
count definition: it reuses the board's unified `needsMe` predicate (D44.2).

---

## 1. Data the section reads

### 1.1 One snapshot, pushed by the panel

The service does not fetch GitHub. The panel already holds the issue list, the
dependency graph and the session list. After every successful board load it
posts one snapshot to the service:

```
POST /snapshot
{
  "directory": "/workspace/code/openchamber-github-task-board" | null,
  "at": 1763136000000,
  "needsMe": 8,
  "running": 2,
  "blocked": 1,
  "progress": { "done": 12, "total": 40 },
  "top": { "repo": "owner/repo", "number": 123, "title": "Fix the parser" } | null
}
```

- `directory` is the project directory the panel was opened from; `null` means
  the All Projects board.
- The service keeps the last snapshot per `directory` key, in memory only.
  `service.keepRunning: true` (required by marks) keeps the process alive, so a
  file is unnecessary. After a service restart the section is empty until the
  panel publishes again; that is the truthful empty state, not a stale guess.
- `GET /status?directory=...` picks the snapshot for that exact directory, else
  the `null` (All Projects) snapshot, else answers the empty state.
- `GET /status` also carries `locale`. The service answers in French when the
  tag starts with `fr` (case-insensitive: `fr`, `fr-FR`, `fr-CA`), English
  otherwise. Every label and value below exists in both languages; the row
  shape is identical.

### 1.2 Exact computation (no new definitions)

| Field | Rule |
|---|---|
| `needsMe` | Count of issues in the snapshot where `stage != 'done'` and (`stage == 'needs-human'` or `attention != 'none'` or open human tasks > 0 or open questions > 0). This is the board's existing unified predicate (`needsMe` / `needsHumanAttention`, D44.2). Do not add a second definition. |
| `running` | Count of sessions in the panel's session state with `activity === 'running'` (the audit's filter, `main.ts` sessions state). |
| `blocked` | Count of issues with `dependencyState === 'blocked-by-dependency'` and `stage != 'done'`. Dependency-only, matching the existing "Blocked by dependencies" filter, never the human queue. |
| `progress.done` | Count of issues with `stage === 'done'`. |
| `progress.total` | Count of issues in the snapshot (the panel loads `state=all`, so closed issues are present). |
| `top` | First issue of the `needsMe` set, sorted by the panel's existing priority weight descending (critical/urgent 4, important/high 3, useful/medium 2, optional/low 1, none 0), then issue number descending. `repo` is `owner/repo`; `title` is the GitHub title. |

---

## 2. The six rows

Order is fixed. Six rows, limit 16. No row action is proposed (see §2.3).

| # | `kind` | `id` | EN label | FR label | Value rule | `dot` |
|---|---|---|---|---|---|---|
| 1 | `line` | `needs-me` | Needs me | À traiter | `N task` / `N tasks`; `Nothing waiting` at 0 | `warning` if N > 0, else `success` |
| 2 | `line` | `top` | Next task | Prochaine tâche | `owner/repo#N Title`, truncated to 80 chars; `No task needs you` when none | `warning` if present, else `success` |
| 3 | `line` | `progress` | Progress | Avancement | `D of T done`; `No tasks yet` when T = 0 | `default` |
| 4 | `line` | `running` | Running agents | Agents en cours | `N running`; `None` at 0 | `success` if N > 0, else `muted` |
| 5 | `line` | `blocked` | Blocked by dependencies | Bloquées par des dépendances | `N task` / `N tasks`; `None` at 0 | `error` if N > 0, else `success` |
| 6 | `note` | `age` | — | — | §3.3 | — |

Value strings, exactly:

| Situation | EN | FR |
|---|---|---|
| needs-me, 1 | `1 task` | `1 tâche` |
| needs-me, 2+ | `8 tasks` | `8 tâches` |
| needs-me, 0 | `Nothing waiting` | `Rien en attente` |
| top, present | `owner/repo#123 Fix the parser` | same (repo and title are data) |
| top, none | `No task needs you` | `Aucune tâche ne vous attend` |
| progress, T > 0 | `12 of 40 done` | `12 sur 40 terminées` |
| progress, T = 0 | `No tasks yet` | `Aucune tâche` |
| running, 1 | `1 running` | `1 en cours` |
| running, 2+ | `2 running` | `2 en cours` |
| running, 0 | `None` | `Aucun` |
| blocked, 1 | `1 task` | `1 tâche` |
| blocked, 2+ | `2 tasks` | `2 tâches` |
| blocked, 0 | `None` | `Aucune` |

- French uses the singular for 0 and 1, the plural from 2.
- The top value is truncated so the whole `value` string is at most 80
  characters (the SDK's `value` limit): cut the title, append `...`. The full
  repository is kept in the prefix, not shortened. If `owner/repo#N` alone is
  longer than 80 characters, use the repository's last path segment instead.
- The progress bar is `content: { kind: "bar", value: <0-100 integer> }` where
  `value = Math.round(done / total * 100)`, or `0` when `total = 0`.
- Row 2 carries the only click-through: `content: { kind: "chips", chips: [
  { id: "issue", label: "#123", url: "https://github.com/owner/repo/issues/123" } ] }`.
  The chip opens the GitHub issue. It is present only when `top` is non-null.

### 2.1 Live example (EN), example values not shipped data

```json
{ "rows": [
  { "kind": "line", "id": "needs-me", "label": "Needs me", "value": "8 tasks", "dot": "warning" },
  { "kind": "line", "id": "top", "label": "Next task",
    "value": "owner/repo#123 Fix the parser", "dot": "warning",
    "content": { "kind": "chips", "chips": [
      { "id": "issue", "label": "#123", "url": "https://github.com/owner/repo/issues/123" } ] } },
  { "kind": "line", "id": "progress", "label": "Progress", "value": "12 of 40 done",
    "content": { "kind": "bar", "value": 30 } },
  { "kind": "line", "id": "running", "label": "Running agents", "value": "2 running", "dot": "success" },
  { "kind": "line", "id": "blocked", "label": "Blocked by dependencies", "value": "1 task", "dot": "error" },
  { "kind": "note", "id": "age", "text": "Loaded 2 min ago", "tone": "muted" }
] }
```

### 2.2 Live example (FR)

```json
{ "rows": [
  { "kind": "line", "id": "needs-me", "label": "À traiter", "value": "8 tâches", "dot": "warning" },
  { "kind": "line", "id": "top", "label": "Prochaine tâche",
    "value": "owner/repo#123 Fix the parser", "dot": "warning",
    "content": { "kind": "chips", "chips": [
      { "id": "issue", "label": "#123", "url": "https://github.com/owner/repo/issues/123" } ] } },
  { "kind": "line", "id": "progress", "label": "Avancement", "value": "12 sur 40 terminées",
    "content": { "kind": "bar", "value": 30 } },
  { "kind": "line", "id": "running", "label": "Agents en cours", "value": "2 en cours", "dot": "success" },
  { "kind": "line", "id": "blocked", "label": "Bloquées par des dépendances", "value": "1 tâche", "dot": "error" },
  { "kind": "note", "id": "age", "text": "Chargé il y a 2 min", "tone": "muted" }
] }
```

### 2.3 Actions

No row action in this design. A status-row action posts `{ id }` to `/status`,
which reaches the service, and the service has no method that opens the panel or
a URL. A button labelled "Open board" would therefore do nothing. The only
honest click-through is the row-2 chip, which opens the GitHub issue. The owner
opens the panel from the Task Board rail icon, as today.

If a later host adds an open-panel action, add exactly one on row 1:
`{ "kind": "button", "id": "open-board", "label": "Open board", "variant": "outline" }`
(FR `Ouvrir le tableau`). Do not ship it before the host can honour it.

---

## 3. The three states

The service decides from the age of the selected snapshot:
`age = Date.now() - snapshot.at`, clamped at 0 if the clock is skewed.

### 3.1 Empty — no snapshot yet (service just started, panel not opened since)

One note row only. No counts, no zeros, no invented numbers.

EN:

```json
{ "rows": [ { "kind": "note", "id": "empty",
  "text": "No board data yet. Open the board once to load it.", "tone": "muted" } ] }
```

FR:

```json
{ "rows": [ { "kind": "note", "id": "empty",
  "text": "Aucune donnée du tableau pour l'instant. Ouvrez le tableau une fois pour le charger.", "tone": "muted" } ] }
```

### 3.2 Live — `age < 10 min`

The six rows of §2. Row 6 is the age note, `tone: "muted"`:

- `age < 60 s`: EN `Loaded just now`, FR `Chargé à l'instant`.
- otherwise: EN `Loaded N min ago`, FR `Chargé il y a N min`, with
  `N = floor(age / 60000)`.
- `age >= 60 min` is already stale, so live never needs the hour form.

### 3.3 Stale — `age >= 10 min`

Same six rows with the last known values; row 6 changes to `tone: "warning"`:

- EN: `Data loaded N min ago. Open the board to refresh.`
- FR: `Données chargées il y a N min. Ouvrez le tableau pour actualiser.`
- `N = floor(age / 60000)` when `age < 3 600 000`; otherwise
  `N = floor(age / 3 600 000)` with `h` instead of `min`:
  EN `Data loaded 2 h ago. Open the board to refresh.`,
  FR `Données chargées il y a 2 h. Ouvrez le tableau pour actualiser.`

Stale never changes a count to zero and never hides the last values. The warning
tone is the only signal that they may be old.

Stale example (EN; the values are the last snapshot, not a new reading):

```json
{ "rows": [
  { "kind": "line", "id": "needs-me", "label": "Needs me", "value": "8 tasks", "dot": "warning" },
  { "kind": "line", "id": "top", "label": "Next task",
    "value": "owner/repo#123 Fix the parser", "dot": "warning",
    "content": { "kind": "chips", "chips": [
      { "id": "issue", "label": "#123", "url": "https://github.com/owner/repo/issues/123" } ] } },
  { "kind": "line", "id": "progress", "label": "Progress", "value": "12 of 40 done",
    "content": { "kind": "bar", "value": 30 } },
  { "kind": "line", "id": "running", "label": "Running agents", "value": "None", "dot": "muted" },
  { "kind": "line", "id": "blocked", "label": "Blocked by dependencies", "value": "None", "dot": "success" },
  { "kind": "note", "id": "age", "text": "Data loaded 22 min ago. Open the board to refresh.", "tone": "warning" }
] }
```

Threshold `10 min` is a proposal, not a measurement: the panel refreshes on
demand and on session idle, so ten quiet minutes is the point where the counts
stop being trustworthy. Owner confirmation is an open question (§10).

---

## 4. Sidebar marks

### 4.1 Manifest (inside `contributes`)

```json
"marks": true,
"sessionControl": {},
"sessionEvents": {
  "events": ["turn-started", "permission-asked", "question-asked",
             "turn-finished", "turn-failed", "session-archived", "session-deleted"]
},
"service": { "entry": "service/main.js", "runtime": "host", "keepRunning": true }
```

`sessionEvents` needs no `content: true`: marks use identifiers only, so the
`transcript` capability is not requested. `turn-started` and the two session
lifecycle events are accepted by the SDK parser (`GUEST_SESSION_EVENT_TYPES`);
`API.md`'s four-event table is stale (§9).

### 4.2 Target

`{ sessionId }`, from `event.session.id`. Not `{ directory, branch }`: a branch
mark would land on every session and worktree row of that branch, including
unrelated work, and the issue-to-branch map lives in the panel and would be
stale. The session row is where the owner answers.

Ignore events whose `session.parentId` is set: a subagent's row is not where the
owner acts, and its parent's turn remains running.

### 4.3 One mark per target

`setMark` replaces the previous mark on that target, so a session never carries
two. A pending question always wins over running.

| Event / condition | Mark |
|---|---|
| `turn-started` | `{ icon: "time", tone: "info", text: "Agent running" }` / FR `Agent en cours` |
| `permission-asked` or `question-asked` | `{ icon: "question", tone: "warning", text: "Waiting for your answer" }` / FR `En attente de votre réponse` |
| `turn-finished` or `turn-failed` | `null` |
| `session-archived` or `session-deleted` | `null` |
| status poll says `busy` | running mark (as above) |
| status poll says `idle` or the call fails | `null` |

The app prefixes the extension's manifest name, so the tooltip reads
`Task Board: Waiting for your answer` and, in French, `Task Board : En attente
de votre réponse`. The prefix stays "Task Board" in both languages because it is
the manifest name; only the text after it is localized.

### 4.4 Answering a question

A question mark must not outlive the answer. Answering a form resumes the same
turn, so no `turn-started` event is emitted. Therefore, while a question mark
exists, the service polls `sessions.status(sessionId)` every 30 seconds
(requires `sessionControl: {}`; it spends no tokens and starts nothing):

- `waiting` keeps the question mark;
- `busy` replaces it with the running mark;
- `idle` clears it.

The poll stops when the mark is cleared. It calls `setMark` only when the state
changes, never on every read, so a waiting session costs one read per 30 s and
no mark change. One call per waiting session per 30 s.

### 4.5 Same issue, running agent and pending question

Marks are per session, not per issue. On one session the question replaces the
running mark. If two sessions work the same issue, each row keeps its own mark;
the question row is the one to answer. The service never maps issue to session;
the panel already does that for its own display.

### 4.6 Service start

Marks live only as long as the process. On start the service re-applies no marks
it cannot verify: it has no session list. A mark set before a crash is gone.
This is deliberate; re-applying a persisted question mark could show a wait that
was answered while the service was down. The next event re-establishes the truth.

### 4.7 Language

`setMark` carries one text and no locale. The service remembers the `locale` of
the most recent `GET /status` (default `en`) and, when it changes, re-sets the
live marks with the other language, batched under the 60-changes-per-minute
limit. If the Work Status section is never opened, marks stay in English. This is
a host limitation, not a copy choice; both texts are defined above.

---

## 5. Agent-facing instructions

`contributes.instructions: true`, then `host.setInstructions(null, text)` when
the service starts and when the facts change. One text for every project: the
SDK has no per-locale instruction slot, and the repository's prompts are
English, so the English text below is the installed one. The French text is the
approved translation if the owner ever switches the installed language.

### 5.1 English — 1,346 characters (limit 4,096)

```
Board: https://board.workflows.ac
Tasks are GitHub issues. The board reads the issue body and its status label.

Status labels: status:todo, status:in-progress, status:in-review, status:needs-human. status:in-review means you are reviewing your own work; it asks nothing of the person. Never set status:done. Never close an issue.

Human gate. A task may sit in status:needs-human only when its body carries a click-through artifact:

### Human Review:
- Artifact: image
- URL: https://example.com/shot.png
- Instruction: Compare the empty state with the approved mockup.

Artifact is image, video, link or question. image needs an https URL. video and link need an http or https URL and one Instruction line of at most 200 characters. question takes no URL: it points at the first unanswered item under ### Open Questions: and needs at least one preset line. Without a valid artifact the board refuses status:needs-human.

Write a question when a decision blocks the work. Put it under ### Open Questions: as one self-contained sentence, with preset lines directly below:
  - Label :: one-line gist :: details
Block only the work that depends on the answer. Independent work continues.

When you block on a person or hand off for validation, add verb-first items under ### Human Tasks: at that moment and stop cleanly. Never check a human's box.
```

### 5.2 French — 1,521 characters (translation, not installed by default)

```
Tableau : https://board.workflows.ac
Les tâches sont des tickets GitHub. Le tableau lit le corps du ticket et son étiquette de statut.

Étiquettes de statut : status:todo, status:in-progress, status:in-review, status:needs-human. status:in-review signifie que vous relisez votre propre travail et ne demande rien à la personne. Ne définissez jamais status:done. Ne fermez jamais un ticket.

Validation humaine. Une tâche ne peut rester en status:needs-human que si son corps porte un élément cliquable :

### Human Review:
- Artifact: image
- URL: https://example.com/shot.png
- Instruction: Comparez l'état vide avec la maquette approuvée.

Artifact vaut image, video, link ou question. image exige une URL https. video et link exigent une URL http ou https et une ligne Instruction de 200 caractères au plus. question ne prend pas d'URL : elle pointe vers le premier élément sans réponse sous ### Open Questions: et exige au moins une ligne de choix. Sans élément valide, le tableau refuse status:needs-human.

Écrivez une question quand une décision bloque le travail. Placez-la sous ### Open Questions: en une phrase autonome, avec les lignes de choix juste en dessous :
  - Libellé :: résumé d'une ligne :: détails
Ne bloquez que le travail qui dépend de la réponse. Le travail indépendant continue.

Quand vous bloquez sur une personne ou remettez pour validation, ajoutez des éléments commençant par un verbe sous ### Human Tasks: à ce moment-là et arrêtez-vous proprement. Ne cochez jamais la case d'une personne.
```

The section headings `### Human Review:`, `### Open Questions:` and
`### Human Tasks:` stay in English in both texts: they are the contract's exact
spellings and parsers match them literally. Do not translate them.

---

## 6. `skills/board/SKILL.md`

`contributes.skills: "skills"` points at `skills/`, and the folder is
`skills/board/SKILL.md`.

```yaml
---
name: board
description: Use when work is tracked on the Workflows board, to write or update an issue body, move its status label, ask a blocking question, or hand the task to a person for review.
---
```

Section list, in order. Each section names the contract section it mirrors and
must not restate the syntax differently.

1. **When this applies** — one paragraph: a task is a GitHub issue read by the
   Workflows board; the body is the record.
2. **The task and the board** — `https://board.workflows.ac`, identity as
   `owner/repo#number`, one task per issue.
3. **Body sections at a glance** — a table of exact headings with contract
   references: `### Friendly Title:` contract §2.1, `**Overview:**` §2.2,
   `### Acceptance Criteria:` §2.3, `### Actionable Subtasks Checklist:` §2.4,
   `### Open Questions:` §2.5, `### Human Tasks:` §2.6,
   `## Test Plan (Issue)` and `Blocked by` §2.7, `### Work Log:` §2.8,
   `### Human Review:` §2.9.
4. **Status labels and who sets them** — `status:todo`, `status:in-progress`,
   `status:in-review`, `status:needs-human`; an agent never sets `status:done`
   and never closes (contract §4).
5. **Asking a question** — `### Open Questions:` prose first, then preset lines
   `  - label :: gist :: details`, at most 8, label at most 120 characters
   (contract §2.5). Block only dependent work.
6. **The human gate** — the exact `### Human Review:` block, the four artifact
   types, `image` needs https, `video`/`link` need URL plus a one-line
   `Instruction` of at most 200 characters, `question` points at the first
   unanswered open question and needs at least one preset (contract §2.9).
   Without a valid artifact the board refuses `status:needs-human`.
7. **Human Tasks** — verb-first, self-contained, written at the moment of
   blocking, never checked by the agent (contract §2.6).
8. **Work Log** — one sentence stating the work type and the concrete reason,
   once work starts (contract §2.8).
9. **Dependencies** — `Blocked by` with a full URL for a cross-repo dependency,
   never `#N` shorthand (contract §2.7).
10. **Before you hand off** — a short checklist: friendly title, overview,
    acceptance criteria, work log sentence, question presets, valid gate,
    human tasks, status label.
11. **Never** — close an issue, set `status:done`, check a human's box, invent a
    `type:*` label or a body field, translate a section heading.
12. **Reference** — `docs/issue-body-contract.md` v1.3 is the single source of
    truth; this skill is a summary and loses to it on any conflict.

---

## 7. Copy compliance

- Every user-facing string above exists in EN and FR (§2 table, §3 states, §4
  tooltips). Repo names and issue titles are data, not copy.
- No `!`, no emoji, no `n8n`, no `mobile` in any proposed string.
- No internal vocabulary (`payload`, `service`, `statusSection`) in user-facing
  text. `status:*` appears only in agent instructions, where it is the literal
  label the agent must write, and in the skill, where it is contract syntax.
- The proposed strings use letters, digits, apostrophes, accents, `#`, `:`,
  `;`, `/`, `.`, `,`, `-`, `::` and the `...` truncation marker. No other
  punctuation.

---

## 8. Deliberately not proposed

1. **A GitHub call per poll.** The service has no token path (`readSettings()`
   exposes only `integration.settings`; the token is in `integration.token`) and
   a second client would drift from the panel. The section reads a snapshot.
2. **`statusSection: true`.** That reuses the 709 KB panel bundle and boots the
   whole board in a 120 px frame. The design uses `source`, which loads no frame.
3. **Per-issue rows.** One row per task would need up to 16 rows, change every
   poll, and duplicate the panel. The section is a summary, not the board.
4. **Row actions that pretend to open the panel.** A row action reaches the
   service, which cannot open a panel or a URL (§2.3).
5. **A progress chart.** A chart needs a stored series; the snapshot has one
   point. A bar of the current ratio is real data.
6. **`mentions`, `commands`, `blocks`, `actions`, `sessionControl.answers`.**
   These are the later waves in D46 (acting from chat, answering in chat), not
   this design. Only `sessionControl: {}` is added, for the read-only
   `sessions.status` poll in §4.4.
7. **A new status label or body field.** The design reuses `status:*` and the
   v1.3 contract; it adds no vocabulary to GitHub.
8. **Persisting the snapshot to disk.** `keepRunning` holds the process; a file
   under `HOME=/workspace` would add workspace state and could serve data older
   than any panel load.
9. **`{ directory, branch }` marks.** They would mark unrelated sessions on the
   same branch and need an issue-to-branch map the service does not have.
10. **A "Refresh" control.** The service cannot make the panel reload, so the
    control would lie. The stale note tells the owner to open the board.

---

## 9. Facts checked while designing

- `guestStatusViewSchema.safeParse` accepted the live, empty and stale shapes
  (five payloads: live EN, live FR, empty EN, empty FR, stale EN): all PASS.
- `parseManifestJson` accepted the proposed manifest (current `package.json`
  plus `statusSection.source`, `marks`, `instructions`, `skills`,
  `sessionEvents` with `turn-started`, `keepRunning`, and
  `engines.openchamber: ">=2.7.1"`): PASS.
- `SERVICE_INSTRUCTIONS_MAX = 4_096`; the EN text is 1,346 characters and the FR
  text 1,521, measured as Unicode code points (not `wc -m`, which counts bytes
  in a non-UTF-8 locale).
- The SDK parser accepts `turn-started`, `session-archived` and
  `session-deleted`; `API.md`'s `sessionEvents` row lists only four events and
  is stale. Implementation must follow the parser, not that row.
- `statusSection.source.interval` range is 1,000–60,000 ms; `5000` is valid.
- Row `label` limit 60, `value` limit 80, note `text` limit 200, chips 1–6,
  actions 0–2, rows 1–16.
- `docs/issue-body-contract.md` on `master` is v1.3 (§2.9 Human Review); the
  working-tree copy on `ops/task-board-activation` is v1.1. The design uses
  v1.3 because that is what the live board parses.

---

## 10. Open questions for the owner

1. **Stale threshold.** 10 minutes is proposed. Shorter (5 min) warns sooner but
   shows the warning during a normal long turn; longer (20 min) trusts old
   counts longer. Recommendation: 10 min.
2. **Progress denominator.** `done / total` over every issue in the snapshot,
   including closed ones. If the owner reads progress as "this release", the
   denominator should be a filtered set instead. Recommendation: keep all tasks
   until a release filter exists.
3. **Mark language before the section is opened.** Marks default to English
   until `GET /status` reports a locale (§4.7). Acceptable, or should the
   service stay silent (no mark text) until it knows the language?
4. **A click on the section cannot open the panel.** Only the host can add that.
   Should the design request a host-side open-panel affordance, or keep the
   GitHub chip as the only click-through?

---

## 11. Implementation surface (for the next worker, not done here)

- `package.json`: add the manifest keys in §4.1 and §5, raise
  `engines.openchamber` to `>=2.7.1`, keep `statusSection.source` at
  `{ path: "/status", interval: 5000 }` with `title: "Task Board"` and
  `defaultExpanded: true`.
- `service/main.ts`: `POST /snapshot` (204), `GET /status` (rows, locale),
  `POST /session-events` (answer `{ ok: true }` first), the mark map and the
  30 s status poll. Keep `GET /health`.
- `panel/main.ts`: after each successful load, `POST /snapshot` through
  `host.serviceRequest` with the fields in §1.1. This changes the test that
  asserts exactly one service request on ready (`/health`).
- `test/service-host-connection.test.js`: `GET /status` no longer returns 404;
  keep the "no ownerId/activeLeases disclosure" assertion.
- No panel redesign, no new GitHub call, no new label.
