# Engine board

A read-only tree of one task-engine tree, rendered from a frozen capture. It is
one screen, one data-source seam and no mutation. The live board and its release
are untouched.

```sh
node engine-board/main.ts     # regenerate index.html from the capture
npm run typecheck
node --test test/engine-board.test.js
```

Open `engine-board/index.html` directly; it has no script, no request and no
external asset.

## What is here

| Path | Role |
|---|---|
| `engine-board/model.ts` | The engine's own field names folded into a tree. DOM-free, Node-free. |
| `engine-board/render.ts` | Static HTML from the model. No interaction. |
| `engine-board/main.ts` | Reads the fixture through the seam and writes `index.html`. |
| `engine-board/fixtures/source.ts` | The one implementation of `EngineTreeSource` in this slice. |
| `engine-board/fixtures/*.json` | Frozen `--json` payloads and capture metadata. |
| `engine-board/fixtures/capture.sh` | Rebuilds the capture from the pinned engine revision. |

## The seam

```ts
interface EngineTreeSource {
  load(request: {
    project_id: string;
    tree_key: string;
    root_task_id: string;
  }): Promise<EngineTreeSnapshot>;
}
```

`EngineTreeSnapshot` holds the verb payloads unmodified: `project`, `runners`,
`graph`, `statuses`, plus the `tree_key` and `root_task_id` the engine does not
echo back. It also carries its own `provenance` (`source_kind`, `read_at`,
engine revision, schema revision, operations, port-only steps, unobserved
states); the renderer prints that and never assumes a capture.

A live source in the next slice implements `load` against the verbs; the model
and the renderer do not change for the payloads the snapshot already carries. A
field no verb returns — title, `runner_slot`, an ended attempt — cannot be added
by a source alone: the snapshot and the model have to grow first. `tags` and
`requires` now exist in the `task.created` payload, but no verb prints a payload,
so they are unreachable the same way.

Capabilities are derived from the payloads (`buildTree`, not a constant): each
field the snapshot actually contains flips its flag, and the footer's limit
sentences read those flags. A source that starts returning titles stops saying it
has none without a renderer edit.

A parent cycle, a node disconnected below a cycle and a subtree whose parent is
outside the read are all returned as `defects` with a count and the affected
`node_key`s (and the lifted subtree is counted as a whole). They render beside
the rows; only a read that returned no tasks says the tree is empty.

## Field names

The model and the page use INTERFACE §2's words, not the board's:

- `rest_state` — never `status`
- `tree_key`
- `runner_slot` / `runner_id` — present in the model as `null` with
  `runner_slot_reported` / `runner_id_reported` false, because no read verb
  prints them; `*_reported` false means unreadable, not "no runner"
- `runners_available` — false when the runner list was not read, so an empty
  list is not rendered as "none"
- `blocked_by` and `after` — `edge.kind` values
- `phase`, `slot`, `wait`, `hold`, `handoff_revision` — `task status` fields

## What the capture covers

Pinned to `/workspace/code/task-engine` at `33651ee`, schema revision 7. The tree
read is `graph --tree <root_task_id> --depth 8`; the default depth is 2 and
truncates deeper trees without a marker.

| `rest_state` | How it was produced |
|---|---|
| `draft` | `task create --draft` |
| `blocked` | `store.get_or_create_node(initial_state="blocked", edges=[blocked_by, after])`; no CLI path |
| `ready` | `task create` |
| `waiting` | `task run` with a `check` contract the stub cannot satisfy; the settle is rejected |
| `done` | `task run` with an evidence contract |
| `failed` | Not produced; the CLI stub only succeeds |
| `cancelled` | Not produced; a later verb |
| `skipped` | Not produced; a later verb |

`attempt.phase` is `live` on `build/render` and `slot` is `0`. That row came
from `store.claim` + `store.begin_launch` + `store.transition_attempt`, because
`task run` drives the stub to an ended attempt. Both port-only steps are listed
in `fixtures/meta.json`.

`blocked_by` and `after` both appear on `build/integration`. Edges have no
`task create` flag; they were written through `store.get_or_create_node(edges=…)`.

## Gaps

`GAPS.md` is the part that matters for integration: every place the Board needs
a fact the engine's read shape does not carry.
