<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Reviewed range: a6f61f3..4b9c216 (a6f61f3 is the LIVE V4-2 release receipt; everything after it is V4-3)
Commits: cd97f8e source, 3aa50f2 tests, a58bcb1/78abf40/6127e35/b57e894/80fd1f5 evidence and probe, 254a339/947b80e/854522c/7d8e354 hostile fixes, 4b9c216 hostile evidence.
Tree: tracked clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS, never stage, never modify.
Root checkout on ops/task-board-activation: never edit, commit or switch there. Read-only for this review.
Chromium: source .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh. Delivery smoke needs a 900000 ms foreground timeout. Suites strictly sequential. Never end your turn with a job you started still running.
Constraints: no push, no deploy, no /workspace/releases, no /workspace/code/openchamber-config, no /workspace/.openchamber-data, no real GitHub mutation, no credential output, no `git remote -v`, no deletion, no application edits.
</env_preflight>

<goal>
Independently verify V4-3: a task may wait for the human only when the human can settle it by clicking — a screenshot, a short video, a link, or a question with preset answers — and "an agent is reviewing" must read as exactly that. You did not write this code. Find where it is wrong, unsafe or unproven, and say plainly whether it may be published.
</goal>

<user_words>
"beaucoup des issues actuel sont en mode in review ou alors elles attendent une validation humaine. Je pense que toutes les tâches n'ont pas pour vocation d'avoir une validation humaine... idéalement on peut le faire depuis le board... valider des screenshots ça ça marche bien ou aller sur un lien et faire quelque chose, ça marche bien aussi. Mais tout ce qui nécessite des actions complexes, type faire du code, aller faire une commande, lancer un serveur de dev... c'est trop compliqué, et globalement, les humains ne le feront pas."
The test of SPEC PASS is whether the product now enforces that sentence, in the user's own terms, and whether a card that cannot be settled by clicking is impossible to create through the board.
</user_words>

<what_the_authors_claim>
Read verifications/V4-3/README.md first, then verify each claim yourself:
- The body carries a `### Human Review:` section with `- Artifact: image|video|link|question`, `- URL:` and `- Instruction:`; parser states ready/settled/missing/malformed with precise reasons; 200-char instruction and 2048-char URL caps; last section wins; fenced and indented headings ignored; https required for an inline image.
- Server-side refusal with a precise 4xx and zero writes on: creation in the waiting state, the status route, the qualified multi-repo status route, a generic reopen of a closed waiting task, and a body edit that would remove an artifact from a waiting task.
- Answering a gated question settles it and moves the task out of the waiting column ("Answer received" / "Réponse reçue").
- Client: one primary action per artifact kind, inline image with fallback when it fails to load, precise reason for legacy and malformed, in-review asks nothing, EN and FR key-for-key equal.
- Evidence: 84-row browser matrix (1248 checks, 0 fail, 96 screenshots), framing 12/12 with the 0.55 floor and Show all at 0.315/0.344, delivery smoke 14/14 in 308 s, focused tests 34/34, web suite 706/706, npm test 618/618, typecheck and esbuild clean.
</what_the_authors_claim>

<known_limitations>
Rule on each: blocks publication, or ships with a stated caveat, and what the user must be told.
1. Medium, not fixed: a tool outside the board can add status:needs-human and bypass the write-time guard; the board then presents "Waiting for an artifact" with reason no_section and the drawer status control. Is that honest and recoverable, or a dead end?
2. Low: the original probe asserted instruction height>0 only — no viewport or hit-test check. The hostile pass added 30 assertions. Is the probe now honest, or still self-fulfilling?
3. Low: two delivery-smoke screenshots (`matrix-picker-360-*`) swapped between runs while all 14 sections passed. Environment noise or a real nondeterminism?
4. Carried from V4-2: a saved ai_issue_prompt overrides the new default prompt, the panel "Quick Choices" does not render `::` options, option lines must stay contiguous, details cut at 2,000 characters, a non-standard 422 reads as outcome-unknown, note count is a floor above 100 comments.
</known_limitations>

<what_to_check>
1. Read `git diff a6f61f3..4b9c216` yourself, including web/server/board.ts, web/server/app.ts, web/public/app.js, index.html, theme.css, docs/issue-body-contract.md §2.9, the two prompt constants in panel/core.ts and the shipped panel/main.js strings, and the four V4-3 test files plus the probe. Do not rely on the summaries.
2. Attack the write paths yourself, not only the ones with tests: creation, status, qualified status, generic reopen, /reopen, close, label remove, body edit, question answer, and an issue edited directly on GitHub. For each: can a waiting card exist with nothing to click, and does a refusal write nothing (check the fake GitHub's recorded calls)?
3. Judge the four hostile fixes: reopening a closed waiting task (254a339), answering a gated question (947b80e), http image (854522c), failed image load (7d8e354). Do they hold, and did any of them change behaviour the user did not ask for? In particular, is moving a settled question to status:in-progress right, or does it steal the human's decision?
4. Parser edge cases with real calls: CRLF, two sections, duplicate fields, caps at and one over, javascript:/data:/http:/relative URLs, wrong case, Markdown in the instruction, a body that is only the section.
5. Presentation honesty at 360 and 1280, light and dark, EN and FR: is the legacy card recoverable by the user (can they move it out of waiting themselves), does the in-review card ever ask something, is the inline image's fallback precise, is any action clipped or covered.
6. Non-regression on the released surfaces, re-run not re-read: V4-2 agent notes as append-only GitHub comments, Markdown Decisions with presets, D37 0.55 floor with the honest legend and Show all, D38 rail toggle, filter and focus return state, drag save and rollback, Arrange + Undo, strict CSP with no inline styles, zero "n8n"/"mobile"/emoji, dot grid unchanged, Canvas/Canevas and List/Liste.
7. Run the suites yourself, sequentially: focused V4-3 tests, the web suite, `npm test`, typecheck, esbuild for web/server.ts and the client, the browser probe, the framing probe, and the delivery smoke with the long timeout. Spot-check that the JSON agrees with the logs.
</what_to_check>

<verdict>
- SPEC: PASS or FAIL for a6f61f3..4b9c216, in the user's terms.
- QUALITY: APPROVED or CHANGES REQUIRED, severity per finding, and a ruling on each known limitation.
- PUBLISH: YES or NO, with the exact caveats to tell the user before it goes live.
Write your evidence under .agents/run/chamberos-board-v2/verifications/V4-3-L4/ and commit it there. Do not fix application code; report it. Do not push.
</verdict>
