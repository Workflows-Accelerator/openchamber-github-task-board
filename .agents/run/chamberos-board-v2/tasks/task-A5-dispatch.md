[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-sidebar-sections.md]

<env_preflight>
FIRST run and paste raw output: `pwd` (must be /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2), `git rev-parse --abbrev-ref HEAD` (feat/chamberos-board-v2), `git rev-parse HEAD` (must start 341ff45), `git status --short` (empty). If anything differs, STOP and report.
</env_preflight>

<manager_notes>
Base: feat/chamberos-board-v2 at 341ff45 (A4 audited). Small commits, no push.
1. You are the ONLY session in this worktree. Wrap every test or long command in `timeout` (e.g. `timeout 900 npm test`, `timeout 600 node --test --test-timeout=30000 web/tests/*.test.mjs`).
2. Report BOTH suites: `npm test` (currently 618) and `node --test web/tests/*.test.mjs` (currently 538), plus `npm run typecheck`. Paste the raw summary lines.
3. Carry-overs from the A4 audit (do these first, one small commit each):
   a. Undo of a previously unplaced card leaves the blank-line separator added when the marker was written (web/server/board.ts strip path). After set+strip the body must be byte-identical to the original. Add a test.
   b. Note save that fails (409/500/network): the draft stays visible but is not kept anywhere. Keep the draft in the editor with a Retry action (EN + FR) and do not let a poll/refresh overwrite an open, unsaved draft. Add a test.
   c. proof.md for A4 calls the checkboxes "interactive"; they render disabled. Fix the wording in verifications/A4/proof.md.
4. Reuse the A4 markdown module (web/public/markdown.js) for any rendered text in the sections; do not write a second renderer.
5. Every write route you add (checkbox toggle, label removal, reopen) goes through the existing per-issue lock + fingerprint/409 logic from A2. A failed precondition writes nothing to GitHub (assert zero PATCH on the fake).
6. Client view is a presentation filter only; state that in the settings text and in proof.md.
7. Evidence rules: every commit SHA you cite must exist (the manager checks with git). End your report with raw `git log --oneline 341ff45..HEAD` and `git status --short`. Anything not run is NOT RUN.
</manager_notes>
