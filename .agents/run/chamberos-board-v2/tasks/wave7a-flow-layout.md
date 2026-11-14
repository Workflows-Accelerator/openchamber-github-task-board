<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-flow-layout
Branch: feat/wave7a-flow-layout
Base: feat/board-v3 (e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/arrange.test.mjs web/tests/arrange-flow.test.mjs
Exclusive files you may touch: web/public/arrange.js, web/tests/arrange-flow.test.mjs
Do NOT touch: web/public/app.js, web/public/theme.css, web/server/**, web/tests/arrange.test.mjs, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**.
Forbidden: push, deploy, GitHub writes, `git remote -v`, deletion, delegation, weakening existing tests.
</env_preflight>

<goal>
Build the deterministic flow-graph auto-layout engine (`arrangeFlowGraph`) inside `web/public/arrange.js` (keeping `arrangeCards` 100% intact and backwards-compatible) so the canvas can replace status columns with a readable mind-map + execution-order workflow graph.
</goal>

<context>
Read first:
- `web/public/arrange.js`
- `web/tests/arrange.test.mjs`
Notice `web/public/arrange.js` is loaded both as ESM (`import { arrangeCards } from '../public/arrange.js'`) and in the browser `<script>` / module context (`window.arrangeCards`). Keep zero external dependencies and CSP-safe pure JS.
</context>

<requirements>
1. **Preserve `arrangeCards(cards, options)`**: Every existing test in `web/tests/arrange.test.mjs` must continue to pass untouched.
2. **Add `export function arrangeFlowGraph(cards, options = {})`** (and attach to `globalThis.arrangeFlowGraph` when `typeof window !== 'undefined'` if appropriate — check how `arrange.js` currently exports):
   - **Inputs per card**: `{ id, key, repo, number, title, stage, priority, order, createdAt, parentKey, parentTitle, dependencies, w, h, notes, activeSession }` (all optional fields must degrade gracefully).
   - **Orientations (`options.direction`)**: `'LR'` (left-to-right, default) and `'TD'` (top-to-bottom).
   - **Grouping (`repo` + `parentKey`)**:
     - Group cards first by `repo`, and inside each repo by `parentKey` (cards without `parentKey` belong to an explicit standalone/unparented bucket per repo, e.g. `repo + '::standalone'`).
     - **Collapsed by default**: `options.expandedGroups` (Set or Array of group keys; default empty = all collapsed).
     - When a group is **collapsed**, emit a single group summary node `{ groupKey, repo, parentKey, title, collapsed: true, total, running, needsMe, done, x, y, w, h, cardIds }` and compute inter-group dependency edges (deduplicated) between collapsed groups/visible nodes!
     - When a group is **expanded**, lay out its member cards cleanly inside a bounded group container `{ groupKey, repo, parentKey, title, collapsed: false, x, y, w, h, padding, cardIds }` with zero overlaps between cards, notes, or sibling groups.
   - **Execution-order DAG layout (exceptional auto-layout)**:
     - Build directed dependency edges (`dep -> card` where `card.dependencies` lists `dep`). Handle both same-repo issue numbers and cross-repo keys cleanly.
     - Deterministic cycle breaking (never infinite loop).
     - Topological layer assignment (longest-path layering so dependencies always precede dependents along the primary axis `LR` x or `TD` y).
     - Crossing-minimization pass (2-sweep barycenter heuristic across adjacent layers) so dependency wires cross as little as possible.
     - **Deterministic intra-layer tie-breaking**:
       1. Manual override `order` (numeric, lower first; cards with finite `order` sort relative to their value or before unordered? Wait: let's support explicit numeric `order` sorting first among ordered cards, or unify: if both have finite `order`, smaller `order` first; if one has finite `order` and the other does not, ordered comes before unordered unless a dependency forces rank! Wait: make it crystal clear and documented: among cards in the same layer, finite `order` comes before null/undefined `order`, sorted ascending; then `priority` (`urgent` > `high` > `normal` > `low` > unknown); then `createdAt` ascending (oldest first); then numeric `number` / `id` ascending).
     - **Zero overlaps**: honor each card's `w`, `h`, and attached `notes` bounding boxes (`getCardExtents`-style) so no card or note ever overlaps another card, note, or group box.
     - **Edge routing**: return `edges: Array<{ from: string, to: string, crossGroup: boolean, points: Array<{ x: number, y: number }> }>` connecting source right/bottom port to target left/top port with clean orthogonal/elbow waypoints around obstacles.
   - **Determinism & performance**:
     - Shuffled input order yields byte-for-byte identical coordinates.
     - 345 cards across 27 repos runs in `< 100ms` with 0 overlaps (both all-collapsed and partially/fully expanded).
</requirements>

<steps>
1. Write failing tests first in `web/tests/arrange-flow.test.mjs` covering:
   - Empty/invalid inputs
   - `LR` vs `TD` orientation
   - Topological ranking + intra-layer ordering (`order` override -> `priority` -> `createdAt` -> `number`)
   - Cycle breaking without infinite loops
   - Collapsed-by-default grouping by `repo` + `parentKey` (group summary counts `total`, `running`, `needsMe`, `done`, inter-group edges)
   - Expanded groups bounding boxes + zero overlap with attached notes and sibling groups
   - Crossing minimization (e.g. criss-cross diamond resolves cleanly)
   - Determinism on shuffled inputs
   - 345-card / 27-repo benchmark (`< 100ms`, 0 overlaps)
2. Implement `arrangeFlowGraph` cleanly in `web/public/arrange.js` without breaking `arrangeCards`.
3. Run `node --test --test-timeout=60000 web/tests/arrange.test.mjs web/tests/arrange-flow.test.mjs` and verify 0 failures.
4. Commit as `feat(canvas): add deterministic flow-graph auto-layout engine`.
</steps>

<output>
At most 10 lines: STATUS, EXPORTS, TEST_COUNTS (exit code, ms for 345 cards), COMMIT, NOT_VERIFIED.
</output>
