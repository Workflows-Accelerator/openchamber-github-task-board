<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look (branch feat/issue-53-openchamber-look at 1cb1e18, release proof commit on top of 98261a8; clean).
Claims by release worker ses_b16a4aba3159b4e08f4e9850 to verify independently:
- local master + origin/master = 98261a8b417c8005b63bc234399bdf6e4cebb974 (fast-forwarded from 8b7e059b17b7f4fad61a7466cd35cb34467807ef).
- release dir /workspace/releases/board/98261a8-20261103 (current symlink), rollback /workspace/releases/board/8b7e059-20261102; supervisor PID 1191855, child PID 1191902; SW CACHE_VERSION 1.2.1-1c05c9137b.
- root checkout /workspace/extensions/github-task-board on ops/task-board-activation (898ec36 merge, 3f435bf receipt) has 0-byte product diff vs master 98261a8.
- Issues #53 (comment 6612603077) and #54 (comment 6612604228) are OPEN with label status:needs-human (status:in-review removed) per D65.
Source and tests READ ONLY. Write only .agents/run/online-board-polish-release-audit/** in this worktree. No checkout, source edits, remote writes, deployment, restart, issue mutation, or credential access.
Secrets wall: never read/probe /workspace/.openchamber-data/**, board.env, .env*, `/proc/*/environ`, saved cookies or credentials. Never run `git remote -v`. Zero emojis.
</env_preflight>
<goal>
Independently audit the #53/#54 release, live web deployment at https://board.workflows.ac, root checkout sync, and GitHub issue state, and record Spec, Quality, and Release verdicts.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/online-board-polish-l5-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/online-board-polish-release-receipt.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look/.agents/run/online-board-polish-release/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<owned_paths>
.agents/run/online-board-polish-release-audit/**
</owned_paths>
<criteria>
1. Verify git ancestry (8b7e059 -> 4606b45 -> 35a23fe -> 98261a8), token-safe `git ls-remote origin master`, and 0-byte product diff between root checkout `/workspace/extensions/github-task-board` and `master`.
2. Verify `/workspace/releases/board/current` target, `sha256sum -c --strict checksums.sha256`, and live supervisor/child PID + CWD in `/proc` (cmdline/cwd only, never environ).
3. Verify unauthenticated local (`http://127.0.0.1:8787`) and public HTTPS (`https://board.workflows.ac` with TLS cert verification) `/health`, `/`, `/app.js`, `/theme.css`, `/sw.js`, `/manifest.json` byte-match deployed artifacts. Verify the deployed `index.html` has `#login-view` hidden by default (#54) and `theme.css` has `#0f1012` / `#f4f5f7` (#53). Inspect the release worker's live login screenshots with `read`.
4. Verify GitHub issues #53 and #54 via `gh issue view` (read-only): both OPEN, `status:needs-human` present, `status:in-review` absent, receipts present.
5. Write `.agents/run/online-board-polish-release-audit/verifications/proof.md` and commit locally on `feat/issue-53-openchamber-look` (do not push). Give Spec (`PASS`/`PARTIAL`/`FAIL`), Quality (`APPROVED`/`NEEDS-FIXES`), and Release (`PROCEED`/`PROCEED-WITH-CONDITIONS`/`HALT`) verdicts.
</criteria>
<output>
Return <=10 lines: Spec/Quality/Release verdicts; remote master + root sync check; live web health/TLS/asset hash + screenshot check; issue #53/#54 state check; audit commit hash; actual provider/model.
</output>
