[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_audit.md]

<step>
Step A4, issue #59 (markdown notes under tasks + rebuilt Arrange). Brief: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-notes-arrange.md]
Build dispatch notes: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-dispatch.md]
Hostile-review findings handed to the builder: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-hostile.md]
Proof: .agents/run/chamberos-board-v2/verifications/A4/proof.md (in the worktree), screenshots alongside.
Commits: d0d5b72..1c21069 on feat/chamberos-board-v2 (27956d6, b19a9bf, 8965191, 46180fd, 9317aa0 build; 9317aa0..1c21069 hostile fixes).
Worktree is clean at 1c21069. You are the ONLY session in this worktree. Wrap every test or long command in `timeout`.
Tests: `npm test` runs test/*.test.js only (618). The board's own suite is `node --test web/tests/*.test.mjs` (A3 accepted 506; build claimed 527; hostile claimed 535). Report BOTH counts plus `npm run typecheck`.
</step>

<extra_focus>
You are AUTHORISED to fix small, contained defects yourself (client-side or a server validation/message), commit each with "audit:". Anything larger: report it as a FAIL item with evidence, do not refactor.
1. Honest coverage matrix: map each of the 7 hostile categories in task-A4-hostile.md to concrete evidence (test name, command output, screenshot). Anything not actually run is marked NOT RUN, never PASS.
2. Undo and partial writes in the default "only unplaced" Arrange mode. Inspect the real HTTP payloads sent for clearPosition / undo. Suspect: web/server/app.ts around line 1399 rejects payloads lacking x/y/notes, so Undo of a newly placed card may 400 silently. Prove with a real request against the fake GitHub; fix if broken.
3. Note save / Escape / Cancel races, including touch input, a 500 response and a 409 response. Produce a request-count trace (e.g. save then Escape quickly = exactly one PUT; 409 = user sees a plain conflict message and the draft is not lost).
4. Markdown double-escaping: hostile added escapeHtml(cleanUrl) after the whole source was already escaped. Check the real DOM href for a URL containing `&` and quotes (must not become `&amp;amp;`), plus XSS cases (javascript:, data:, vbscript:, `" onmouseover=`, nested brackets, HTML tags in text).
5. Marker round-trip: note text containing `-->`, `<!-- board-canvas:`, CRLF, non-ASCII/emoji. Body cap: is it counted in characters or bytes, and does it match GitHub's 65536-char limit? Invalid input must be rejected before any write to GitHub (assert zero PATCH calls on the fake).
6. Visuals: note-to-parent connectors still look invisible in canvas-notes-1280.png (suspect the wire layer bounds cull them). The French screenshot still shows "Edit" on every note (untranslated or always-visible control). Fix both if small; re-shoot.
7. Layout determinism (same input twice => identical positions, regardless of card order from GitHub) and test accounting: explain 506 -> 527 -> 535 by listing the added test names; confirm no test was deleted or skipped (grep for .skip/.todo).
Re-shoot every screenshot you changed. Tree clean at the end. Report: Spec PASS/FAIL, Quality APPROVED/CHANGES, commits, both test counts, typecheck.
</extra_focus>
