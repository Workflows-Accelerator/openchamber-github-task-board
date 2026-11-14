<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-r1-oc-questions
Branch: docs/r1-oc-questions
Base: feat/board-v3 (5edb450)
Test commands:
- node --test --test-timeout=60000 web/tests/r1-openchamber-questions.test.mjs
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
Read-only elsewhere: You may READ installed OpenChamber / OpenCode / `/workspace/code/openchamber-config/**` sources if present in the container to inspect how interactive questions (`question` tool / `openchamber_render` ui) are represented; NEVER edit anything outside this worktree.
Forbidden:
- NEVER touch `web/public/**`, `web/server/app.ts`, `web/server/board.ts`, `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER file any real GitHub issue, NEVER push, NEVER deploy, NEVER spawn subagents.
</env_preflight>

<goal>
Deliver **R1 — OpenChamber interactive question -> board issue transcription** (D35 research + dry-run prototype + draft issue) in this isolated worktree so it never collides with Wave 7 UI/server work:
1. `.agents/run/chamberos-board-v2/verifications/R-oc-questions/research.md`
2. `.agents/run/chamberos-board-v2/verifications/R-oc-questions/draft-issue.md`
3. A standalone, dry-run-by-default converter + CLI prototype (e.g., `web/tools/oc-question-to-board.mjs` + `web/tests/r1-openchamber-questions.test.mjs`) that round-trips cleanly against `web/server/board.ts` (`parseOpenQuestions` / `Human Review` parser) without modifying `web/server/board.ts` or `web/public/*`.
</goal>

<steps>
1. Locate installed OpenChamber / OpenCode source or bundle files in the container (e.g., check `which openchamber` / `which opencode` / global node_modules — read-only!) and read how `question` / `openchamber_render` payloads are structured (exact file paths and line numbers; mark anything unfindable as `UNKNOWN`).
2. Read `web/server/board.ts` (`parseOpenQuestions`, option syntax `::`, `### Human Review:`) and `docs/issue-body-contract.md` (§2.5, §2.9) so the converter matches the shipped V4-3 parser contract 100%.
3. Write `research.md`: payload contract, 3 integration options (session poll, event/webhook push, agent-side write on question) with cost/failure modes/tradeoffs, and 1 recommended smallest viable slice.
4. Write failing-first tests in `web/tests/r1-openchamber-questions.test.mjs` covering:
   - Converter round-trip (`payload -> Markdown -> parseOpenQuestions` preserves question, options, option details/descriptions, multi-select/free-text notes)
   - Payload with zero options and payload with long/multiline details
   - Dry-run default guard (never mutates/writes unless explicit `--apply` flag is passed)
5. Implement `web/tools/oc-question-to-board.mjs`, verify tests pass, write `draft-issue.md`, and commit cleanly as `docs(research): add R1 OpenChamber question transcription research and dry-run prototype`.
</steps>

<output>
At most 10 lines: STATUS, COMMIT, TEST_COUNTS (exit code), SOURCES_CITED (paths or UNKNOWN), PROTOTYPE_GUARD, NOT_VERIFIED.
</output>
