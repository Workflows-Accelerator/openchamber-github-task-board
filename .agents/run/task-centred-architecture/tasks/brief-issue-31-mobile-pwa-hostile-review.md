<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-31-mobile-pwa
Branch: feat/issue-31-mobile-pwa
Base commit: a6f2ca66d4b7659c5c2914c8f2bbe19b04151e08
Candidate commit: 1829dde2e1a1951b5f07cd63858b6a7bc7163169
Goal: Conduct an independent hostile review (L4) of the Mobile PWA & Web Feature Parity changes (diff a6f2ca6..1829dde).
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

Audit:
1. PWA & Service Worker:
   - Does `/manifest.json` have valid JSON, correct display mode ('standalone'), theme colors, and icon definitions?
   - Does `/sw.js` properly bypass cache for `/api/*` requests so dynamic mutations are never cached stale?
   - Is `Service-Worker-Allowed: /` header returned?
   - Does service worker registration guard against missing navigator/https without crashing tests?
2. Default Scope & Project Picker:
   - Does initial load default cleanly to 'all' (All Repositories / All Projects) without crashing or looping?
   - Does the searchable project picker popover open, filter correctly on input, select correctly on click, and close on backdrop/escape?
   - Is the old native select element safely removed or hidden without breaking existing tests?
3. Mobile Segmented Tabs:
   - Do the tabs [ All Tasks | Needs Human | Running | Drafts ] filter correctly?
   - Are touch targets at least 44px with safe-area insets?
4. Run all tests and typechecks:
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
