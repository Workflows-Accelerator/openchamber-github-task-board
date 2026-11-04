[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A3-links.md]

<manager_notes>
Base: feat/chamberos-board-v2 at dd9e8ac (A2 complete and audited). Small commits, no push.
1. Exactly ONE session works in this worktree. Wrap every test or long command in `timeout` (e.g. `timeout 600 npm test`, `timeout 120 node --test --test-timeout=30000 <file>`); a previous worker blocked for hours on a hanging test.
2. Carry-over from A2 to check and fix first (small): canvas writes use a per-issue fingerprint and the server answers 409 if it changed. Make sure dropping the SAME card twice in a row (second drop before or right after the first save returns) does not show a false conflict: the client must adopt the new fingerprint returned by the first save (or queue the second save). Add a test. Same rule applies to the new link routes if they touch the body.
3. Link changes (native dependencies) do not change the issue body; do not let them bump or require the body fingerprint unless needed.
4. Wires must stay sharp and correct at every zoom level and after pan; reuse A2's transform, do not add a second coordinate system.
</manager_notes>
