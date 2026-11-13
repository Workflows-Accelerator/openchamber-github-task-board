<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: a6f61f3 (V4-2 is LIVE as release e604b9e-20261112; tracked tree clean)
Untracked and OFF LIMITS: .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — never stage, never touch.
Root checkout: /workspace/code/openchamber-github-task-board on ops/task-board-activation — DO NOT modify, switch or commit there.
Runtime: Node 20 host binaries; Chromium only through .agents/run/chamberos-board-v2/verifications/V4-2/scripts/browser-env.sh (already extracts the needed libraries). Existing probes live in verifications/V4-2/scripts and verifications/V4-2-L4*/scripts — reuse them, do not write a new harness unless the surface needs one.
Suites run SEQUENTIALLY. Delivery smoke needs a 900000 ms tool timeout. Never end your turn with a job you started still running.
Hard limits for THIS part: local commits only, NO git push, NO deploy, NO /workspace/releases, NO /workspace/code/openchamber-config, NO /workspace/.openchamber-data, NO real GitHub write of any kind (labels, comments, bodies). Everything is proven against the synthetic fake GitHub. No credential output, no `git remote -v`, no file deletion.
</env_preflight>

<goal>
Make "waiting for you" mean something again, in the product. A task may wait for the human only when the human can settle it by clicking: a screenshot, a short video, a link, or a question with preset answers. Anything that would need the human to write code, run a command or start a dev server is not a human gate. Reclassifying the existing issues is a separate, later step with its own brief and its own explicit authorization: do not perform any GitHub write here.
</goal>

<user_words>
"beaucoup des issues actuel sont en mode in review ou alors elles attendent une validation humaine. Je pense que toutes les tâches n'ont pas pour vocation d'avoir une validation humaine... idéalement on peut le faire depuis le board... valider des screenshots ça ça marche bien ou aller sur un lien et faire quelque chose, ça marche bien aussi. Mais tout ce qui nécessite des actions complexes, type faire du code, aller faire une commande, lancer un serveur de dev... c'est trop compliqué, et globalement, les humains ne le feront pas."
The owner approved this wave explicitly ("enchaîner, écritures réelles autorisées") but the real writes belong to the next step; this one is code only.
</user_words>

<requirements>
1. Define in code what a human-reviewable artifact is: an image URL rendered inline, a short video URL, or an external link, each with a one-line instruction saying what to look at. Store it inside the issue body in a dedicated parseable section, following the existing body-section conventions in web/server/board.ts (the same convention the canvas marker, notes and questions already use). Do not invent a second document format and do not store it out of band.
2. Expose it on the board payload as part of the issue view, and enforce the rule server-side: a transition into the state the board presents as "waiting for you" is rejected with a 4xx and a precise message naming the missing artifact when the body carries none. Tests for accept and reject, including the malformed-artifact case.
3. Enforce it in the client: a card waiting for the human shows the artifact, the one-line instruction and exactly one primary action per artifact type ("Ouvrir la capture", "Regarder la vidéo", "Ouvrir le lien", "Répondre"), in EN and FR. No card in that state without an artifact; legacy data that has none must show as "waiting for an artifact" with the precise reason, never as a silent wait.
4. Separate "another agent is reviewing" from "you must decide". Today both read as in review. `status:in-review` means an agent is reviewing; only the artifact-gated state asks anything of the user. Prefer a presentation-level distinction; use a new label only if a label is unavoidable, and say which you chose and why.
5. Preset answers in this state reuse the V4-2 open-question shape and renderer (`  - label :: gist :: details`, details disclosure, free-text fallback). Do not build a parallel question format. If the artifact state carries a question, the question must offer presets when the body defines them and must stay answerable with free text.
6. This must not weaken what V4-2 just shipped: agent notes as GitHub comments, Markdown Decisions, append-only comments, conditional requests, 0.55 framing floor, D38 rail, filter/focus return state, drag save and rollback, Arrange + Undo, strict CSP, no inline styles, zero "n8n"/"mobile"/emoji, dot grid untouched, views Canvas/Canevas and List/Liste.
</requirements>

<authoring_and_docs>
Whatever section you define must be documented where issue authors and the panel prompts read it, exactly as the option convention was in V4-2: `docs/issue-body-contract.md` (add the section, reconcile it with the "self-contained prose" rule) and the two prompt constants in `panel/core.ts` plus the shipped `panel/main.js` strings (the shipped-parity test must stay green). Add a test that extracts the documented example and parses it with the real parser, so the document and the code cannot drift apart again.
</authoring_and_docs>

<verification>
1. Real Chromium at 360x800, 390x844 and 1280x900, Light and Dark, EN and FR: a card waiting with an image artifact, with a video artifact, with a link artifact, with a preset question; a legacy waiting card without artifact showing the precise reason; an in-review card that reads as agent review and asks nothing of the user. Zero console errors, zero CSP violations.
2. Prove the server rejection with a real request against the synthetic fixture: no artifact -> 4xx with the precise message; valid artifact -> accepted; malformed artifact -> rejected, not silently accepted.
3. Prove the documented example parses, and prove the lock by mutating the document (then restoring it byte-identically and confirming a clean tree).
4. Re-run the released non-regression surfaces you could plausibly disturb, plus the V4-2 note flow and Decisions rendering.
5. Suites sequentially with real counts and exit codes: `npm test` (618 baseline), `node --test --test-timeout=60000 web/tests/*.test.mjs` (672 baseline), typecheck, esbuild client and `web/server.ts`, the browser probe, the framing probe, and the delivery smoke with the long timeout. No assertion weakened, nothing skipped to get green; report a load timeout separately from a failure.
6. Evidence under .agents/run/chamberos-board-v2/verifications/V4-3/: README with measurements, JSON, raw logs with exit codes, screenshots. Separate commits for source, tests and evidence.
7. Before reporting, conduct a hostile review of your own edits to find what you missed or broke. Do not assume you are right. Re-run the real probes, not only unit tests, and record every correction.
</verification>

<scope>
Owned: web/public/app.js, web/public/index.html, web/public/theme.css, web/server/board.ts, web/server/app.ts, web/server/github.ts, web/tests/**, docs/issue-body-contract.md, panel/core.ts and the shipped panel/main.js strings only for the new section, scripts/generate-delivery-smoke.mjs only if a new surface needs coverage, and verifications/V4-3/**.
Read-only: web/public/arrange.js, web/public/markdown.js internals, panel/** outside those prompt strings, service/**, prior evidence directories.
Forbidden: any GitHub write, deployment, and everything listed in the preflight.
Do not delegate further. If a genuine product fork appears, report it instead of choosing silently.
</scope>

<output>
At most 20 lines Markdown: STATUS, COMMITS, POLICY (where the artifact is defined, parsed, enforced server-side, file:line), UI (artifact actions, legacy no-artifact state, in-review vs needs-you), DOCS_AND_LOCK, PRESETS, SELF_HOSTILE, TEST_COUNTS with exit codes, SCREENSHOTS, NOT_VERIFIED. No claim of publication, GitHub writes or human acceptance.
</output>
