# Engine board

A read-only view of one task-engine tree, read live through the engine's own
CLI. Two pages: `index.html` is the Board, one scope at a time; `list.html` is
the List, every level at once. The board computes no state: it prints the
engine's words and rolls up the counts over `children`.

```sh
node engine-board/main.ts --db <store> --project <id> --tree-key <key> --root <task id>
npm run typecheck
node --test test/engine-board.test.js
```

Open `engine-board/index.html` and `engine-board/list.html` directly. Neither
page makes a request, loads an external asset or needs a build step. Script adds
scope entry, the `Here` marker and the detail dialog; every card and row is in
the HTML before it runs, so the pages read with JavaScript off.

## What is here

| Path | Role |
|---|---|
| `engine-board/model.ts` | The engine's own field names folded into a tree. DOM-free, Node-free. |
| `engine-board/rollup.ts` | Containment, progress, the lane plan and the disagreement check, all over `children`. |
| `engine-board/scope.ts` | Scope keys, the hash round trip and the section traversal. |
| `engine-board/board-render.ts` | Board and List HTML, the dialog markup and the one inline script. |
| `engine-board/live-source.ts` | `EngineTreeSource` over `task graph`, `task status`, `task project show`, `task store check`. |
| `engine-board/main.ts` | Reads the live source once and writes both pages. |
| `engine-board/fixtures/source.ts` | The same seam over the frozen capture, for tests only. |
| `engine-board/fixtures/*.json` | Frozen `--json` payloads and capture metadata. |
| `engine-board/fixtures/capture.sh` | Rebuilds the capture from the pinned engine revision. |
| `engine-board/render.ts` | The slice-2 single-page renderer. Kept because its tests are kept; the pages no longer use it. |

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
states); the renderer prints that and never assumes a capture. A read that
cannot name its revision and its read time is printed as `Unknown source`, never
as `Live read`.

The live source normalizes two shapes the CLI has changed under it, and throws
rather than guess:

- `task status --json` prints the status object itself for one id and
  `{"tasks":[…]}` for two or more. Both are accepted.
- `task graph --json` prints `{from,to,kind}` at schema 7 and
  `{blocker_task_id,blocked_task_id,kind}` now. Both are folded to one internal
  edge, `{from,to,kind}`.

It also refuses a graph whose root is not the requested task, or whose
`tree_key` differs from the request: a page built from the wrong tree would look
right and be wrong.

## Field names

The model and the page use INTERFACE §2's words, not the board's:

- `rest_state` — never `status`. A value outside the vocabulary is rendered as
  `Unknown state` with the raw string shown; it is never dropped or renamed.
- `tree_key`
- `runner_slot` / `runner_id` — `null` with `runner_slot_reported` /
  `runner_id_reported` false means the read did not print it, which is not the
  same as "no runner"
- `runners_available` — false when the runner list was not read, so an empty
  list is not rendered as "none"
- `blocked_by` and `after` — `edge.kind` values
- `phase`, `slot`, `wait`, `hold`, `handoff_revision` — `task status` fields

## What the board states

- **Progress** (ruling 1) — one thin bar and `N of M finished` on both views,
  over every placed row.
- **Empty lanes** (ruling 2) — a lane with no card is not drawn; the level line
  says `N lanes empty` once, in the same words everywhere.
- **List scope** (ruling 3) — `Showing everything`, and the current scope's row
  carries `Here`.
- **No second back link** (ruling 4) — the trail is the only way up.
- **Out-of-scope blocker** (ruling 5) — a blocked card names its blocker by
  title, read from the whole tree, not from its own level.
- **Engine disagreement** (ruling 6) — a `ready` row whose `blocked_by` is not
  done keeps the engine's word and gains one line: `Engine defect: recorded
  ready, but <title> is not done.` The board never re-derives the state.
- **Unknown source** (ruling 7) — a read without a revision or a read time is
  `Unknown source`.

## What the capture covers

Pinned to `/workspace/code/task-engine` at `33651ee`, schema revision 7. The
tree read is `graph --tree <root_task_id> --depth 8`; the default depth is 2 and
truncates deeper trees without a marker. The live source passes no `--depth`
because the current CLI returns the whole tree without one; `truncated` is still
honoured if a payload carries it.

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

The capture is older than the running engine and is no longer payload-identical
to it: it has no `title` on any node, no `max_concurrency` on the project, and
`slot`/`phase` are `null` where the live store has values. It stays because it
is the only coverage of `blocked`, the disagreement case and the defect shapes;
the live source is the only thing the pages are built from.

## Gaps

`GAPS.md` is the part that matters for integration: every place the Board needs
a fact the engine's read shape does not carry.
