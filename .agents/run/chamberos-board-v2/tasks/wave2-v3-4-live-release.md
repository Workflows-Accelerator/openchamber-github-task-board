<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_V3_3_SHA] (clean; L4 hostile + design audit APPROVED; descendant of master `4e92c01`)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Live release dir: /workspace/releases/board/ (preserve 59e5d05-20261111 and 98261a8-20261103 intact for rollback)
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh and /workspace/code/openchamber-config/tools/board/supervisor.sh (READ/EXECUTE ONLY; NEVER edit `/workspace/code/openchamber-config`)
Do not touch: web/**, panel/**, service/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/** (NEVER read/print secrets), GitHub issue closures
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>
<goal>Fast-forward `master` to the L4-approved V3 commit, push `origin/master`, deploy the new V3 release bundle to `/workspace/releases/board/` and `https://board.workflows.ac`, and empirically verify live HTTPS health, asset SHA-256s, and signed-out mobile/desktop rendering while preserving prior releases for rollback.</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
[@/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/V3-3/report.md]
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/ship/release/shipping-and-launch/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/proof/verify-and-stop/SKILL.md]
</skills>
<owned_paths>
/workspace/releases/board/**
/workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3/.agents/run/chamberos-board-v2/verifications/V3-4/**
</owned_paths>
<depends_on>
wave2-v3-3-hostile-design-audit
</depends_on>
<steps>
<step>1. Verify git ancestry (`git merge-base --is-ancestor master HEAD`), confirm `git diff --stat 98261a8..HEAD -- panel service` is empty, and run a secret scan over `git log -p 4e92c01..HEAD -- web scripts`.</step>
<step>2. Fast-forward local `master` (`git branch -f master HEAD`); note that remote `git push origin master` will be executed by the manager session immediately upon your completion if subagent shell policy rejects `git push`.</step>
<step>3. Compile server bundle with `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/<short-app-sha>-20261111/web/dist/server.mjs` and stage `/workspace/releases/board/<short-app-sha>-20261111` (`package.json`, `web/dist/server.mjs`, all files in `web/public/`, and `checksums.sha256` verified with `sha256sum -c --strict checksums.sha256` and exact file coverage). Preserve `59e5d05-20261111` and `98261a8-20261103` untouched for rollback.</step>
<step>4. Atomically switch `/workspace/releases/board/current`, gracefully `kill -TERM` old supervisor PID from `/tmp/opencode/board-supervisor/supervisor.pid`, wait for exit, and start `/workspace/code/openchamber-config/tools/board/start.sh` without reading or logging any secrets.</step>
<step>5. Verify `http://127.0.0.1:8787/health` and `https://board.workflows.ac/health` return HTTP 200, verify live HTTPS SHA-256 hashes of `index.html`, `app.js`, `theme.css`, `arrange.js`, `markdown.js`, and `sw.js` match `checksums.sha256` byte-for-byte, and capture signed-out mobile (`390x844`) and desktop (`1280x900`) Chromium screenshots of live `https://board.workflows.ac` under `.agents/run/chamberos-board-v2/verifications/V3-4/screenshots/`. Record `.agents/run/chamberos-board-v2/verifications/V3-4/release-receipt.md` and commit locally on `feat/board-v3`.</step>
</steps>
<criteria>
1. `origin/master` and local `master` fast-forwarded to V3 commit; `panel/**` and `service/**` untouched.
2. Staged release passes `sha256sum -c --strict checksums.sha256`; rollback directories `59e5d05-20261111` and `98261a8-20261103` preserved.
3. Live `https://board.workflows.ac/health` returns 200 and all 6 core public assets match staged SHA-256 hashes over HTTPS.
4. Zero secrets printed/logged; zero edits to `/workspace/code/openchamber-config`; zero GitHub issues closed.
</criteria>
<verification>
curl -fsS http://127.0.0.1:8787/health && curl -fsS https://board.workflows.ac/health
</verification>
<output>
Respond in concise structured Markdown with:
- STATUS: PASS | ROLLED_BACK | BLOCKED
- MASTER_SHA: exact SHA on origin/master
- RELEASE_DIR: exact release path and symlink target
- LIVE_HASH_VERIFICATION: table comparing staged vs live HTTPS SHA-256 for index.html, app.js, theme.css, arrange.js, markdown.js, sw.js
- SCREENSHOTS: paths to live signed-out screenshots
- NOT_VERIFIED: honest blind spots
</output>
