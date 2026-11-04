[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-notes-arrange.md]

<manager_notes>
Base: feat/chamberos-board-v2 at d0d5b72 (A3 complete and audited). Small commits, no push.
1. You are the ONLY session in this worktree. Wrap every test or long command in `timeout` (e.g. `timeout 600 npm test`, `timeout 300 node --test --test-timeout=30000 web/tests/*.test.mjs`).
2. Report BOTH suites every time: `npm test` (test/*.test.js, currently 618) and `node --test web/tests/*.test.mjs` (currently 506), plus `npm run typecheck`.
3. Carry-over nit from A3 (fix first, tiny): cross-repo drawer chips show the repo twice ("Satellite #201 Distributed pub/sub event bus [Satellite]"). Show it once.
4. Notes extend the A2 canvas marker. Preserve unknown keys and x/y. The A2 per-issue save queue and fingerprint/409 logic must cover note saves too (dragging a card and then editing its note quickly must not false-409). Add a test.
5. Notes and wires share the canvas transform. Text must stay sharp at every zoom (no will-change on the plane; see A2 proof). Notes sit under cards and above wires.
6. Arrange must also route wires sensibly afterwards (A3's port choice by relative position). Show an Arrange screenshot with wires.
7. Markdown renderer goes in its own module (it is reused in B2). Unit tests must include XSS payloads: <script>, <img onerror>, javascript:/data:/vbscript: links, HTML entities, nested emphasis, and a 4000-char note.
</manager_notes>
