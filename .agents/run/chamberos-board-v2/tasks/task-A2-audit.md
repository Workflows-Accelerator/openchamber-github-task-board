[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_audit.md]

<step>
Step A2, issue #57 (infinite Canvas). Brief: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A2-infinite-canvas.md]
Hostile-review findings handed to the builder: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A2-hostile.md]
Proof: .agents/run/chamberos-board-v2/verifications/A2/proof.md (in the worktree)
Commits: f7a4f73..af6f066 on feat/chamberos-board-v2 (04b9b38 server, 0d8c44a client, b9163a4 proof, 2eeccd1 hostile fixes, af6f066 hostile proof).
</step>

<extra_focus>
1. DIRTY TREE at handover: the hostile session left an uncommitted one-line change in web/server/app.ts (~line 685, `if (repository) repoBoardCache.delete(repository.full);` in the issue-create route). Decide whether it is correct (can `repository` really be undefined there? if so, is the cache for the combined board still invalidated?). Commit it with an "audit:" message, or revert it, with your reasoning in proof.md. The tree must be clean at the end.
2. Cache invalidation added in 2eeccd1 (repoBoardCache on issue mutations): check EVERY write route (create, edit, order, canvas, status/labels, close, comments if any) invalidates the right repo entry and the combined board, and that a canvas drop followed by a reload really shows the new position (no stale cache within the cache TTL). Prove with a test or a browser run.
3. Concurrency: the builder calls it "fingerprint-verified re-read". Read the PUT /canvas code. Confirm it re-reads the body right before writing, and say plainly what happens when two drops on the same issue race and when another user edited the body between read and write. No claim in proof.md beyond what the code does.
4. 360px canvas-360.png shows a grey shadow band down the left edge with the drawer closed. Check whether the closed sidebar drawer's shadow or a sliver of it leaks into view, at 360 and 768, light and dark. Fix if small.
5. Dot grid: check across zoom 0.2 / 0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 2.5 that dots never get denser on screen or darker than at 100%, and that the adaptive pitch switch does not cause a visible jump or a shimmer while panning.
6. Text sharpness: confirm at 2.5 zoom after the wheel stops that card text is crisp, and that removing will-change did not make panning janky with ~300 cards (measure frame time roughly with the performance panel or a rAF counter over a 2s pan; report the number).
7. Interaction collisions: dragging a card vs panning vs opening the drawer (4px threshold); keyboard +/-/0 only when the canvas has focus (typing "+" or "0" in the search box or the drawer must not zoom); wheel inside the open drawer must not zoom the canvas.
8. Switch Canvas -> List -> Canvas: view state restored, no duplicate listeners (a single drag must produce exactly one PUT).
9. Tests: would canvas.test.mjs still pass if the marker code were reverted? Run `timeout 600 npm test` and the canvas suite with `timeout`, confirm they exit on their own.
Always wrap long commands in `timeout`.
</extra_focus>
