<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-40-quick-add
Branch: feat/issue-40-quick-add
Base commit: 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b
Candidate commit: 73f368084d72a3318edd0623003233cfea9a41bf
Goal: Conduct an independent hostile review (L4) of Issue #40 changes (diff 48d1fb2..73f3680).
Commands:
- npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js ; node --test test/quick-add-draft.test.js
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
Conduct a hostile review of any edits or changes that were made in commit 73f3680 to figure out what might have been missed or what might be broken. Don't assume that what was done is right.

Specifically audit:
1. OpenChamber Panel Quick-Add (`panel/index.html`, `panel/main.ts`, `panel/main.js`):
   - Does pressing Enter on empty or whitespace strings get rejected?
   - Does `quickAddDraft` ever invoke `host.startSession` under any circumstance?
   - What happens when in `isAllProjectsMode`? Does it clearly prompt/toast the user to pick a target repo or pop open repo picker?
   - Does optimistic update cleanly update `issues` and cache?
   - Does New Issue modal open in manual mode by default now without auto-launching sessions?
   - Is `panel/main.js` 100% in sync with `npm run build:panel`?
2. Standalone Web Board (`web/server/app.ts`, `web/public/index.html`, `web/public/app.js`, `web/public/theme.css`):
   - In `web/server/app.ts`, does `POST /api/issues` properly authenticate and require CSRF?
   - Does `route === '/api/issues'` handle both repo-scoped `/api/repos/:owner/:name/issues` (via `qualified` rewrite) and direct calls?
   - Are errors (empty title, invalid JSON, 401 unauth, 403 CSRF) cleanly mapped with proper status codes?
   - In `web/public/app.js`, does quick-add work in single repo mode and multi repo mode? What happens if `all` is selected? Does it show a clear notice?
   - Are inputs properly re-enabled in `finally` blocks on both success and failure?
3. Run all tests and typechecks:
   - `npm test`
   - `node --test web/tests/*.test.mjs`
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
   - `node --test test/shipped-parity.test.js`
   - `node --test test/quick-add-draft.test.js`
</goal>

<output>
At most 12 lines:
Verdicts: Spec Compliance (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES).
Findings (if any) with severity and file:line.
Executed test counts and typecheck exit codes.
</output>
