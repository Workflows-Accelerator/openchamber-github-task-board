<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-46-mobile-parity-offline
Branch: feat/issue-46-mobile-parity-offline
Base commit: 21837754d9c7625128ff3a970e53a3eb2d85b191
Command: npx tsc -p web/tsconfig.json
</env_preflight>

<goal>
Fix TypeScript compilation error TS2454 in `web/server/app.ts`:
Initialize `patch` with an empty object:
`let patch: Record<string, unknown> = {};`
and ensure `npx tsc -p web/tsconfig.json` exits 0 with 0 errors.
Rebuild bundles and run tests to verify zero regressions.
Commit the fix with message: `fix(web): initialize patch object to resolve TS2454 under strict typecheck`
</goal>

<steps>
1. In `web/server/app.ts`:
   Find `let patch: Record<string, unknown>;` and change it to `let patch: Record<string, unknown> = {};`.
2. Run `npx tsc -p web/tsconfig.json` and verify 0 errors.
3. Run `npm run typecheck` and verify 0 errors.
4. Run `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs`.
5. Run tests:
   `node --test web/tests/*.test.mjs`
   `node --test --test-concurrency=1 test/*.test.js`
   `node --test test/shipped-parity.test.js`
6. Commit the fix cleanly.
</steps>

<output>
Report:
- Exit code of `npx tsc -p web/tsconfig.json`
- Commit SHA
- Test results
</output>
