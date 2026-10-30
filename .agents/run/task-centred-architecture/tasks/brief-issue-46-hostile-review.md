<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-46-mobile-parity-offline
Branch: feat/issue-46-mobile-parity-offline
Base commit: 8df6d7b5f79eaf6133cc51950996ffcac872d52e
Candidate commit: 21837754d9c7625128ff3a970e53a3eb2d85b191
Goal: Conduct an independent hostile review (L4) of the changes in commit 2183775 for Issue #46 (Mobile task drawer parity, offline drafting, polished PWA icons, and panel-scoped align drafts).
Commands:
- npm run build:panel
- npm run build:service
- npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs
- npm run typecheck
- npx tsc -p web/tsconfig.json
- node --test web/tests/*.test.mjs
- node --test --test-concurrency=1 test/*.test.js
- node --test test/shipped-parity.test.js
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
Conduct a hostile review of any edits or changes that were made in commit 2183775 to figure out what you might have missed or what might be broken. Don't assume that what you did is right.

Audit:
1. Align Drafts scoping:
   - Is `#btnAlignDrafts` completely absent from `web/public/index.html` and `web/public/app.js`?
   - In `panel/index.html` and `panel/main.ts`, does `#btnAlignDrafts` provide proper loading state, spinner, disabled attribute, and user feedback toast?
2. Web & Mobile Task Detail Drawer Parity:
   - Does tapping a task card in `web/public/app.js` open the drawer modal with the friendly title, status, repo badge, and description?
   - Do Acceptance Criteria and Subtasks checkboxes render accurately and toggle with line-index precision without corrupting the Markdown body?
   - Can questions be answered inline, and can a task be marked Done?
   - Does closing the drawer (backdrop tap, close button, or Escape) work cleanly?
3. Offline Drafting:
   - Does quick-add queue to `localStorage` key `openchamber_offline_drafts` when `!navigator.onLine` or fetch throws?
   - Does the offline item display immediately in the Draft column with an `(offline)` badge?
   - When connection returns (`online` event or page load), does `syncOfflineDrafts()` cleanly submit each draft to GitHub and clear it from `localStorage` without duplicate spamming or data loss?
4. Polished PWA Icons:
   - Are `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and `icon.svg` valid image files?
   - Are they properly linked in `web/public/manifest.json` and `web/public/index.html`?
5. Run all test suites and compiler checks:
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
   - `node --test web/tests/*.test.mjs`
   - `node --test --test-concurrency=1 test/*.test.js`
   - `node --test test/shipped-parity.test.js`
</goal>

<output>
At most 12 lines:
Verdicts: Spec Compliance (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES).
Findings (if any) with severity and file:line.
Executed test counts and typecheck exit codes.
</output>
