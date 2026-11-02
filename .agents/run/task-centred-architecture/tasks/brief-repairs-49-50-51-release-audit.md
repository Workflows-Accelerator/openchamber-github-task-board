<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51
Branch: staging/repairs-49-50-51 at b09ad8e (release proof commit on top of 8b7e059; clean at dispatch).
Claims by release worker ses_bc302ed28ddbd754b3a0a076 to verify independently:
- local master + origin/master = 8b7e059b17b7f4fad61a7466cd35cb34467807ef (fast-forwarded from ab7516c4a3634c3d69f7b82936ddb7655d327ebb).
- release dir /workspace/releases/board/8b7e059-20261102 (current symlink), rollback /workspace/releases/board/ab7516c-20261030; supervisor PID 125, child PID 163; SW CACHE_VERSION 1.2.1-c812caa389.
- root checkout /workspace/extensions/github-task-board on ops/task-board-activation at 3803764 has 0-byte product diff vs master 8b7e059.
- Issues #49 (comment 6575277632), #50 (comment 6575304696), #51 (comment 6575323971) closed as completed with status:done.
- Specific doubt to check: (a) release receipt reported `Toolbar Controls Tests: 23/23, Panel Connection Tests: 9/9, Service Host Tests: 5/5`, whereas `node --test` top-level tests are 4, 10, and 9 — verify why the receipt's numbers differed (e.g. assertion count vs top-level test count); (b) port 3000 returned 401 on unauthenticated `/api/guests/*` — inspect nonsecret host source `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/` and nonsecret `/proc/[0-9]*/cwd` + `cmdline` (NEVER `environ`) to determine: (1) whether guest panel assets (`panel/index.html`, `panel/main.js`) are read directly from disk on each panel load or cached in memory, (2) whether a `service/main.js` child process is currently running, and (3) whether `serviceRequest` from an authenticated panel session starts the guest service on demand if enabled or requires a Settings toggle.
Source and tests READ ONLY. Write only .agents/run/repairs-49-50-51-release-audit/** in this worktree. No checkout, source edits, remote writes, deployment, restart, issue mutation, or credential access.
Secrets wall: never read/probe /workspace/.openchamber-data/**, board.env, .env*, `/proc/*/environ`, saved cookies or credentials. Never run `git remote -v`. Zero emojis.
</env_preflight>
<goal>
Independently audit the #49/#50/#51 release, live web deployment at https://board.workflows.ac, root checkout sync, and nonsecret host extension runtime behavior, and record Spec, Quality, and Release verdicts.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/repairs-49-50-51-human-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/repairs-49-50-51-release-receipt.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51/.agents/run/repairs-49-50-51-release/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
.agents/run/repairs-49-50-51-release-audit/**
</owned_paths>
<criteria>
1. Verify git ancestry (`ab7516c`, `84d2e39`, `f0dae5b`, `c37ad8b` all ancestors of `8b7e059`), token-safe `git ls-remote origin master`, and 0-byte product diff between root checkout `/workspace/extensions/github-task-board` and `master`.
2. Verify `/workspace/releases/board/current` target, `sha256sum -c --strict checksums.sha256` (11/11), and live supervisor/child PID + CWD in `/proc`.
3. Verify unauthenticated local (`http://127.0.0.1:8787`) and public HTTPS (`https://board.workflows.ac` with TLS cert verification) `/health`, `/`, `/app.js`, `/theme.css`, `/sw.js`, `/manifest.json` byte-match deployed artifacts. Inspect the release worker's live login screenshots (`live-login-1280.png`, `live-login-360.png`) with `read` and confirm `#49` hidden username label bleed is gone.
4. Inspect nonsecret host source under `/usr/local/lib/node_modules/@openchamber/web/server/lib/guests/` and nonsecret `/proc` cmdline/cwd to answer the 3 runtime questions in `<env_preflight>` (panel disk serving vs memory cache; current `service/main.js` process presence; `serviceRequest` on-demand service start vs manual toggle).
5. Verify GitHub issues #49, #50, #51 state/labels/comments via `gh issue view` (read-only). Check the sub-test count discrepancy in the release receipt.
6. Write `.agents/run/repairs-49-50-51-release-audit/verifications/proof.md` and commit locally on `staging/repairs-49-50-51` (do not push). Give Spec (`PASS`/`PARTIAL`/`FAIL`), Quality (`APPROVED`/`NEEDS-FIXES`), and Release (`PROCEED`/`PROCEED-WITH-CONDITIONS`/`HALT`) verdicts.
</criteria>
<output>
Return <=12 lines: Spec/Quality/Release verdicts; remote master + root sync check; live web health/TLS/11-asset hash + #49 login screenshot check; answers to the 3 host extension runtime questions; sub-test count note; issue #49/#50/#51 state check; audit commit hash; actual provider/model.
</output>
