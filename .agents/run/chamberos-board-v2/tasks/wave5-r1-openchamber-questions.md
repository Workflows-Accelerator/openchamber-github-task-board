<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_BASE_SHA] (clean; contains V4-2 notes and Decisions work)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Test commands (RUN SEQUENTIALLY): npm test ; node --test --test-timeout=30000 web/tests/*.test.mjs ; npm run typecheck
Do not touch: panel/**, service/**, /workspace/releases/**, /workspace/.openchamber-data/** (never read secrets), git push, GitHub issue creation
Read-only elsewhere: /workspace/code/openchamber-config/** and any installed OpenChamber sources may be READ for research; NEVER edit them, and never edit global skills.
Do NOT run `git remote -v` or print any credential.
Preflight facts are true and authoritative at dispatch.
</env_preflight>

<goal>
Research whether a question that OpenChamber renders as an interactive form can be transcribed directly into the board issue it belongs to, then deliver a working, tested prototype of that transcription plus a draft issue describing the option. The user explicitly framed this as research that may or may not be productised.
</goal>

<user_words>
"si tu regardes dans OpenChamber beaucoup de fois les modèles vont poser des questions sous forme d'interface, récemment c'était une mise à jour dans OpenChamber, ça peut être intéressant d'aller regarder comment c'est fait. Parce que si on arrive à trouver un moyen de transcrire cette question OpenChamber directement dans l'issue qui est traitée dans le board, ce serait beau. Ça, c'est plutôt de la recherche. C'est une idée. Tu peux en faire un brouillon. Mais ce n'est pas forcément quelque chose qu'on est obligé de développer."
</user_words>

<steps>
1. Discover the real shape, from source, not from memory:
   - Find how OpenChamber/OpenCode represents a model question with options today: the tool or event, the JSON payload, the option fields, whether details/descriptions exist, whether multiple answers or free text are supported, and how an answer is returned to the model.
   - Cite exact file paths and line numbers for every claim. If a claim cannot be grounded in source, mark it UNKNOWN rather than guessing.
2. Identify the join point with this board: an issue is `owner/repo#number`; the board already parses an Open Questions section from the issue body. Determine what would be needed to carry an OpenChamber question into that section losslessly — including option details, and the answer path back to the model.
3. Write `.agents/run/chamberos-board-v2/verifications/R-oc-questions/research.md`: what exists, the payload contract, three integration options (poll the session, webhook/event push, agent-side write on question), each with cost, failure modes, and what it would break. End with one recommendation and the smallest viable slice.
4. Build a prototype, behind a flag and additive only:
   - A converter that takes a captured OpenChamber question payload and emits the board's Open Questions Markdown, preserving options and their details.
   - A CLI or script that applies it to a given issue, dry-run by default.
   - Round-trip tests: payload -> Markdown -> parsed by the board -> same question, same options, same details. Include a payload with no options and one with long details.
   - No network calls to GitHub in tests; use the fake fixtures. The prototype must never run against a real repository by accident: dry-run is the default and a real apply requires an explicit flag.
5. Write `.agents/run/chamberos-board-v2/verifications/R-oc-questions/draft-issue.md`: a ready-to-file GitHub issue in the repo's own issue style (problem, evidence with paths, proposed slice, acceptance criteria, open questions). Do NOT create the issue; the manager files it after user review.
6. Record in the research document what is proven by running code versus what remains a hypothesis.
</steps>

<criteria>
1. Every claim about the OpenChamber question format is backed by a file path and line number, or explicitly marked UNKNOWN.
2. The converter round-trips losslessly on the fixtures, proven by tests that pass in the normal suite.
3. Dry-run is the default and a real write requires an explicit flag; a test proves the guard.
4. `research.md` names one recommended slice with an honest cost estimate in files touched, and lists what it would NOT solve.
5. `draft-issue.md` is complete enough to file as-is and contains no invented facts.
6. `npm test` 618/618, all `web/tests/*.test.mjs`, `npm run typecheck` pass, sequential. No edits outside `.worktrees/team-dev-board-v3/{web,scripts,.agents/run/chamberos-board-v2/verifications/R-oc-questions}` plus the prototype's own files.
7. Commit on `feat/board-v3`; no push; no deploy; no GitHub issue created.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: PASS | PARTIAL | BLOCKED
- PAYLOAD_CONTRACT: the grounded shape, with citations
- INTEGRATION_OPTIONS: three options with cost and failure modes, and the recommendation
- PROTOTYPE: files, how to run it, the dry-run guard, round-trip test result
- DRAFT_ISSUE: path and one-paragraph summary
- UNKNOWN: what could not be grounded
- NOT_VERIFIED
</output>
