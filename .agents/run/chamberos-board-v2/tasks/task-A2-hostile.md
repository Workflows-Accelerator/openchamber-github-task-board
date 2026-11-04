[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<role>
You are the L4 hostile reviewer for Step A2 (issue #57). The build was done by another session at tip b9163a4 (commits 04b9b38, 0d8c44a, b9163a4 on top of f7a4f73). Treat its work as yours to break.
</role>

[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_hostile.md]

<step_brief>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A2-infinite-canvas.md]
</step_brief>

<manager_findings>
From the manager's screenshot and git check. Verify each one; fix it or prove it wrong.
1. Blurry text at 200% zoom (canvas-1280-zoom-200.png): card text is visibly rasterized and soft. Likely `will-change: transform` or a scale applied to a bitmap layer. Text must be sharp at every zoom once movement stops.
2. At 25% the dot grid vanishes completely (canvas-1280-zoom-025.png). Fading is allowed, but a blank plane gives no sense of panning. Prefer keeping faint, small, sparse dots (for example a coarser grid step at low zoom) that never get denser or darker than at 100%. Re-shoot 0.25 / 0.5 / 1 / 2.
3. 360px proof is not a proof: canvas-360.png, canvas-360-dark.png and canvas-360-touch.png all show the sidebar drawer open over the canvas. Shoot 360px with the drawer closed, and prove touch pan and pinch with before/after screenshots and the numbers (transform values) from CDP touch emulation.
4. At 1280 on first load, the right column of cards is cut off at the viewport edge, under the zoom controls (canvas-1280.png). First visit with no saved view state should fit all cards (or at least show them all fully), clear of the zoom controls.
5. "ETag concurrency" claim on PUT /canvas: GitHub's PATCH issue does not honour If-Match. Check what the code really does. The brief requires re-reading the body right before writing (same as the order route). If the ETag part is decorative, either remove the claim or make it real. Nothing fake.
6. proof.md does not show these criteria explicitly. Prove them with the actual bytes or a test:
   - the fake GitHub body contains exactly ONE marker after two successive drops and is otherwise byte-identical (CRLF, fenced code with marker-like text, existing board-order marker);
   - a card dropped, then page reloaded, stays put;
   - unpositioned cards are never written without a drop (count PUT calls on load, Fit all, Reset view and zoom: must be 0);
   - a save failure (500) reverts the card with a plain message.
7. Why did the first build worker hang on `node --test web/tests/canvas.test.mjs`? Confirm that the full `npm test` and the canvas test exit on their own with no open handles. Run them with `timeout`.
8. board.ts lost 43 lines in 04b9b38. Confirm the board-order marker behaviour and its tests are unchanged.
Always wrap long commands in `timeout` (for example `timeout 600 npm test`).
</manager_findings>
