<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-flow-layout
Branch: feat/wave7a-flow-layout
HEAD: a355835 (base feat/board-v3 e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/arrange-flow.test.mjs web/tests/arrange.test.mjs
Forbidden: push, deploy, touching files outside web/public/flow-layout.js and web/tests/arrange-flow.test.mjs, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, GitHub writes, delegation.
</env_preflight>

<goal>
Conduct a hostile review of `a355835` (`web/public/flow-layout.js` and `web/tests/arrange-flow.test.mjs`) to find any layout overlap, cycle-breaking bug, cross-group edge bug, determinism failure, prototype-pollution issue, or performance cliff. Do not assume what was done is right.
</goal>

<attack_checklist>
1. Read `web/public/flow-layout.js` and `web/tests/arrange-flow.test.mjs` completely.
2. Check **zero overlaps** rigorously:
   - What if a card has attached `notes` (multiple sticky notes, tall notes, negative/large note dimensions) in both `LR` and `TD`? Does the group container box AND sibling card spacing include note extents?
   - What if two expanded groups sit side-by-side or stacked, or one expanded group sits next to a collapsed group? Do group boxes ever overlap each other or clip member cards/notes?
   - What if `cards` have huge/zero/NaN `w`, `h`, `order`, `createdAt`, or duplicate `id`/`key`?
3. Check **DAG & cross-group edges**:
   - What if `card.dependencies` uses issue numbers (`"12"` or `#12`), cross-repo keys (`owner/repo#12`), or `card.id`?
   - What if a 3-node or 4-node cycle exists, or a self-dependency (`A -> A`)? Does cycle breaking ever drop valid non-cyclic edges or hang?
   - When Group A is expanded and Group B is collapsed (or both expanded), do `edges` connect the exact visible nodes (`card.id` vs `groupKey`) with valid `points`? What if Group A has multiple edges to collapsed Group B — are duplicate edges collapsed cleanly?
4. Check **intra-layer ordering & barycenter**:
   - Does `order` override actually win over `priority` and `createdAt`, or does the barycenter sweep accidentally scramble an explicit `board-order`?
   - Does `LR` place dependencies strictly left (`x1 < x2`) and `TD` strictly top (`y1 < y2`)?
5. Check **345-card scale when partially/fully expanded** (not just all-collapsed!): test 345 cards with several expanded groups and cross-group edges, verifying `< 100ms` and zero overlaps.
6. Check CSP / browser compatibility: zero external imports, zero `eval`, clean `globalThis.arrangeFlowGraph` attachment, safe against `__proto__`/`constructor` keys.
7. Fix any genuine defect you find with a failing test first, re-run `node --test --test-timeout=60000 web/tests/arrange-flow.test.mjs web/tests/arrange.test.mjs`, and commit as `fix(canvas): harden flow-layout engine after hostile review` (or report clean APPROVED if zero defects found).
</attack_checklist>

<output>
At most 10 lines: VERDICT (APPROVED or FIXED_AND_APPROVED), FINDINGS, TESTS (count + exit code + 345-card ms), COMMIT.
</output>
