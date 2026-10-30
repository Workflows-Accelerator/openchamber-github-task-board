<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-41-batch-align
Branch: feat/issue-41-batch-align
Base commit: 73f368084d72a3318edd0623003233cfea9a41bf
Goal: Implement Issue #41: Batch action to align, self-categorize, and prioritize draft issues across OpenChamber panel and standalone web board.
Commands:
- In worktree root: npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js
Guardrails:
- Strictly adhere to Zero-Emoji policy across all code, markup, titles, and comments.
- Never log, print, or leak secret token or password values.
- Positive, output-focused titles.
- Open questions and needs:human only applied when genuine ambiguity exists.
</env_preflight>

<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/lean-build/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>

<goal>
Build Issue #41 to provide a single, seamless "Align & Prioritize Drafts" batch action:
1. OpenChamber Panel (`panel/index.html`, `panel/main.ts`):
   - In the Draft column header (inside `.kanban-col[data-column="draft"] .kanban-col-header` or directly next to the quick-add input), add an "Align Drafts" button (`#btnAlignDrafts`):
     - Displays button: "Align Drafts" (or clean icon + text).
     - On click: finds all issues with `status:draft` in the active scope (current repository or across all repositories if in All Projects mode).
     - If no draft issues are present, toast info: "No draft issues to align."
     - For each draft issue:
       - Formats issue body into structured sections: `## Overview`, `## Scope`, `## Acceptance Criteria`.
       - Assigns `priority:medium` (or respects existing priority label).
       - Moves issue from `status:draft` to `status:backlog` (removes `status:draft`, adds `status:backlog`).
       - If the draft title or description indicates an open question or ambiguity, adds `## Open Questions` and applies `needs:human` label.
       - Saves via `githubRequestWithRetry('PATCH', '/repos/' + repo + '/issues/' + issue.number, ...)`.
       - Updates local state (`issues`), updates caches, and re-renders views with instant feedback.
       - Toasts success: "Aligned {count} draft issues".
   - Streamline the Draft column header and toolbar controls so there are no confusing dual button / adjacent redundant dropdowns.
2. Standalone Web Board Backend (`web/server/app.ts`):
   - Add endpoint `POST /api/repos/:owner/:name/issues/batch-align`:
     - Requires authenticated session + valid CSRF token (`x-csrf-token`).
     - Scans open issues for that repository with `status:draft`.
     - For each draft issue:
       - Ensures structured sections (`## Overview`, `## Scope`, `## Acceptance Criteria`).
       - Replaces `status:draft` with `status:backlog`.
       - Ensures a priority label exists (defaults to `priority:medium` if none).
       - Updates the issue on GitHub via `GitHubClient.updateIssue` / `PATCH`.
     - Returns `{ ok: true, alignedCount: number, issues: updatedBoardListItems }`.
3. Standalone Web Board UI (`web/public/index.html`, `web/public/app.js`, `web/public/theme.css`):
   - Add an "Align Drafts" button (`#align-drafts-btn`) next to the quick-add input bar.
   - When clicked: sends `POST /api/repos/:owner/:name/issues/batch-align` with CSRF header.
   - Updates local board issues and re-renders board with an announcement and clear toast/notice.
4. Comprehensive Automated Tests:
   - Add panel unit tests in `test/batch-align-drafts.test.js` verifying:
     - Transitions `status:draft` to `status:backlog`.
     - Sets priority and structured markdown sections.
     - Preserves existing labels while cleanly swapping status.
   - Add web tests in `web/tests/app.test.mjs` verifying:
     - 200 success on `POST /api/repos/:owner/:name/issues/batch-align`.
     - 401 unauthenticated and 403 CSRF rejection.
     - Correctly returns aligned count and updated issues.
   - Verify all existing tests, web tests, typechecks, and shipped parity tests pass.
5. Build and commit:
   - Run `npm run build` so `panel/main.js` is up to date.
   - Conventional commit: `feat(board): add batch action to align, structure, and prioritize draft issues`.
</goal>

<scope>
1. Edit `panel/index.html`, `panel/main.ts`, rebuild `panel/main.js`.
2. Edit `web/server/app.ts`.
3. Edit `web/public/index.html`, `web/public/app.js`, `web/public/theme.css`.
4. Add tests in `test/batch-align-drafts.test.js` and `web/tests/app.test.mjs`.
5. Run full test suite, typecheck, and parity checks.
6. Commit changes.
</scope>

<criteria>
Batch align runs smoothly across drafts in panel and web board; all draft issues transition to backlog with structured sections; 0 typecheck errors; all unit and integration tests pass; zero emojis.
</criteria>

<output>
At most 10 lines:
Files modified; test pass counts; typecheck exits; commit hash.
</output>
