<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-batch-simplify-staging
Branch: feat/batch-simplify-staging at 01f8d94 (release proof commit on top of ab7516c; clean at dispatch). Released commit claimed by release worker ses_ac63eb09079bf2cd8cda6006: local master + origin/master ab7516c4a3634c3d69f7b82936ddb7655d327ebb; release dir /workspace/releases/board/ab7516c-20261030 (current link), rollback /workspace/releases/board/cc08379-20261029; supervisor PID 78, child PID 116; SW version 1.2.1-e5b029b1b2. All are CLAIMS to verify independently. Specific doubts: (a) push output reported 8df6d7b..ab7516c, not cc08379..ab7516c — identify what 8df6d7b is and prove it is an ancestor of ab7516c with no lost remote work; (b) the receipt's batch-align endpoint check is ambiguous ("absent / 401") — determine via source of the released server bundle whether the web server exposes any batch-align route, without authenticated POSTs; (c) supervisor PID numbers in the receipt are inconsistent (previous 110/148 vs current 78/116) — confirm current ownership from /proc only.
Prior approved staging ab7516c4a3634c3d69f7b82936ddb7655d327ebb (master base cc083796c4bf62b57aaa76e2908f8b5cd47347dd).
Source and tests READ ONLY. Write only .agents/run/batch-simplify-release-audit/**. Preserve release proof and all other worktree data. No checkout, source edits, remote writes, deployment, restart, issue mutation, or credential access.
Public URL https://board.workflows.ac. Read-only unauthenticated public HTTP/browser allowed. Local release metadata, current symlink, checksum manifest, PID/cwd and nonsecret extension activation metadata may be inspected. Never read/probe /workspace/.openchamber-data/**, board.env, process environments, saved cookies or credentials. No remote -v/token-bearing URL output. Do not exercise real GitHub writes.
Authoritative startup facts: skip initial pwd/ls/status discovery; targeted inspection allowed for mutation verification/failure/resume. New scratch under /tmp/opencode.
Test baseline already root595/web449/parity18/browser47 green. This is release/activation proof audit, not an unlimited code review or repeat full suite without a reason.
</env_preflight>
<goal>
Independently prove that the human-approved #47/#48 batch is on remote master and served publicly, with honest distinction between published extension code and actually activated extension runtime.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-human-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-release-receipt.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-batch-simplify-staging/.agents/run/batch-simplify-release/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-isolation-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-web-accepted.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not implement or release this batch. Independently challenge the release worker's claims through actual public HTTP/browser, git ancestry/remote SHA, artifact hashes, process ownership and nonsecret extension metadata. A release receipt is a claim, not proof on its own.
</review_prompt>
<scope>
1. Verify approved staging ancestry in published master and release product tree. Read token-safe remote master SHA via bounded git ls-remote (capture and sanitize failures before output, never remote -v). Confirm no unrelated root branch merge or unreviewed product change. Do not fetch/push/change refs.
2. Verify current release symlink, complete manifest checksums, live child ownership/cwd, and deployed server/public assets vs exact committed approved sources/build. Package version alone does not establish freshness.
3. Public unauthenticated HTTPS with certificate verification: /health, /, /app.js, /theme.css, /sw.js, /manifest.json and required icon binaries. Compare asset byte hashes and status/expected content types to deployed and approved files. Verify real public login DOM desktop/phone and absence of JS errors; screenshot both. Confirm service worker is network-first/new version, no web Align Drafts control or exposed batch-align functionality (no authenticated mutation or unsafe POST probe needed). Public assets do not prove authenticated UI; keep scope honest.
4. Sessions: no reading or altering live session/password files. Confirm accepted #47 auth/config/SW unchanged in release and isolated restart/logout/rotation proof retained. Do not claim 30-day elapsed-time or live restart/session persistence based solely on synthetic tests. No live transfers or reorder probes.
5. Separately assess extension activation from nonsecret metadata. If host still loads busy root feat/v2-binding-and-ratelimit, or installed extension status cannot be proven, state NOT ACTIVE/NOT VERIFIED and exact safe activation path. Do not modify root, extension config, or shared host. Never infer the installed panel from master/source screenshots.
6. Verify #47/#48 closure/status receipts were explicitly human-directed. No human checkbox edits without human performance. Record any incomplete release criteria or sensitive evidence inclusion without echoing secret values.
</scope>
<criteria>
Return Spec Compliance PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES and Release PROCEED/PROCEED-WITH-CONDITIONS/HALT. Distinguish web-live, remote-published, extension-active, physical-device-unverified. Zero secret access or mutation. Any asset/ancestry/health mismatch is a required failure, not an accepted note. Do not auto-fix.
</criteria>
<output>
Write .agents/run/batch-simplify-release-audit/verifications/proof.md with commands/exits, independent observations, inspected screenshot paths, findings severity+file/line or endpoint, exact remote/deployed SHA and blind spots. Return <=15 lines with two verdicts/readiness, checked public bytes/health/TLS, extension activation result, required actions, proof path and actual provider/model.
</output>
