# Field gaps against the live engine

What the page needs, and whether `task-engine@c4ccf1e` (schema revision 8)
prints it. Evidence is the committed capture in `fixtures/`, produced by
`fixtures/capture.sh` from the engine's own `--json` output, and the verbs in
that capture's `meta.json`.

Status words used below:

- **provided** — a read verb prints the field under the name the model reads.
- **renamed** — the engine prints the fact under another name; the source folds
  it and the model keeps the engine's meaning.
- **missing** — no read verb prints it. The model stores `null` and marks a
  capability flag; the page says the fact was not read.

## Board cards and lanes

| Field the page needs | Surface | Source at c4ccf1e | Status |
|---|---|---|---|
| Task identity | card, panel, dialog | `graph.task_id`, `status.task_id` | provided |
| Short name / tree path | card, breadcrumb | `graph.node_key`, `status.node_key` | provided |
| Human title | card, panel, breadcrumb | `graph.title`, `status.title` | provided |
| State word | card lane, counts, List | `graph.rest_state`, `status.rest_state` | provided |
| Live attempt phase | lane choice, card marker | `status.phase` | provided |
| Archived marker | card, Panel | `graph.archived_at`, `status.archived_at` | provided |
| Parent for nesting | breadcrumb, scope | `graph.parent_task_id`, `status.parent_task_id` | provided |
| Tree identity | provenance, request check | `graph.tree_key`, `status.tree_key` | provided |
| Tree root | provenance | `graph.root_task_id`, `status.root_task_id` | provided |
| Task body (description) | panel | `status.body` | provided |
| Tags | panel, List | `graph.tags`, `status.tags` | provided |
| Requirements | panel, List | `graph.requires`, `status.requires` | provided |
| Priority | panel, List | `graph.priority`, `status.priority` | provided |
| Created / updated | panel | `status.created_at`, `status.updated_at`, `graph.created_at`, `graph.updated_at` | provided |
| Contract digest | panel | `status.contract_digest`, `graph.contract_digest` | provided |

## Dependency lines and the panel's "Waits for" / "Holds up"

| Field the page needs | Surface | Source at c4ccf1e | Status |
|---|---|---|---|
| Edge kind (`blocked_by`, `after`) | line style, sentence | `graph.edges[].kind` | provided |
| Blocker end | line geometry, sentence | `graph.edges[].blocker_task_id` | **renamed** to `from` by the source |
| Blocked end | line geometry, sentence | `graph.edges[].blocked_task_id` | **renamed** to `to` by the source |
| States that satisfy the edge | sentence ("done" vs "not yet") | `graph.edges[].satisfied_by` | provided |
| Input name an edge binds | panel | `graph.edges[].input_name` | provided (not drawn; no V1 surface needs it) |
| Required flag | panel | `graph.edges[].required` | provided (not drawn) |
| Edge identity | internal | `graph.edges[].edge_id` | provided (not drawn) |
| Wait reason / cause / owner | panel, card wait line | `status.wait.reason`, `status.wait.cause`, `status.wait.owner` | provided |
| Wait timestamps and escalation | panel | `status.wait.opened_at`, `expires_at`, `escalation_level`, `resume_at`, `ended_by`, `opened_by_attempt` | provided |
| Hold | panel | `status.hold` | provided |

## Counts and progress

| Field the page needs | Surface | Source at c4ccf1e | Status |
|---|---|---|---|
| One state per task | counts, lanes, focus line | `rest_state` on every graph node and status row | provided |
| Live total | level line, focus sum | derived from the tree read | derived, not a field |
| Container row to hide | tree scope | `parent_task_id: null` plus `node_key: "$root"` | provided |
| Tree completeness | build guard | `graph.next_cursor` | provided (`null` on a whole `--tree` read) |

Containment counts, lane groups, focus clauses and progress are computed by
`rollup.ts` from `rest_state` and `phase`; the engine does not print them and
the page never pretends they are engine facts.

## List view

| Field the page needs | Surface | Source at c4ccf1e | Status |
|---|---|---|---|
| Every row at every depth | List | `graph` nodes + `status` rows for the tree | provided |
| Row collapse state | List | none | **not needed from the engine** — UI state, default expanded |
| The project's task page | list read | `task status --project <id> --json` | **renamed**: there is no `task list` verb; this is the paged project read |

