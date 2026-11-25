# Read-model gaps

Each entry is a fact the board needs that the engine's read surface does not
carry, or a shape it can only produce outside the CLI. Evidence is the fixture
in `fixtures/` and the verbs at `task-engine@33651ee` (schema revision 7).

The model does not fill these with guesses. Where a value is unavailable it is
`null` with an explicit capability flag; the page states the limit where it
affects a row or a count.

## Revision note — live board read at 4b7e4d6

The board is now built from a live read, not the capture. Re-checked against
`task-engine@4b7e4d6`, schema revision 7, with `engine-board`'s demo store.

What the read surface gained since the `33651ee` pin, and what that closes:

| Fact | Where it now appears | Effect |
|---|---|---|
| `tree_key` | every `graph` node, including `$root` | G1 is closed for the graph read: the live source checks the root's key against the request and refuses a mismatch. |
| `title` | `graph` nodes and `status` | The model no longer falls back to `node_key` for a named task; the panel and cards carry the engine's title. |
| `created_at`, `updated_at` | `graph` nodes and `status` | Both render in the panel. |
| `max_concurrency` | `project show`, and `status` | The panel's slot reads `N of <limit>`; `slot_limit` on `status` wins over the project value. |
| `slot_limit`, `runner_id`, `runner_slot`, `attempts`, `ended_attempt` | `status` | The panel's slot, runner and attempt rows have a real source; `runners_available` stays false because `task runner list` is still not read. |
| `next_cursor` | `graph` | New paging field. `null` for this tree; the live source does not follow a cursor, so a non-null value would be an unhandled truncation. Recorded as a seam, not a defect. |

Edge shape changed: `graph` prints `{blocker_task_id, blocked_task_id, input_name,
kind, required, satisfied_by, edge_id}`; the fixture's `{from,to,kind}` is no
longer the live shape. `live-source.ts` folds both to `{from,to,kind}`. G10a
(`status` changes shape with its argument count) still holds and is handled.

`graph --tree` without `--depth` returned all eight nodes; the old G2a depth trap
is not reproducible at this revision for this tree, but neither read asks for a
depth, so a future default would show up as a short tree, not an error.

The fixture remains pinned at `33651ee` and is now payload-different from the
engine: it has no `title`, no `max_concurrency`, and `slot`/`phase` are `null`
where the live store has values. It stays only as test coverage.

## Revision note — reviewed at 33651ee

The fixture was recaptured four times: `87247d1` → `41b2170` (the tree and
parent changes) → `efccc06` → `ec4f19b` → `33651ee`. The engine moved four times
during the review, so the pin names the last revision the capture was run
against, not the first. `5735091` (K-1) put `tags` and `requires` in the `task.created` payload,
`efccc06` (K-2) added `ix_task_project_created` and raised the schema revision
to 7, `ec4f19b` (K-3) made `list_tasks` a paged, filtered read, `f039450`
(K-4) reshaped `stale_revision`, `9c942a1` (K-5) added `tree.created`, and
`33651ee` (K-6) deleted `create --parent`. None changes a verb the board reads:
`cmd_graph` calls `store.all_tasks`, not `list_tasks`, and `watch` still strips
payloads, so the new event is not readable. The fixture's payload shapes are
unchanged; only the pin moved.

| Claim | Verdict at 33651ee | Evidence |
|---|---|---|
| `graph --tree` selects the tree | True, with a depth caveat (G2, G2a) | `cli.py:297-322`; `graph --tree <root> --depth 3` returned 8 nodes, `--depth 2` returned 7 |
| Top-level parents are the root | True, and now the only way to name a parent | every non-root node has `parent_task_id = <root id>`; `create --parent` is gone at `33651ee`, so the key alone decides |
| `task.created` carries `tags` / `requires` | **True at `5735091`** — false when first written | node payload writes `tags`/`requires` at `store.py:1279`; the root's payload writes empty lists at `store.py:1147-1155`. G5 is still partly open because `task watch` strips payloads (G13) |
| `--tree` refuses a non-root id | True for `create`, **false** for `graph` | `cli.py:243-250` refuses `create --tree <node>`; `cli.py:297-308` accepts `graph --tree <node>` and returns its subtree |

G2 is closed. G2a records the depth trap that replaces it. G10a is new: the
re-capture found that `status --json` changes shape with its argument count. G16
was wrong when written: there is no `task archive` CLI verb. The rest stand,
with the qualifications below.

## G1. `tree_key` is not returned by any read verb

`task create --tree-key` returns `task_id`, `root_task_id`, `rest_state`. `task
graph` nodes carry four keys; `task status` carries seven. None is `tree_key`,
although INTERFACE §2 names it on `task` and §2.1 makes it the tree's external
identity. The root's `task.created` event payload does carry `tree_key`, but
`task watch` strips payloads (G13), so no documented read returns it.

Impact: the board cannot discover or verify a tree key from a read. It must be
passed in out of band; the fixture source carries the request value and the page
labels it as the requested key.

## G2. `task graph --tree <root_task_id>` read the container, not the tree — CLOSED at 41b2170

