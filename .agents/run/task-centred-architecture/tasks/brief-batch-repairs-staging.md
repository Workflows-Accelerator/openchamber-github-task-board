<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51
Branch: staging/repairs-49-50-51, branched from accepted fix/issue-51-toolbar-controls (which already includes accepted #50 fix/issue-50-host-connection), clean, node_modules and web/node_modules symlinked.
Preflight facts are authoritative at dispatch: skip initial pwd/ls/git status discovery.
Branches to integrate:
- Already in HEAD: fix/issue-50-host-connection (f0dae5b) + fix/issue-51-toolbar-controls (c37ad8b)
- Merge into HEAD: fix/issue-49-login-label (84d2e39) — `--no-ff -m "chore(staging): merge fix/issue-49-login-label into staging/repairs-49-50-51"`
Test commands: npm run build ; npm run typecheck ; npm test ; npm --prefix web test
Do not touch: root checkout, other worktrees, live deployment (/workspace/releases/board/**), systemd/process state of live board or OpenChamber port 3000, package.json, package-lock.json.
Secrets wall: never read /workspace/.openchamber-data/**, .env*, board.env, credential/cookie/session files, process environments, git remote URLs or `git remote -v`. No live GitHub calls/writes, label updates, task creation, agent starts, host toggles/restarts, production data. Never touch port 3000. Zero emojis.
</env_preflight>
<goal>
Merge `fix/issue-49-login-label` (`84d2e39`) cleanly with the accepted `#50` + `#51` branch on `staging/repairs-49-50-51`, verify full root and web test suites + clean bundle build, run an isolated local preview check of the combined candidate (web login card + extension panel + background service health contract on ephemeral loopback ports, NEVER port 3000), and write a concise combined staging proof `.agents/run/staging-repairs-49-50-51/verifications/proof.md`.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-49-accepted.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-50-host-connection/.agents/run/issue-50-code-review/findings.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-51-toolbar-controls/.agents/run/issue-51-code-review/findings.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
.agents/run/staging-repairs-49-50-51/**
</owned_paths>
<criteria>
1. Merge `fix/issue-49-login-label` (`84d2e39`) into `staging/repairs-49-50-51` (`git merge --no-ff fix/issue-49-login-label -m "chore(staging): merge fix/issue-49-login-label into staging/repairs-49-50-51"`). Confirm zero merge conflicts and verify `git diff ab7516c..HEAD -- web/ service/ panel/ test/` contains ONLY the intended #49, #50, and #51 product/test diffs.
2. Run `npm run build`, verify `git status --short` is clean (bundles up to date), run `npm run typecheck`, run `npm test` (root test suite), and run `npm --prefix web test` (web test suite including `web/tests/login-label.test.mjs`).
3. Run an isolated ephemeral-port smoke verification across all three repairs on the merged tree (never port 3000, no production files/env):
- #49: verify `web/public/theme.css` `.sr-only` offscreen positioning (`left: -9999px; top: auto;`) and `web/tests/login-label.test.mjs` pass.
- #50: spawn `node service/main.js` on an ephemeral loopback port with a test token, verify `GET /health` with Bearer token returns 200 `{"status":"ok","service":"task-coordinator"}`, unauthenticated returns 401, unknown path returns 404, and `SIGTERM` exits 0 cleanly.
- #51: verify `node --test test/toolbar-controls.test.js` passes on the merged tree.
4. Record the combined results, commit hashes, test counts, and explicit L5 blind spots in `.agents/run/staging-repairs-49-50-51/verifications/proof.md` and commit locally on `staging/repairs-49-50-51` (do not push).
</criteria>
<verification>
npm run build && git status --short && npm run typecheck && npm test && npm --prefix web test
</verification>
<output>
Local commits on staging/repairs-49-50-51 (do not push). Return <=12 lines: merge status; product files changed vs ab7516c; root test count; web test count; typecheck + clean-build check; #49/#50/#51 smoke summary; staging HEAD commit hash; actual provider/model.
</output>
