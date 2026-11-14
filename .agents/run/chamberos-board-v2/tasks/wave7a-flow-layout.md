<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-flow-layout
Branch: feat/wave7a-flow-layout
Base: feat/board-v3 (e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/arrange-flow.test.mjs
Exclusive files you may touch: web/public/flow-layout.js, web/tests/arrange-flow.test.mjs
Do NOT touch: web/public/arrange.js, web/public/app.js, web/public/theme.css, web/server/**, web/tests/arrange.test.mjs, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**.
Forbidden: push, deploy, GitHub writes, `git remote -v`, deletion, delegation.
</env_preflight>

<goal>
Create `web/public/flow-layout.js` exporting `arrangeFlowGraph(cards, options)` (pure ESM JS, zero dependencies, also attaches to `globalThis.arrangeFlowGraph` when `typeof globalThis !== 'undefined'`), plus failing-first tests in `web/tests/arrange-flow.test.mjs`.
</goal>

<requirements>
Keep the implementation concise, readable, and deterministic:
1. **Inputs**: `cards` array of `{ id, key, repo, number, title, stage, priority, order, createdAt, parentKey, parentTitle, dependencies, w, h, notes, activeSession }`. `options`: `{ direction: 'LR' | 'TD', expandedGroups?: Set<string> | string[], cardWidth?: number, cardHeight?: number, gapX?: number, gapY?: number }`.
2. **Grouping (`repo` + `parentKey`)**:
   - Group by `repo`, then by `parentKey` (unparented cards go in `repo + '::standalone'`).
   - Groups are collapsed by default unless their `groupKey` is in `expandedGroups`.
   - Output `groups`: `Array<{ groupKey, repo, parentKey, title, collapsed, total, running, needsMe, done, x, y, w, h, cardIds }>`.
   - Output `positions`: `Record<string, { x, y, w, h, layer, groupKey }>` for cards in expanded groups.
3. **Topological DAG layering & ordering**:
   - Build directed edges (`dep -> card` from `card.dependencies`), break cycles deterministically.
   - Assign layers (longest-path rank so dependencies precede dependents on primary axis: `x` in `LR`, `y` in `TD`).
   - Within each layer, sort deterministically: finite `order` ascending first (ordered before unordered), then `priority` (`urgent > high > normal > low > other`), then `createdAt` ascending, then `number`/`id` ascending. Add a 1-pass barycenter crossing-reduction sweep when dependencies exist.
   - Zero overlaps between cards (including `notes` extents), zero overlaps between group boxes.
4. **Edges**: return `edges: Array<{ from, to, crossGroup, points: Array<{ x, y }> }>` connecting visible nodes (collapsed group node or expanded card).
5. **Scale**: 345 cards across 27 repos completes in `< 100ms` with 0 overlaps and identical output on shuffled inputs.
</requirements>

<steps>
1. Write `web/tests/arrange-flow.test.mjs` covering: empty input, `LR` vs `TD`, `order -> priority -> createdAt` tie-break, cycle breaking, collapsed-by-default group counts & inter-group edges, expanded group zero-overlap with notes, determinism on shuffled input, and 345-card benchmark.
2. Run tests (confirm they fail before implementing `flow-layout.js`), then write `web/public/flow-layout.js`.
3. Run `node --test --test-timeout=60000 web/tests/arrange-flow.test.mjs` and verify all pass.
4. Commit as `feat(canvas): add deterministic flow-graph layout module`.
</steps>

<output>
At most 8 lines: STATUS, EXPORTS, TEST_COUNTS (exit code, ms for 345 cards), COMMIT, NOT_VERIFIED.
</output>