## Attempts, slots and runners

| Field the page needs | Surface | Source at c4ccf1e | Status |
|---|---|---|---|
| Attempt history | panel | `status.attempts` | provided |
| Ended-attempt marker | panel | `status.ended_attempt` | provided |
| Attempt phase, outcome, evidence | panel | `attempt.phase`, `attempt.outcome`, `attempt.end_evidence`, `attempt.end_reason` | provided |
| Attempt ordinal / identity | panel | `attempt.ordinal`, `attempt.attempt_id` | provided |
| Who attested / approved | panel | `attempt.attested_by`, `attempt.approved_by`, `attempt.principal`, `status.approved_by`, `status.self_approved` | provided |
| Runner on the live attempt | panel | `status.runner_id` | provided |
| Runner slot on the live attempt | panel | `status.runner_slot` | provided |
| Project slot and its limit | panel | `status.slot`, `status.slot_limit`, `status.max_concurrency`, `project.max_concurrency` | provided |
| Runner inventory | provenance / panel | `task runner list --project <id> --json` | provided; `runners_available` is `true` |
| Runner kind, tags, capacity, enabled, endpoint, heartbeat | panel | `runner.kind`, `runner.tags`, `runner.capacity`, `runner.enabled`, `runner.endpoint`, `runner.heartbeat_at` | provided |

`runners_available` is a model flag, not an engine field: it is `true` because
the `runner list` read succeeded, so an empty list means the project has no
runners rather than that nobody asked.

## Still missing entirely

| Field the page needs | Surface | Why it is missing |
|---|---|---|
| Contract conditions | panel ("Done when") | `status` prints `contract_digest` and `handoff_revision`, not the handoff body or its `evidence` / `answer` / `verdict` / `check` / `child` conditions. No `handoff` read verb exists at `c4ccf1e`. The model sets `capabilities.contract_conditions: false` and the panel says the contract is not readable through the read commands. |
| Issue-mirror link | panel ("Conversation") | The engine has no comment store and `status` carries no mirror reference. The model sets `capabilities.mirror_link: false`; the panel says where a conversation lives, or that none was read. |

## Naming and shape gaps still in force

| Gap | Effect |
|---|---|
| No `task list` verb | The project page read is `task status --project <id> --json` (with `--limit`, `--cursor`, `--archived`). The page's List model does not use that page read; it draws the tree. `capture.sh` records the project page so the difference is visible in the report. |
| `status --json` changes shape with its argument count | One id prints the bare object; two or more print `{"tasks": [...]}`; `--project` alone prints a page with `next_cursor`. `live-source.ts` accepts both by checking for `tasks`. |
| `graph --tree` has no `truncated` marker | A paged or truncated tree would look complete. The source refuses a non-null `next_cursor` or `truncated: true` instead of drawing a smaller tree. |
| `$emit` is a real task row | Every applied playbook carries a `$emit` node (usually `done`, title "Emit the resolved instantiation fragment."). No read verb flags it as scaffolding, so it renders as a Done card. This is engine data, not a renderer defect. |
| Tree container has a magic key | `$root` is a task row with `parent_task_id: null`. The model hides the requested `root_task_id`, not every row whose key is `$root`; a second tree's container would be visible if two trees were read as one. |

## What the capture proves

`fixtures/` is `incident-9` from manifest 09: eight graph rows, five
`blocked_by` edges, states `ready`, `done`, `waiting` and `blocked`. The three
diagnostics and the summary were run through `task run`, so the capture carries
ended attempts, runner ids and slots, and a `wait.reason: review` gate.
`fixtures/second-shape/` is `bug-login-timeout` from manifest 02: eight rows
and five edges, both `after` and `blocked_by`, all three probes `ready` and the
decision `blocked`.

Seventeen of the eighteen scenario manifests apply; 12 is refused by the
loader at `playbook.yaml:23` for its `.ts` producer fragment, and `capture.sh`
asserts that refusal instead of working around it. No payload is written
through the store port.
