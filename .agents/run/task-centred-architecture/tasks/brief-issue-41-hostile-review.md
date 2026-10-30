<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-41-batch-align
Branch: feat/issue-41-batch-align
Base commit: 73f368084d72a3318edd0623003233cfea9a41bf
Candidate commit: a6f2ca66d4b7659c5c2914c8f2bbe19b04151e08
Goal: Conduct an independent hostile review (L4) of Issue #41 changes (diff 73f3680..a6f2ca6).
Commands:
- npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js ; node --test test/batch-align-drafts.test.js
Guardrails:
- Strictly read-only for application code during review.
- Do not assume what was done is right.
- Zero emojis.
</env_preflight>

<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>

<goal>
Conduct a hostile review of any edits or changes that were made in commit a6f2ca6 to figure out what might have been missed or what might be broken. Don't assume that what was done is right.

Audit:
1. Panel batch align:
   - Does `batchAlignDrafts` properly handle empty drafts?
   - Does it transition `status:draft` to `status:backlog` and preserve existing non-status labels?
   - Does it detect ambiguity and assign `needs:human`?
   - Does it properly handle errors without crashing the panel loop?
   - Is `panel/main.js` 100% synchronized with `panel/main.ts`?
2. Web board batch align:
   - Does `POST /api/repos/:owner/:name/issues/batch-align` properly authenticate and require CSRF?
   - Does it handle repositories with 0 drafts?
   - Does the web client (`web/public/app.js`) properly update the state and UI?
3. Run all tests and typechecks:
   - `npm test`
   - `node --test web/tests/*.test.mjs`
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
   - `node --test test/shipped-parity.test.js`
   - `node --test test/batch-align-drafts.test.js`
</goal>

<output>
At most 12 lines:
Verdicts: Spec Compliance (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES).
Findings (if any) with severity and file:line.
Executed test counts and typecheck exit codes.
</output>
