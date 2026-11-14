<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-r1-oc-questions
Branch: docs/r1-oc-questions
HEAD: 4e348de (base 5edb450)
Test commands:
- node --test --test-timeout=60000 web/tests/r1-openchamber-questions.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
Forbidden:
- NEVER touch `web/public/**`, `web/server/**`, `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER push, file any GitHub issue, deploy, or spawn subagents.
</env_preflight>

<goal>
Conduct a hostile L4 review of `4e348de` (`R1`: `research.md`, `draft-issue.md`, `web/tools/oc-question-to-board.mjs`, `web/tests/r1-openchamber-questions.test.mjs`) to catch any subtle round-trip bug, injection/escaping edge case in Markdown output, dry-run bypass, or inaccurate claim in `research.md` / `draft-issue.md`.
</goal>

<attack_checklist>
1. Inspect `git show 4e348de` completely.
2. Attack `web/tools/oc-question-to-board.mjs` against `web/server/board.ts` (`parseWebOpenQuestions`, `parseHumanReview`):
   - What if `header` or `question` contains `- [x]`, newlines, `<!-- ... -->`, `###`, HTML, or Markdown brackets? Could a crafted question break `parseWebOpenQuestions` round-trip or inject an extra section?
   - What if `options[].description` contains `::` or newlines or leading `- `? Does `gist` / `details` round-trip cleanly through `parseWebOpenQuestions`?
   - What if `options` has an option with empty `description` or `details` only?
   - What if `--out` points to an existing file without `--apply` (dry run must leave it untouched!), or `--apply` + malformed payload (must exit 1 and NOT touch `--out`)?
   - Does `parseWebOpenQuestions` actually re-parse the output identically for multi-question payloads when `--gate` is set?
3. Verify every citation in `research.md` against `web/server/board.ts` and `docs/issue-body-contract.md` (and check `draft-issue.md` contains no invented claims or banned tokens).
4. Run `node --test --test-timeout=60000 web/tests/r1-openchamber-questions.test.mjs`, `web/tests/*.test.mjs`, `npm run typecheck`, `tsc`.
5. Fix any genuine defect in `web/tools/oc-question-to-board.mjs` + `r1-openchamber-questions.test.mjs` (failing test first) and commit cleanly as `fix(r1): harden question converter after hostile review`, or record clean `APPROVED` in `.agents/run/chamberos-board-v2/verifications/R-oc-questions/L4-review.md` and commit.
</attack_checklist>

<output>
At most 10 lines: VERDICT (APPROVED or FIXED_AND_APPROVED), FINDINGS, TEST_COUNTS (focused, web, typecheck exit codes), COMMIT, NOT_VERIFIED.
</output>
