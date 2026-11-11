<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_BASE_SHA] (clean; contains V4-1 sheets/filters/dependencies)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Real Chromium launcher: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh
Test commands (RUN SEQUENTIALLY): npm test ; node --test --test-timeout=30000 web/tests/*.test.mjs ; npm run typecheck ; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v3-server-check.mjs
Do not touch: panel/**, service/**, dot-grid formula at web/public/app.js:2268, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, /workspace/releases/**, git push
Do NOT run `git remote -v` or print any credential. Do not mutate the user's real repositories; prove against the synthetic fake-GitHub fixtures.
Preflight facts are true and authoritative at dispatch.
</env_preflight>

<goal>
Two user requests in one batch. First: let the user drop a quick note on the issue currently open in front of them, and make sure the agent working that issue actually sees it. Second: in the Decisions view, render question Markdown properly and offer preset answers with expandable details instead of a bare free-text box.
</goal>

<user_words>
"j'aimerais pouvoir facilement ajouter une note dans une issue que j'ai en face de moi qui est ouverte, pas forcément comme une note dans le canvas, ça peut être lié ou pas forcément, qui sera prise en compte par le modèle"
"dans la partie décision, les questions ne sont pas interprétées autrement qu'en texte... c'est pas très beau... avoir un beau formatage Markdown, ça me paraît impératif"
"idéalement qu'on ait des options préfaites... pour que ce ne soit pas l'utilisateur de répondre aux questions de manière froide et brute, mais plutôt d'avoir des options préfaites. Et des détails de cette option préfaite qui sont déroulables."
</user_words>

<part_a_quick_note>
1. Destination decided by the user: a GitHub comment on the issue. Implement it as a real comment, not a private board-side store.
2. Make it unmistakably a note for the agent while staying readable in GitHub's UI: a hidden machine marker in the comment body following the repo's existing marker conventions (see `web/server/board.ts` canvas-marker parsing for the established pattern) plus a short visible lead-in such as "Note for the agent". Never alter or replace existing comments.
3. Board integration:
   - The issue drawer gets one clear "Note" affordance next to the title actions. Opening it reveals a focused composer: textarea, send, cancel. Keyboard: `Enter` sends with `Ctrl`/`Cmd`, `Escape` cancels, focus returns after send.
   - After sending, the note appears in the drawer's activity area immediately (optimistic with the same uncertainty handling the board already uses for writes) and survives a reload.
   - The board marks issues that carry notes: a small count chip in the drawer and in List rows, and the newest note is visible without scrolling.
   - The `/api` issue payload exposes recent notes with author and timestamp so an agent reading the board sees them; a note must be reachable by an agent that only reads the issue body and comments — the GitHub comment is the source of truth, so do not duplicate storage.
4. Keep canvas sticky notes untouched and clearly a different object. Do not link the two unless trivially available; a note is not a canvas card.
5. Mistakes: a failed send must not lose the typed text, must say what failed, and must offer retry. No generic "outcome unknown" wording.
</part_a_quick_note>

<part_b_decisions_markdown_and_options>
6. Render question text as Markdown, using the existing `web/public/markdown.js`. Apply to the Decisions view and to any other place a question is displayed (drawer, Blocked, Client view if applicable). Zero raw `**`, backticks, or `- ` leaking into the UI.
7. Preset answers with expandable details:
   - Use the existing open-question data shape (`OpenQuestionView`, `web/server/board.ts` around line 797, and its parser around lines 955–1060). Extend it backward-compatibly; do not fork a second format.
   - Define and document one authoring convention for options with details (for example each option on its own list item, with nested bullets as the expandable details), implement the parser, and add fixtures.
   - In the UI every option is a selectable card: the label, a one-line gist, and a details disclosure that opens in place. Selecting an option and submitting writes the answer exactly as the existing answer flow does today; the free-text fallback stays available but secondary.
   - Keyboard and screen-reader usable: options are a radiogroup, details disclose with `aria-expanded`, submission state is announced.
8. Zero regression on the existing answer submission path, and no question loses its current answers when the new presentation is enabled.
</part_b_decisions_markdown_and_options>

<criteria>
1. A note sent from the drawer becomes a real GitHub comment carrying the marker, appears immediately, survives reload, and is visible in the `/api` payload used by agents. Proven against the fake GitHub fixture, including a failure case where the send fails and the typed text is preserved.
2. The drawer and List show a note count; the newest note is readable without scrolling; canvas sticky notes are untouched and visually distinct.
3. Decisions view renders question Markdown correctly for headings, lists, code spans, links and emphasis; a regression test asserts no raw Markdown markers render as text.
4. Preset options render as selectable cards with expandable details, submission writes the same answer as before, keyboard and `aria-expanded` behaviour verified, free-text fallback present.
5. Real Chromium screenshots at `360x800`, `390x844`, `1280x900`, Light and Dark, EN and FR: note composer, note in activity, Decisions with Markdown and options expanded/collapsed. Zero console errors, zero CSP violations.
6. `npm test` 618/618, all `web/tests/*.test.mjs`, `npm run typecheck`, esbuild, `scripts/generate-delivery-smoke.mjs` pass, sequential. Zero `"mobile"`, zero `"n8n"`, zero emojis.
7. `git diff [FILL_BASE_SHA]..HEAD -- panel service` empty; commit on `feat/board-v3`; no push; no deploy.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: PASS | FAIL
- COMMITS
- NOTE_FLOW: request shape, marker format, where it appears, reload proof, failure handling
- DECISIONS: markdown coverage, option authoring convention, parser location, keyboard behaviour
- TEST_COUNTS: sequential
- SCREENSHOTS: paths
- NOT_VERIFIED
</output>
