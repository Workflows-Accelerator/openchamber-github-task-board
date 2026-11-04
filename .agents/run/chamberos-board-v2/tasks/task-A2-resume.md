[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A2-infinite-canvas.md]

<resume>
A previous worker (ses_b48c1bd6840a9fa336998a5f) started this step and died silently while running `node --test web/tests/canvas.test.mjs` (no output for 25+ minutes, then the session ended with no report). It left UNCOMMITTED work in this worktree on top of f7a4f73:
- M web/server/app.ts (+34 lines, likely the canvas route)
- M web/server/board.ts (+230/-43, likely the canvas marker parse/set)
- ?? web/tests/canvas.test.mjs (new)
Nothing on the client side (web/public/*) was started.

First:
1. Read the diff and the new test. Keep what is correct, fix or discard what is not. You own this state; do not assume it is right.
2. The hang: find why `node --test web/tests/canvas.test.mjs` never finished (an open server/handle not closed, an unresolved promise, a fake GitHub that never answers, a listener left open, an infinite loop in marker parsing on some input...). Always run tests with a timeout, e.g. `timeout 120 node --test --test-timeout=30000 web/tests/canvas.test.mjs`, and run any long command in the background with a timeout so you never block on it. Fix the root cause, not by skipping the test.
3. The board.ts diff removes 43 lines: check the existing board-order marker functions and their tests still behave exactly as before (run web/tests for board/order with a timeout).
4. Commit the server part once its tests pass, then do the rest of the step (client Canvas view, browser proof) as in the brief above. Small commits; do not push.
</resume>