At `87247d1`, top-level work nodes had `parent_task_id = null`, so `graph
--tree <root>` walked one hop and returned only the `$root` container. The
capture observed one node for the tree and eight for the project.

At `41b2170`, `store._resolve_parent` makes a one-segment key's parent the root
(`store.py:1304-1321`), so the same call returns the full tree. Verified:
`graph --tree <root> --depth 3` returned `$root` plus seven work nodes.

Impact of the old behaviour is gone. The old workaround — read `--project` and
filter — is no longer necessary, and the fixture now records the `--tree` read.

## G2a. `graph --tree` truncates at depth 2 without a marker

`graph --tree` defaults to `--depth 2` (`cli.py:674`). A tree whose leaves are
deeper loses them silently: `graph --tree <root>` returned seven nodes and
omitted `build/render/legend`; `--depth 3` returned eight. There is no
`truncated` flag, no cursor and no count of the omitted nodes.

Impact: the natural tree read is complete only if the caller guesses a depth at
least as deep as the tree. A live source must pass a large explicit depth or
compare against `--project`; the fixture does the latter in `capture.sh`.

## G3. `task graph` nodes do not carry `root_task_id`

A node is exactly `{task_id, node_key, rest_state, parent_task_id}`. With more
than one tree in a project, `graph --project` returns all of them and no node
says which tree it belongs to. `graph --tree` now selects a subtree when the
caller already has the root id, but the payload still cannot list trees or
attribute a project-wide read.

Impact: tree identity exists only in the caller's request. `tree_key` is not on
a node either (G1), so listing trees from the read surface is impossible. The
fixture is deliberately one project with one tree.

## G4. `runner_slot` and `runner_id` are not in any `--json` read

INTERFACE §2's `attempt` row has `runner_id` and `runner_slot`; `attempt` is
where the place is fixed at claim. `task status --json` prints `slot`, which is
the project slot, and no verb prints an attempt row. At `33651ee` the status
view is still exactly seven keys (`engine.py:618-626`).

Impact: the board cannot say which runner or runner slot a live attempt holds.
It cannot distinguish a busy project slot from a busy runner slot. The model
sets `runner_slot: null` and `runner_slot_reported: false`; the page prints
`runner_slot not reported` on the live row.

## G5. Task title, goal, body and priority are unreadable

`task create` accepts `--goal` and `--priority`; the `task` row stores `title`,
`body`, `priority`, `tags` and `requires`. No read verb prints any of them.
`graph` nodes carry no title; `status` carries no title.

`tags` and `requires` are now recoverable in principle: `5735091` put both in the
`task.created` payload (`store.py:1256-1268`), and the root's payload carries
empty lists (`store.py:1147`). They stay unreachable through the CLI because
`task watch --json` prints only `stream_kind, stream_id, sequence, kind, at`
(G13, verified at `33651ee`). `task create` still has no `--tags` or `--requires`
flag (`cli.py:661-669`), so those columns are writable only through
`store.get_or_create_node(node={...})`.

Impact: a row can only show `node_key`. There is no human-readable goal, no
priority order and no way to explain placement from `requires` or `tags` without
reading the event payload, which no verb exposes. A "tree you can read at a
glance" is currently a tree of machine keys.

## G6. `blocked_by` / `after` cannot be created through the CLI

`task create` has no edge flag. `edge` rows are written by
`store.get_or_create_node(edges=…)` (INTERFACE §4.1), and the playbook loader
that would add `blocked_by` at apply time is out of scope. The capture wrote
the two visible edges through the store port.

Impact: a documented CLI workflow cannot produce the graph the board reads.
`task graph` will show edges that no CLI command can create. This is the gap
most likely to make a fixture look complete while a live board stays empty.

## G7. Only `draft` and `ready` are creatable; several states are unreachable

`task create` inserts `initial_state = draft if --draft else ready`. `blocked`
is C1 and has no CLI path. `failed` needs an observed `end_reason = failed`;
the CLI's stub always succeeds. `cancelled` and `skipped` belong to verbs marked
`later`.

The capture produced `waiting` by running a `check` contract the stub cannot
satisfy; the settle is rejected and the wait names
`rejected:condition:check:unit`. It produced `blocked` through the store port.

Impact: `failed`, `cancelled` and `skipped` are unproven renderings. Their
counts are zero in the page with an explicit note; they are not evidence that
the tree cannot reach them.

## G8. No CLI path leaves an attempt live

`task run` drives `run_until_quiet` and the stub ends the attempt inside the
verb. Every CLI-produced status has `phase: null`, so the live-attempt shape is
not reachable from the demo invocation.

The capture used `store.claim` + `store.begin_launch` +
`store.transition_attempt(to_phase="live")` to freeze `phase: live` and `slot:
0`. The shape is a real engine row; the path is not a documented CLI workflow.

Impact: the board's live row (`ready` + `phase live`) is port-only in this
slice. A live source will need a claim/launch path that does not end the
attempt before the read.

## G9. `wait` and `hold` are opaque JSON

