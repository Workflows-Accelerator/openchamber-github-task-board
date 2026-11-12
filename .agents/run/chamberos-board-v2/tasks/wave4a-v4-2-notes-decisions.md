<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: d1eef33 (V4 released and LIVE; release 26fbc00-20261112, application code a1225f0)
State at dispatch: tracked tree CLEAN. Only untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ — preserve it untouched and never stage it. Everything else under .agents/run/** in the worktree is read-only input.
Root checkout: /workspace/code/openchamber-github-task-board on ops/task-board-activation — DO NOT modify, switch branches or commit there.
Runtime: Node 20, Playwright package present, Chromium 156 installed. Prior waves launched Chromium without any env script; do NOT source stale /tmp/opencode paths and do not install new dependencies.
Tests SEQUENTIALLY, never two suites at once:
  npm test
  node --test --test-timeout=30000 web/tests/*.test.mjs
  npm run typecheck
  npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v4-2-server-check.mjs
  node scripts/generate-delivery-smoke.mjs
Preflight facts are authoritative: do not spend a turn rediscovering them. Inspect source, diffs and fixtures as the work requires.
</env_preflight>

<goal>
Build the two remaining P1 requests from the user's phone review of the live board, in one coherent increment:
A. A quick note on the issue currently open in front of them, stored as a real GitHub comment so the agent working that issue sees it.
B. Decisions questions rendered as real Markdown, with preset answers that carry expandable details instead of a bare free-text box.
</goal>

<user_words>
"j'aimerais pouvoir facilement ajouter une note dans une issue que j'ai en face de moi qui est ouverte, pas forcément comme une note dans le canvas, ça peut être lié ou pas forcément, qui sera prise en compte par le modèle"
"dans la partie décision, les questions ne sont pas interprétées autrement qu'en texte... c'est pas très beau... avoir un beau formatage Markdown, ça me paraît impératif"
"idéalement qu'on ait des options préfaites... pour que ce ne soit pas l'utilisateur de répondre aux questions de manière froide et brute, mais plutôt d'avoir des options préfaites. Et des détails de cette option préfaite qui sont déroulables."
</user_words>

<part_a_quick_note>
1. Destination is already decided by the user: a real GitHub comment on that issue. No private board-side store, no second source of truth, nothing simulated. If the code path cannot create a comment with the existing token, stop and report BLOCKED instead of faking it.
2. Mark the comment so both the board and a human/agent can recognise it, following the repo's existing hidden-marker convention (see the canvas-marker parsing in web/server/board.ts) plus a short visible lead-in such as "Note for the agent" in the current language. Never edit, replace or delete existing comments.
3. Board integration:
   - One clear affordance in the open issue drawer, next to the title actions. It opens a focused composer: textarea, send, cancel.
   - Keyboard: Ctrl/Cmd+Enter sends, Escape cancels and returns focus; focus returns to the trigger after send.
   - After sending, the note appears immediately in the drawer activity area using the board's existing write-uncertainty handling, and survives a reload (prove it).
   - The newest note is readable without scrolling; note count chips in the drawer and in List rows.
   - The issue payload `/api` used by agents exposes recent notes with author and timestamp. Do not duplicate storage: the GitHub comment stays the source of truth.
4. A note is a different object from a canvas sticky note. Canvas notes stay untouched and visually distinct; do not merge the two models.
5. Failure handling: a failed send must keep the typed text, name what failed in plain words (no generic "outcome unknown"), and offer retry.
6. Respect the board's GitHub API-efficiency commitments already shipped: conditional requests with ETag/If-None-Match, singleflight deduplication, no polling while the tab is hidden. Adding notes must not turn every render into extra GitHub calls.
</part_a_quick_note>

<part_b_decisions_markdown_and_options>
7. Render question text as Markdown through the existing web/public/markdown.js. Apply it wherever a question is displayed (Decisions view and any drawer, Blocked or Client surface that shows one). No raw `**`, backticks or `- ` may leak into the rendered UI.
8. Preset answers with expandable details:
   - Extend the existing open-question data shape backward-compatibly (OpenQuestionView and its parser in web/server/board.ts). Do not invent a second question format.
   - Define ONE authoring convention for options with details, document it where the parser lives (comment block plus fixtures) and implement it. Existing questions that do not use the convention must keep rendering and stay answerable exactly as today.
   - In the UI each option is a selectable card: label, one-line gist, and a details disclosure that opens in place.
   - Submitting a selected option writes the answer through the existing answer flow. The free-text answer stays available but secondary.
   - Accessible: options behave as a radiogroup, details expose aria-expanded, submission state is announced.
</part_b_decisions_markdown_and_options>

<non_regression>
These behaviours were just approved and released; they must not change:
- Automatic dependency framing never goes below the 0.55 readable floor; "Tout afficher (N)" / "Show all (N)" keeps honest zoom-limit feedback, hides labels whose endpoint is off screen, and never claims a fit it did not achieve.
- Filter and dependency focus return-view state: no stale filterView, no premature consumption of pending restoration.
- Desktop sidebar collapses to a rail that always keeps a visible reopen toggle (>= 769px); the phone drawer is unaffected at 360/390.
- Drag a card -> saved -> survives reload; a refused write rolls back with a visible error and no unhandled rejection.
- Arrange + Undo restores exact positions; reduced-motion and keyboard paths work.
- Strict CSP (style-src 'self', no new inline style attributes), zero "n8n", zero "mobile", zero emojis, no button mixing a + icon with "+" text, dot grid byte-identical, views named Canvas/Canevas and List/Liste with sidebar navigation.
</non_regression>

<scope>
Owned: web/public/app.js, web/public/index.html, web/public/theme.css, web/server/board.ts, web/server/app.ts only where a comment route is genuinely required, web/tests/**, scripts/generate-delivery-smoke.mjs only if a new surface needs smoke coverage, and new evidence under .agents/run/chamberos-board-v2/verifications/V4-2/**.
Read-only: panel/**, service/**, web/public/arrange.js, web/public/markdown.js internals (call it, do not rewrite it), the dot-grid function, prior evidence directories, .agents/run/chamberos-board-v2/verifications/V4-1-L4/**.
Forbidden: git push, deployment, /workspace/releases/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**, any real GitHub mutation on the user's repositories (everything is proven against the synthetic fake-GitHub fixtures), deleting files, `git remote -v`, printing any credential.
Do not delegate further. If a genuine product fork appears, report it instead of choosing silently.
</scope>

<verification>
1. Prove the note flow against the synthetic fixture: comment created with the marker, appears immediately, survives reload, visible in the agent-facing payload, count chips correct, and a forced failure that keeps the text and offers retry.
2. Prove Decisions rendering with headings, lists, code spans, links and emphasis, plus a regression assertion that no raw marker leaks. Prove an older-format question still renders and is answerable.
3. Prove preset options: selection, details disclosure, aria-expanded, submission writes the same answer as the current flow, free-text fallback still works.
4. Real Chromium screenshots at 360x800, 390x844 and 1280x900, Light and Dark, EN and FR: composer closed/open, note visible in activity, Decisions Markdown, option details collapsed and expanded. Zero console errors, zero CSP violations.
5. Re-run the released non-regression surfaces you touched or could plausibly disturb: dependency framing floor and honest limit, filter return state, rail toggle, drag save + reload, Arrange + Undo.
6. Full suites sequentially with real counts and exit codes. Existing counts must not drop (baseline: npm test 618, web tests 631); adding tests is expected. No assertion weakened, no test skipped to get green.
7. Evidence under .agents/run/chamberos-board-v2/verifications/V4-2/: README.md with measurements, machine-readable JSON, raw logs with exit codes, screenshots. Commit source+tests separately from evidence, on feat/board-v3, local only.
8. Required hostile self-check before reporting: conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Do not assume that what you did is right. Re-run the real probes, not only unit tests, and record every correction you made in this pass.
</verification>

<output>
Return concise structured Markdown, at most 20 lines:
- STATUS: PASS | FAIL | BLOCKED
- COMMITS (source, tests, evidence) with SHAs
- NOTE_FLOW: marker, route, where it appears, reload proof, failure handling, API cost
- DECISIONS: markdown coverage, option convention, parser location, accessibility
- SELF_HOSTILE: what the hostile pass found and fixed
- TEST_COUNTS: real numbers and exit codes, sequential
- SCREENSHOTS: paths
- NOT_VERIFIED
No claim of live, deployment or human acceptance. The manager dispatches the independent review next.
</output>
