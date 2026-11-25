# Engine board

A read-only view of one task-engine tree, read live through the engine's own
CLI. Two pages: `index.html` is the Board, one scope at a time; `list.html` is
the List, every level at once. The board computes no state: it prints the
engine's words and rolls up the counts over `children`.

```sh
node engine-board/main.ts --db <store> --project <id> --tree-key <key> --root <task id>
npm run typecheck
npm test
npm run test:page   # real browser over file://, Obscura CDP on PATH
```

Open `engine-board/index.html` and `engine-board/list.html` directly. Neither
page makes a request, loads an external asset or needs a build step. Without
script the Board is the List body: one stacked tree, every row and every count
already in the HTML. Script adds scope entry, the `Here` marker, the detail
dialog and, when the data block cannot be read, the one quiet line saying the
interactive view did not start. The dialog is built on click from one inline
JSON block, so no inert `<dialog>` is shipped per task.

## What is here

| Path | Role |
|---|---|
| `engine-board/model.ts` | The engine's own field names folded into a tree. DOM-free, Node-free. |
| `engine-board/rollup.ts` | Containment, progress, the lane plan and the disagreement check, all over `children`. |
| `engine-board/scope.ts` | Scope keys, the hash round trip and the section traversal. |
| `engine-board/board-render.ts` | Board and List HTML, the inline data block and the one inline script. |
| `engine-board/live-source.ts` | `EngineTreeSource` over `task graph`, `task status`, `task project show`, `task store check`. |
| `engine-board/main.ts` | Reads the live source once and writes both pages. |
| `test/fixtures-source.ts` | The same seam over the frozen capture. Tests only; no shipped page imports it. |
| `test/engine-board.test.js` | The renderer and model, asserted as data and as strings. |
| `test/page.test.mjs` | The page itself: a real browser over `file://` (`npm run test:page`). |
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
states); the renderer prints that and never assumes a capture. A read that
cannot name its revision and its read time is printed as `Unknown source`, never
as `Live read`.

The live source normalizes two shapes the CLI has changed under it, and throws
rather than guess:

- `task status --json` prints the status object itself for one id and
  `{"tasks":[…]}` for two or more. Both are accepted.
- `task graph --json` prints `{from,to,kind}` at schema 7 and
  `{blocker_task_id,blocked_task_id,kind,satisfied_by}` now. Both are folded to
  one internal edge, `{from,to,kind,satisfied_by}`; a schema-7 edge has
  `satisfied_by: null`, which is "not read", never an assumed `["done"]`.

It also refuses a graph whose root is not the requested task, or whose
`tree_key` differs from the request: a page built from the wrong tree would look
right and be wrong.

A `--tree` read is whole by contract, so the source refuses a partial one: a
payload with `truncated: true` is an error, and so is a `next_cursor` that is
not `null`. A missing task rendered as "absent" is the bug this line of work
started with.

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

- **Progress** (ruling 1) — one thin bar and `N of M done` on both views, over
  live placed rows. Archived rows never enter `M`; they are named beside it
  (`1 of 7 done · 2 skipped · 4 archived`). A settled state that is not `done`
  (`failed`, `cancelled`, `skipped`) is named in lane order instead of being
  absorbed into the numerator: the board does not call a failure or a skip
  "finished". The bar's accessible name is `Done share`, not `progress`.
- **Empty lanes** (ruling 2) — a lane with no card is not drawn; the level line
  says how many vocabulary lanes are empty once, in the same words everywhere.
- **Every count names a class and a scope** — the level line reads
  `3 live · 2 archived in this level · 7 lanes empty`; there is no bare task
  count in the scope header. The progress line is the whole tree's and carries
  that name as its accessible label.
- **A container's facts** — the counts line on a container (`2 inside · 1 done ·
  2 archived`) is a button that opens the row's own panel; the title still
  enters the scope, and a leaf title still opens its panel. An archived-only
  container reads `2 archived inside · no live work`, so two zeroes do not hide
  the only non-zero fact.
- **List scope** (ruling 3) — `Showing everything`, and the current scope's row
  carries `Here`.
- **No second back link** (ruling 4) — the trail is the only way up.
- **Out-of-scope blocker** (ruling 5) — a blocked card names its blocker by
  title, read from the whole tree, not from its own level.
- **Engine disagreement** (ruling 6) — a `ready` row with a blocker its edge's
  `satisfied_by` does not accept keeps the engine's word and gains one line:
  `Engine defect: recorded ready, but <title> is <state>.` A blocker the edge
  accepts (`failed`, `skipped`) is no disagreement, and an edge that did not
  carry `satisfied_by` cannot accuse the engine. The board never re-derives the
  state.
- **Archived** (interfaces §1) — an archived row stays where it is with an
  `Archived` marker, never hidden. An archived tree says `Archived` in the scope
  header. `containment` keeps archived descendants out of `inside`/`done` and
  names them as their own count, so a closed subtree does not read as unfinished
  live work.
- **Unknown source** (ruling 7) — a read without a revision or a read time is
  `Unknown source`.
- **Duplicates are a read defect** — a graph payload that repeats a task id is
  one row, and the first read is kept. The repeat is named under **Read
  defects** with the kept node key; a payload difference the page normalises is
  never a difference the page hides.
- **A page that cannot start says so** — if the inline data block is missing or
  unreadable, the Board keeps the no-JS tree and prints one quiet line: the
  interactive board could not start, why, and that the full list is shown. The
  default view never degrades into the other view in silence.

## What the capture covers

Pinned to `/workspace/code/task-engine` at `33651ee`, schema revision 7. The
tree read is `graph --tree <root_task_id> --depth 8`; the default depth is 2 and
truncates deeper trees without a marker. The live source passes no `--depth`
because the current CLI returns the whole tree without one.

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

## Limitations we keep

These are deliberate and visible, not defects waiting to be discovered:

- **`provenance.operations` is hand-written.** The live source lists the verbs it
  intends to call; it is not derived from the calls actually made. A source that
  gained a call would print an incomplete list until someone edited it.
- **The engine default path is hard-coded.** `main.ts` defaults `--engine` to
  `/workspace/code/task-engine`; another checkout needs the flag (or
  `ENGINE_*`/`TASK_DB` environment fallbacks, which the usage line does not
  list).
- **The lane order is hand-kept.** `LANE_ORDER` and `STATE_WORDS` mirror the
  engine's vocabulary. A new engine state gets its own `Unknown state` lane with
  the raw string shown, and `N lanes empty` counts only the eight known lanes.
  It never disappears, but it is not a designed lane until the order is updated.
- **`task_title` is a capability, and the page says so.** When a payload carries
  no title the row shows its node key with `title not read`, and the dialog's
  `State`/`Node key` facts are unchanged. A key is never silently shown as if it
  were a title.

## Gaps

`GAPS.md` is the part that matters for integration: every place the Board needs
a fact the engine's read shape does not carry.
