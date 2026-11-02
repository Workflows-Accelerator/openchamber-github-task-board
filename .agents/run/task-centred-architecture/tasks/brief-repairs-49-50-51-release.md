<env_preflight>
Repo: /workspace/extensions/github-task-board
Release worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51 (branch staging/repairs-49-50-51 @ 8b7e059b17b7f4fad61a7466cd35cb34467807ef, merge 1a6e050, clean; node_modules + web/node_modules symlinked).
Root checkout: /workspace/extensions/github-task-board on local branch ops/task-board-activation (manager run-state only on top of master ab7516c; this root checkout is the INSTALLED OpenChamber extension source). Unrelated untracked .agents/idle-nontext-state.json must stay untouched. Manager will NOT commit in root while you run; trust its latest commit as the root HEAD.
Master: local + origin/master = ab7516c4a3634c3d69f7b82936ddb7655d327ebb (not checked out in any worktree at dispatch; confirm before switching). Live web release: /workspace/releases/board/ab7516c-20261030 via /workspace/releases/board/current (supervisor /workspace/config/opencode/tools/board/{start,supervisor}.sh; PID/health facts under /tmp/opencode/board-supervisor).
Installed guest ID: github-task-board (supported host API PUT /api/guests/github-task-board/enabled false->true, frame-grant for served-bundle hash) as used in outputs/task-board-activation-receipt.md.
Tests: npm run build (must leave tree clean); npm run typecheck; npm test (618 expected); node --test web/tests/*.test.mjs (453 expected); node --test test/shipped-parity.test.js.
Authoritative preflight: no initial pwd/ls/status discovery spin; targeted state checks are required immediately before every irreversible step (switch, merge, push, link switch, restart, toggle, issue close).
Secrets wall: never read/probe /workspace/.openchamber-data/**, board.env, .env*, process environments, cookie/session/credential files, token-bearing remote URLs; never run `git remote -v`. No secrets, cookies, CSRF values or passwords in logs, argv, chat, evidence or commits. No live GitHub transfer/create/reorder probes; no label writes except the closure steps below. Do not kill/restart the main OpenChamber host or opencode server. Zero emojis.
</env_preflight>
<goal>
Release the human-approved #49/#50/#51 staging batch (8b7e059) to origin/master, deploy it live at https://board.workflows.ac, activate it in the installed OpenChamber extension via the supported guest off/on toggle only, verify empirically, and close #49/#50/#51 with receipts.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/repairs-49-50-51-human-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/repairs-49-50-51-l5-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-staging-repairs-49-50-51/.agents/run/staging-repairs-49-50-51/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-batch-simplify-release.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-task-board-activation.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-release-receipt.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/task-board-activation-receipt.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<authority>
D60 (2026-11-02): user selected "Approve all 3 & release (Recommended)": push master, deploy live web, activate the extension (no whole-host restart), close #49/#50/#51. All three passed L4 + independent audit + combined staging. The two prior briefs above are procedural templates only; their authority sections applied to #47/#48 and do not extend scope beyond this brief.
No new features, fixes, or test weakening. If a product change, behavioural conflict, or unreviewed source is needed, STOP before publish/deploy/activation and report.
</authority>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Before releasing, independently verify: exact ancestry (ab7516c ancestor of 8b7e059; 84d2e39, f0dae5b, c37ad8b all included), product diff vs ab7516c limited to the 13 reviewed files (panel/index.html, panel/main.{ts,js}, service/{config,main,types}.ts, service/main.js, test/{panel-service-connection,service-host-connection,toolbar-controls}.test.js, web/public/theme.css, web/tests/login-label{.test,-browser-verify}.mjs) plus .agents/run/** evidence, no synthetic credentials/runtime logs included, deterministic build. Record Spec PASS/FAIL and Quality APPROVED/NEEDS-FIXES before pushing.
</review_prompt>
<scope>
Own release operations in the release worktree, root-checkout product sync for activation (step 6), new .agents/run/repairs-49-50-51-release/** evidence, and sanitized receipt outputs/repairs-49-50-51-release-receipt.md in the ROOT .agents/run/task-centred-architecture/outputs/. Do not edit manager mission/tasks/decisions. No rebase/reset/force/stash, no remote branch deletion, no shared-config/proxy/Coolify/settings/secrets changes. Existing nonempty release dirs never overwritten; prior release kept for rollback. Preserve all branches, worktrees, evidence.
</scope>
<steps>
1. Hostile integration verdicts (review_prompt). Run the full test commands in the release worktree.
2. Fetch origin once with bounded timeout and sanitized output. If origin/master != ab7516c, normal-merge it into staging; any product conflict or unreviewed source => STOP and report before push.
3. In the release worktree, switch to master (confirm not checked out elsewhere), `git merge --ff-only staging/repairs-49-50-51` (or --no-ff if ff impossible, with no new source), push origin master without force, verify remote SHA via sanitized ls-remote. Do not claim push if outcome unknown. Switch the worktree back to staging/repairs-49-50-51 afterwards so master is not left checked out there.
4. Package the exact committed web production artifacts into a new immutable /workspace/releases/board/<sha7>-20261102[-suffix] following the established layout; checksum every runtime artifact. Confirm prior current target and live child baseline first.
5. Atomically switch current + supported supervisor child restart (validate PID ownership; never kill unrelated processes). Measure, don't claim, downtime. On bad health/hash mismatch, roll back to ab7516c-20261030 the same way, verify recovery, report failure honestly. Verify local + public TLS health 200 (cert validation on), exact public HTML/app.js/theme.css/sw.js bytes vs artifacts, and the real public login DOM at 1280px and 360px (no sign-in with production credentials): hidden username label must not bleed (#49). Screenshot and capture page errors.
6. Extension activation: in the ROOT checkout, confirm only manager run-state differs from ab7516c and no uncommitted product edits exist, then normal `git merge --ff-only`-impossible case => `git merge --no-ff master -m "chore(ops): sync ops/task-board-activation with master <sha7>"` (run-state files only on the ops side; any conflict => STOP, no stash/reset). Root product tree must then byte-match new master (`git diff master -- . ':(exclude).agents/run'` empty). Then toggle ONLY guest github-task-board via supported PUT enabled false -> true once (inspect state before any retry). Verify: served panel/main.js SHA-256 equals disk via frame-grant; the background service answers authenticated /health 200 through the host bridge or host service status shows running (nonsecret metadata only); in the real host iframe (isolated browser context, Obscura or Chromium if available) the toolbar shows styled Sort, left-aligned project label with end ellipsis, unclipped View, and NO "Background coordinator service failed to connect" banner; zero console/page errors. Read-only interactions only: no issue/draft writes, no agent starts; if task loading would trigger StatusReconciler label writes, do not load tasks and report that boundary. If the real host iframe cannot be exercised, report NOT VERIFIED with the exact boundary.
7. After remote, live web, and activation checks pass, post a plain-language release receipt comment on each of #49, #50, #51 quoting D60 approval, set status:done (remove status:needs-human), and close each as completed. No other issues touched. If any check failed, do NOT close the affected issue; report.
8. Save sanitized proof (commands, exits, remote SHA, release path, checksums, HTTP/TLS, public hashes, screenshots, PID/restart facts, guest toggle lifecycle, served hash, rollback info, issue receipts, blind spots) to the release worktree .agents/run/repairs-49-50-51-release/verifications/proof.md and commit there on staging/repairs-49-50-51 (not master). Write concise sanitized receipt to the root outputs path; commit it in root on ops/task-board-activation as a single run-state commit.
</steps>
<criteria>
origin/master == approved candidate (or reviewed merge of it); live current release bytes and public assets equal the committed build; local + public health 200, TLS valid; #49 label bleed absent on live login; extension runtime serves new bundle and service is reachable or exact boundary disclosed; no whole-host restart, no secrets, no unintended GitHub writes; #49/#50/#51 closed only if their checks passed; rollback path preserved. Any unmet criterion => PARTIAL/BLOCKED, never success.
</criteria>
<output>
Return <=15 lines: integration verdicts; remote master SHA + push result; release path/current target + rollback path; test counts; HTTP/TLS/public hash checks; #49 live login check; activation (served hash, service health, iframe toolbar/banner, errors); production mutations performed; issue closure receipts; commits; blind spots; actual provider/model.
</output>
