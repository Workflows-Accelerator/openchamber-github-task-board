<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-31-mobile-pwa
Branch: feat/issue-31-mobile-pwa
Base commit: a6f2ca66d4b7659c5c2914c8f2bbe19b04151e08
Candidate commit: 1829dde2e1a1951b5f07cd63858b6a7bc7163169
Goal: Conduct an independent hostile review (L4) of Mobile PWA & Web Feature Parity changes (diff a6f2ca6..1829dde).
Commands:
- npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js
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
Conduct a hostile review of any edits or changes that were made in commit 1829dde to figure out what might have been missed or what might be broken. Don't assume that what was done is right.

Specifically audit:
1. PWA Manifest & Service Worker:
   - Does `GET /manifest.json` return 200 with valid JSON?
   - Does `GET /sw.js` return 200 with `application/javascript` and header `Service-Worker-Allowed: /`?
   - Does `sw.js` safely bypass caching for `/api/*` requests so dynamic mutations are never served stale?
   - Does `web/public/icon.svg` exist and load cleanly?
2. Mobile View Switcher & Default Scope:
   - Does opening the board default to "All Projects" (`state.selected = 'all'`) when no repo is explicitly chosen?
   - Are the tabs `[ All Tasks | Needs Human | Running | Drafts ]` responsive and functional?
   - When filtering by `Needs Human`, does it only show issues with `needs:human` or open questions?
   - When filtering by `Running`, does it only show issues with `status:in-progress`?
   - When filtering by `Drafts`, does it only show issues with `status:draft`?
3. Searchable Project Picker:
   - Does clicking `#repo-select-btn` toggle the popover?
   - Does typing into `#repo-search-input` filter the repository items properly?
   - Does "All Repositories" stay pinned at top and work when clicked?
   - Does selecting a repo update the board and close the popover?
   - Does clicking outside or pressing Escape close the popover?
4. Quick-Add in "All Projects" Mode:
   - When in "All Projects" mode, does quick-add still work by selecting the default repo?
5. Run all tests and typechecks:
   - `npm test`
   - `node --test web/tests/*.test.mjs`
   - `npm run typecheck`
   - `npx tsc -p web/tsconfig.json`
   - `node --test test/shipped-parity.test.js`
</goal>

<output>
At most 12 lines:
Verdicts: Spec Compliance (PASS/FAIL), Quality (APPROVED/NEEDS-FIXES).
Findings (if any) with severity and file:line.
Executed test counts and typecheck exit codes.
</output>