INTERFACE §2 types both as `JSON?`. The captured wait has nine members
(`reason`, `cause`, `owner`, `opened_at`, `expires_at`, `opened_by_attempt`,
`escalation_level`, `resume_at`, `ended_by`), but nothing freezes that member
set.

Impact: the renderer types the captured members. A future wait with a different
shape renders `not reported` for `reason`, `cause` or `owner` when they are
missing or not strings, and silently omits members it does not know. The board
needs a member contract or a versioned wait schema before it can rely on
`reason` or `cause`.

## G10. No project-scoped task or status read

`graph` returns the whole project's nodes but only `rest_state` (or one subtree
with `--tree`); `status` takes task ids. To get `phase`, `slot`, `wait` and
`hold` for a tree, the board calls `status` with every id in one payload, or
makes one call per task.

Impact: the payload grows with the tree; there is no cursor and no project-wide
status read. A large project has no bounded way to refresh the tree.

## G10a. `status --json` changes shape with the number of ids

`cli.py:293` prints `rows[0]` when one id was asked for, and `{"tasks": rows}`
for two or more. Verified at `33651ee`: `status <one id> --json` returned a bare
status object; `status <two ids> --json` returned `{"tasks": [...]}`.

Impact: a live source that refreshes a single task cannot reuse the fixture's
`{"tasks": []}` parser, and a source that batches gets a different top-level
shape than one that does not. The board's fixture happens to pass all eight ids,
so the capture never sees the single-id shape.

## G11. Project `max_concurrency` is unreadable

`project show` prints `project_id` and `config_revision`. `project add` prints
the same two. `config.max_concurrency` is stored and is the project slot limit,
but no read verb prints it. `attempt.slot_limit` is in INTERFACE §2 and is not
printed either, so `status.slot` has no denominator.

Impact: the board can show runner capacity, not project capacity. It cannot
show "slot 0 of 2" or explain why a `ready` task has no slot when the runner is
free.

## G12. No timestamp or `updated_at` in graph or status

`graph` nodes and `status` payloads carry no `created_at`, `updated_at` or
`settled_at`. `watch` events carry `at`, but the CLI prints only `kind` and
`at`, not the payload (G13).

Impact: no freshness, no "last changed", no way to order activity in the tree
or mark a stale read.

## G13. `task watch --json` strips event payloads

Each event prints `stream_kind`, `stream_id`, `sequence`, `kind`, `at`. The
store has `payload`, `principal`, `task_id` and `attempt_id`; the CLI does not
print them (`cli.py:526-535`). Verified at `33651ee` with `watch --from 0
--json`: 41 events, all five keys and no payload.

Impact: the board cannot use the event log to recover facts the read verbs omit
(for example, `tree_key` on the root's `task.created`, why a `rest_state`
changed, or which attempt ended). The log is a sequence of names, not a source
of detail.

## G14. The tree container is a task row with a magic key

`get_or_create_root` writes a task with `node_key "$root"`, `parent_task_id
null`, `rest_state ready` and `handoff_revision 0`. It appears in `graph` like
any other node. No column marks it as a container, and `tree_key` is not
printed.

At `41b2170`, top-level work nodes now name this row as their parent, so a
consumer that treats `parent_task_id = null` as "root of the tree" is wrong.
`33651ee` removed `create --parent`, so the key is the only way a parent is
named and `_resolve_parent` refuses a deeper key whose prefix node is missing
(`store.py:1304-1321`). The board hardcodes `node_key === "$root"` and hides
exactly the `root_task_id` row, although `meta.json` records
`container_node_key`; the model never reads it.

Impact: a project with several trees has several `$root` rows and no way to
tell which tree each belongs to. A second tree's container is not hidden by the
current model and appears as a visible task row named `$root`.

## G15. Ended attempts and `end_reason` are unreadable

`task status` reads the task's live attempt (`ended_at IS NULL`). A `done`,
`failed`, `cancelled` or `skipped` task has no live attempt, so its `phase` is
`null`; the attempt that produced the result, its `ordinal`, `runner_id`,
`runner_slot` and `end_reason` are not printed anywhere.

Impact: the board cannot show how a task reached its state, which attempt ran,
which runner held it, or how long it took. A tree of terminal tasks loses the
history that explains it.

## G16. Archived tasks appear as active work

There is no `task archive` CLI verb. `store.archive_tree` stamps
`task.archived_at` on the root and every task under it, but `store.list_tasks`
selects every task in the project and `task graph` nodes do not carry
`archived_at`.

Impact: an archived tree's tasks still appear in the graph, indistinguishable
from live work. The board cannot hide or label them. (The first version of this
entry named `task archive`; that verb does not exist.)

## G17. The capture is a shape snapshot, not a live read

The fixture is frozen at `33651ee`. Task ids and timestamps change on every
capture, and the two port-only rows have no CLI invocation. The fixture proves
the shapes; it does not prove a live reader can obtain them through the verbs
alone.

Impact: the next slice's first task is a live `EngineTreeSource`; every gap
above becomes a decision about what the board shows when the live source cannot
answer.
