<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7-overhaul
Branch: feat/wave7-overhaul
HEAD: 1d11287 (base 5edb450); merge source `feat/wave7-full-l4` at `3c45474`
Test commands:
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm test
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
Forbidden:
- NEVER touch `/workspace/code/openchamber-config/**`, `/workspace/.openchamber-data/**`, `board.env`, `jwt-secret`, or real GitHub.
- NEVER push to any remote, NEVER deploy to `/workspace/releases/**`, NEVER restart the live service, NEVER delete branches or worktrees.
- NEVER spawn subagents.
</env_preflight>

<goal>
Produce a deploy-ready release candidate for the whole Wave 7 overhaul: merge the L4-hardened branch, rebuild the production bundle, prove the merged tree is green, and write the deploy + rollback receipt — WITHOUT deploying or pushing anything. The user has not approved publication yet.
</goal>

<steps>
1. `git merge --no-ff feat/wave7-full-l4` into `feat/wave7-overhaul`. Resolve nothing by hand: if the merge conflicts, stop and report the conflicting files instead of guessing.
2. Confirm the merged tree contains the 3 L4 fixes from `3c45474` (canvas group "needs me" count matching the sidebar; 390px dock label not spilling into Decisions; FR phase/attention labels localized). Quote the merged lines that implement each.
3. Run the full verification on the merged tree: `node --test --test-timeout=60000 web/tests/*.test.mjs`, `npm test`, `npm run typecheck`, `npx tsc -p web/tsconfig.json --noEmit`, and both esbuild bundles (`web/server.ts` and `web/public/app.js`). Report exact pass counts and exit codes.
4. Build the production bundle exactly the way the live service expects it: read how `/workspace/releases/board/b85676f-20261113` was built and how the service starts (look at the release directory layout, `package.json` scripts, and any deploy notes in `docs/` or `.agents/run/`; do NOT read `board.env` or any secret). Produce `web/dist/server.mjs` (or the equivalent artifact the release layout uses) and confirm it starts: launch it on a free port with a throwaway `BOARD_*` config pointing at a local fake GitHub, hit `/health`, and shut it down. Report the exact commands and the observed health response. Never point it at the real GitHub token.
5. Copy the 13 browser screenshots and the L4 report from `.worktrees/workflows-accelerator-agent-dev-wave7-full-l4/.agents/run/chamberos-board-v2/verifications/wave7-full-L4/` into this worktree under `.agents/run/chamberos-board-v2/verifications/wave7-release-candidate/` (with a short `README.md` recording HEAD, test counts, artifact path, bundle size, health check, and the exact deploy and rollback commands).
6. Commit as `chore(release): prepare Wave 7 release candidate` with explicit paths. Do not stage anything outside `web/` and the new verification directory.
</steps>

<output>
At most 12 lines: STATUS, MERGE (commit or conflict list), L4_FIXES_PRESENT (3 lines of evidence), TEST_COUNTS (web, npm, typecheck, tsc, esbuild exit codes), ARTIFACT (path, size, health check result), DEPLOY_COMMANDS, ROLLBACK_COMMANDS, COMMIT, NOT_VERIFIED.
</output>
