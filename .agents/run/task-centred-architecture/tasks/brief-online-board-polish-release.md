<env_preflight>
Repo: /workspace/extensions/github-task-board
Release worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-53-openchamber-look (branch feat/issue-53-openchamber-look @ 98261a8; product code 35a23fe; contains #54 4606b45; clean; node_modules + web/node_modules symlinked).
Root checkout: /workspace/extensions/github-task-board on local branch ops/task-board-activation (manager run-state only on top of master 8b7e059; this root is the INSTALLED OpenChamber extension source). Unrelated untracked .agents/idle-nontext-state.json must stay untouched. Manager will NOT commit in root while you run; trust its latest commit as root HEAD.
Master: local + origin/master = 8b7e059b17b7f4fad61a7466cd35cb34467807ef (confirm not checked out in any worktree before switching). Live web: /workspace/releases/board/current -> 8b7e059-20261102 (rollback target; older ab7516c-20261030 also kept). Supervisor /workspace/config/opencode/tools/board/{start,supervisor}.sh; PID/health facts under /tmp/opencode/board-supervisor.
Tests: npm run build (tree must stay clean); npm run typecheck; npm test (618 expected); node --test web/tests/*.test.mjs (479 expected); node --test test/shipped-parity.test.js.
Authoritative preflight: no discovery spin; targeted state checks immediately before every irreversible step (switch, merge, push, link switch, restart, label/comment).
Secrets wall: never read/probe /workspace/.openchamber-data/**, board.env, .env*, process environments, cookie/session/credential files, token-bearing remote URLs; never run `git remote -v`. No secrets, cookies, CSRF values or passwords in logs, argv, chat, evidence or commits. No live GitHub transfer/create/reorder probes. Do not kill/restart the main OpenChamber host or opencode server. Zero emojis. gh comment bodies: plain text only, no backticks or dollar signs.
</env_preflight>
<goal>
Release the human-approved #54 + #53 online-board batch (98261a8) to origin/master, deploy it live at https://board.workflows.ac with the 8b7e059 release kept for rollback, verify empirically on the public site, and post release receipts on #53 and #54 WITHOUT closing them.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/online-board-polish-l5-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-53-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-54-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-repairs-49-50-51-release.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/repairs-49-50-51-release-receipt.md]
Harnesses in the release worktree: .agents/run/issue-53-build/harnesses/verify-openchamber-look.mjs and (in the #54 worktree) .agents/run/issue-54-build/harnesses/verify-no-flash.mjs (also present on this branch).
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<authority>
D65 (2026-11-02): user selected "Release, but keep the issues open until I check live": push master, deploy live web keeping rollback, post receipts. Do NOT close #53 or #54. The #49/#50/#51 release brief and receipt are procedural templates only; their authority does not apply here.
No guest toggle: this batch changes only web/public/** and web/tests/**; panel/** and service/** are byte-identical to 8b7e059 (verify this; if not, STOP).
No new features, fixes, or test weakening. If a product change, behavioural conflict, or unreviewed source is needed, STOP before push/deploy and report.
</authority>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Before pushing, independently verify: 8b7e059 is an ancestor of 98261a8 (linear: 8b7e059 -> b14a787 -> 5b9bb70 -> 4606b45 -> 764bd08 -> 35a23fe -> 98261a8); product diff vs 8b7e059 limited to web/public/{index.html,app.js,theme.css} and web/tests/{issue-54-no-signin-flash.test.mjs,issue-53-openchamber-look.test.mjs} plus .agents/run/** evidence; .agents/run/** contains no credentials, cookies or runtime logs with secrets; deterministic build. Record Spec PASS/FAIL and Quality APPROVED/NEEDS-FIXES before pushing.
</review_prompt>
<scope>
Own release operations in the release worktree, root-checkout product sync (step 6), new .agents/run/online-board-polish-release/** evidence in the release worktree, and sanitized receipt .agents/run/task-centred-architecture/outputs/online-board-polish-release-receipt.md in the ROOT. Do not edit manager mission/tasks/decisions. No rebase/reset/force/stash, no remote branch deletion, no shared-config/proxy/Coolify/settings/secrets changes. Existing nonempty release dirs never overwritten. Preserve all branches, worktrees, evidence.
</scope>
<steps>
1. Hostile integration verdicts (review_prompt). Run the full test commands in the release worktree.
2. Fetch origin once with bounded timeout and sanitized output. If origin/master != 8b7e059, STOP and report (do not merge unreviewed remote changes into this batch).
3. In the release worktree, switch to master (confirm not checked out elsewhere), `git merge --ff-only feat/issue-53-openchamber-look`, push origin master without force, verify remote SHA via sanitized ls-remote. Do not claim push if the outcome is unknown. Switch the worktree back to feat/issue-53-openchamber-look afterwards.
4. Package the exact committed web production artifacts into a new immutable /workspace/releases/board/98261a8-20261103 (suffix if it exists) following the established layout; checksum every runtime artifact. Confirm the prior current target (8b7e059-20261102) and live child baseline first.
5. Atomically switch current + supported supervisor child restart (validate PID ownership; never kill unrelated processes). Measure downtime. On bad health/hash mismatch, roll back to 8b7e059-20261102 the same way, verify recovery, report failure honestly. Verify local + public TLS health 200 (cert validation on) and exact public index.html/app.js/theme.css/sw.js bytes vs artifacts. If the service worker caches assets, confirm its cache version changed so returning users get the new files (report, do not patch, if it did not).
6. Public signed-out check with Obscura at 1280px and 360px (no sign-in with production credentials): login view renders cleanly in dark theme, no page errors. Signed-in behaviour (no flash, rows, drawer, theme) is NOT to be exercised with production credentials: instead run both harnesses against the packaged release directory served on a loopback ephemeral port with the harnesses' synthetic backend, and state that the live signed-in view is for the user to check.
7. Root sync: in the ROOT checkout confirm only manager run-state differs from 8b7e059 and no uncommitted product edits, then `git merge --no-ff master -m "chore(ops): sync ops/task-board-activation with master 98261a8"` (any conflict => STOP, no stash/reset). `git diff master -- . ':(exclude).agents/run'` must be empty. No guest toggle.
8. Post a plain-language release receipt comment on #53 and on #54 quoting D65: what is live, the release path, rollback available, what the user should check (reload with no sign-in flash; panel-like look; drawer; Settings theme; quick add saves a draft; phone). Set label status:needs-human and remove status:in-review. Do NOT close either issue. No other issues touched.
9. Save sanitized proof (commands, exits, remote SHA, release path, checksums, HTTP/TLS, public hashes, screenshots, PID/restart facts, downtime, rollback info, issue receipts, blind spots) to .agents/run/online-board-polish-release/verifications/proof.md in the release worktree and commit there on feat/issue-53-openchamber-look (not master). Write a concise sanitized receipt to the root outputs path and commit it in root on ops/task-board-activation as a single run-state commit.
</steps>
<criteria>
origin/master == 98261a8; live current release bytes and public assets equal the committed build; local + public health 200, TLS valid; public login renders without errors; loopback harnesses pass against the packaged release; root product tree == master; no guest toggle, no whole-host restart, no secrets, no unintended GitHub writes; #53/#54 open with receipts and status:needs-human; rollback path preserved. Any unmet criterion => PARTIAL/BLOCKED, never success.
</criteria>
<output>
Return <=15 lines: integration verdicts; remote master SHA + push result; release path/current target + rollback path; test counts; HTTP/TLS/public hash checks; service worker cache note; public login check; loopback harness results; root sync commit; issue receipts + labels; commits; blind spots; actual provider/model.
</output>
