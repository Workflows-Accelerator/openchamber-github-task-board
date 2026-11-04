<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base before A4: d0d5b72. Current tip: 9317aa0. Manager verified clean working tree at dispatch.
A4 commits: 27956d6 (chip nit), b19a9bf (markdown), 8965191 (layout), 46180fd (notes validation), 9317aa0 (UI and proof).
Files: web/public/{app.js,index.html,theme.css,markdown.js,arrange.js,sw.js}, web/server/{board.ts,app.ts}, web/tests/{canvas,markdown,arrange}.test.mjs, .agents/run/chamberos-board-v2/verifications/A4/**.
Tests: timeout 600 npm test; timeout 600 node --test web/tests/*.test.mjs; timeout 120 npm run typecheck.
Do not touch live services/processes, /workspace/releases/board/**, /workspace/.openchamber-data/**, config or credentials, panel/**, service/**, root checkout outside this worktree. No push, merge, live GitHub writes, settings changes, or issue closure. Only stop processes you started yourself.
Preflight facts are authoritative at startup: no initial pwd/ls/git status discovery. Targeted checks before commits, after failures or resumed context are allowed.
You are the ONLY worker in this worktree. The A4 builder has completed; do not ask it to resume.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-notes-arrange.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A4-dispatch.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Review/fix A4 and direct regressions only in the files above. Treat the builder's work as yours to break. No unrelated refactor or new feature. The step brief is the product contract, not permission to repeat a build. Maximum two fix/retest rounds; report remaining problems instead of hiding or skipping them.
Read A4/proof.md in this worktree for the builder's evidence, but reproduce the claims yourself.
</scope>
<manager_findings>
1. ARRANGE OVERLAP / SIZE: canvas-arranged-1280.png hides #101's yellow note underneath #104 and routes the Satellite -> #104 wire through #105. Layout claims zero overlaps but uses fixed row pitch. Prove non-overlap with actual card width/height, long titles and variable note extents, not just distinct coordinates. Honour existing w/h input in arrange.js; keep notes' delta relative to their issue, but reserve enough space for their extents when arranging all so another card does not hide them. Route wires around intervening cards after Arrange using existing A3 geometry, without a second coordinate system. Re-shoot the two-project chain.
2. ONLY UNPLACED + UNDO: show positioned cards/notes remain byte-for-byte fixed in the default mode and new cards do not collide with them. Snapshot saved-vs-unsaved state, not just x/y: Undo must restore absence of coordinates for previously unplaced cards, preserve unrelated marker keys, and undo ONLY successful writes if Arrange partly fails. Arrange with zero unplaced cards, 300 cards, duplicate issue numbers in two repos, shuffled inputs, cycles, and variable dimensions; no automatic PUT or movement on load/poll/filter. Verify progress/error summary and retry safety with a failing middle batch.
3. MARKER ESCAPING / LIMITS: note text may contain literal '-->', '<!-- board-canvas:', newlines, a code fence containing marker examples, Unicode/emoji, quotes, or a long issue body. Prove marker remains one hidden HTML comment and exactly round-trips text without exposing it in GitHub markdown; surrounding issue bytes/CRLF/order marker/unknown keys must be preserved. Enforce the cap on the final serialized body (state clearly chars vs UTF-8 bytes and justify against the upstream contract). Validate note id, text type, finite positions/sizes, duplicate ids and supported colour at server boundary; reject invalid data without writes or silent repair/data loss. Empty notes array must delete only notes.
4. SAVE QUEUE / USER INTENT: notes, card moves and Arrange use the same per-issue queue; ensure snapshots taken before a previous save do not overwrite newer notes. Browser-test rapid text edit -> drag card -> resize note -> Arrange, and a 500 or 409 halfway through. Escape must cancel without blur saving; Cancel must not trigger a premature blur save; Ctrl/Meta+Enter and clicking Save must yield one write. Clicking colour/delete while editing must not lose the text. Failed saves keep recoverable text and a readable message.
5. MARKDOWN SAFETY + CORRECTNESS: the new renderer expressly permits '/' and '#' links even though the step allows ONLY http/https/mailto. Match the contract. Test raw HTML, attribute-breakout, encoded/control-char protocols, protocol-relative URLs, malformed/nested links, placeholder-like input, nested lists, fences longer than 3 characters, inline code containing markdown, quotes/ampersands in URLs, and adversarial 4000-char input for hanging regex. Assert browser DOM has no executing element/event handler/unsafe href, not just string substrings. Checkboxes are DISPLAY ONLY (builder proof calls them interactive). Reusable module should not invent writable checkboxes.
6. UX / PROOF GAPS: in canvas-notes-1280.png no faint note-to-parent connectors are visible. Prove they exist and remain visible when a note is moved sideways or negative, distinct from native dependency wires. canvas-arranged-1280.png clips the last card: make Fit all include notes and project labels and show the whole result via explicit Fit all (do not introduce automatic re-layout). Check small-screen controls including Undo after Arrange, touch note drag/resize, note edit at 100%/200%, dark colours, and French wording. Need French browser screenshot; current catalog has none. No plus-icon plus '+...' button, and remove the newly introduced prohibited device word from A4 proof text as well as code/UI. Do not claim untested states.
7. TEST ACCOUNTING: builder claims prior web 506 -> 527 while adding 10 markdown +15 layout tests plus canvas cases. Explain exact before/after counts per file, any removed/renamed tests and why. Never remove tests to get green. Both suites must exit unaided under timeout; record exit code and actual output totals.
</manager_findings>
<criteria>
All A4 acceptance criteria checked with runtime evidence, and each finding above fixed or explicitly rejected with empirical proof. Zero console/CSP errors. No new unapproved behaviour. Working tree clean with small commits; no production changes. Live writes remain NOT VERIFIED.
</criteria>
<verification>
Run both test suites and typecheck above after the fixes. Drive the real local board server through a browser against the existing fake GitHub only. Re-shoot changed screenshots at 360/768/1280 in light/dark and French. Append a Hostile review section to .agents/run/chamberos-board-v2/verifications/A4/proof.md with each finding, evidence, commands/exit codes, remaining risks and honest NOT VERIFIED. Artifacts/tests must prove actions, not just describe functions.
</verification>
<output>
At most 20 lines: L4 verdict PASS or NEEDS-FIXES; findings found/fixed/open; both suite totals and typecheck; final SHA; proof path; live writes not tested; any blocking decision. Do not call the issue Done or approve human validation.
</output>
