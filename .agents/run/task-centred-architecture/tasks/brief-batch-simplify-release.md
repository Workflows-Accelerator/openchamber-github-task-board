<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-batch-simplify-staging
Branch: feat/batch-simplify-staging
Reviewed HEAD: ab7516c4a3634c3d69f7b82936ddb7655d327ebb (product integration a29192c; prior base master cc083796c4bf62b57aaa76e2908f8b5cd47347dd).
Known dirty: ONLY tracked .agents/run/batch-simplify-staging/preview/preview.log from the running synthetic preview; preserve it safely, never discard it or blindly stage it. Preview PID recorded 1690522, port 4040; verify ownership before any stop. Runtime logs are not product changes.
Root branch feat/v2-binding-and-ratelimit is unrelated historic portfolio work and manager state. Never merge or checkout or alter that branch; root untracked .agents/idle-nontext-state.json is unrelated.
Files: web/server/{app,auth,config,github,board}.ts, web/public/**, panel/**, test/**, .agents/run/batch-simplify-staging/**.
Tests: npm run typecheck; npx tsc -p web/tsconfig.json; node --test --test-concurrency=1 test/*.test.js; node --test web/tests/*.test.mjs; node --test test/shipped-parity.test.js; browser harnesses. Use isolated fixture/data paths, never real storage.
Authoritative preflight: no initial pwd/ls/status discovery spin; targeted state checks allowed before irreversible side effects, commit/switch, failure, or resume.
Do not read/probe /workspace/.openchamber-data/**, board.env or saved credentials. Never print git remote -v or any token-bearing remote URL. No secrets, cookies, CSRF values or real passwords in logs, argv, chat, evidence or commits. Existing supervisor owns production environment loading; use its supported restart path without reading credentials.
</env_preflight>
<goal>
Release the human-approved exact #47/#48 staging batch to origin/master and the live board at https://board.workflows.ac, with empirical release proof, preserved session data and rollback safety.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-human-approval.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/batch-simplify-staging-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-isolation-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-web-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/release-mobile-parity-offline-receipt.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<authority>
User explicitly said "Approved" in response to approving #47 AND #48 to merge master, push, deploy and close, then said "Continue". Both issues independently passed L4. This is L5 approval, not evidence physical-phone tests happened. User-directed closure is authorized only after deployment and remote verification. Do not check human acceptance boxes on their behalf.
This brief overrides obsolete permission claims in older receipts, never the secrets wall or application scope. No new features, fixes, or test weakening. If product change or behavioural conflict is needed, STOP before publish/deploy and report.
</authority>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are a fresh release worker. First independently inspect integration-only changes: exact candidate ancestry, no unrelated root merge, no behavioural merge conflicts, no synthetic credential/runtime log inclusion in deploy artifacts, deterministic generated bundle, preserved #47 auth/config/SW. Record Spec PASS/FAIL and Quality APPROVED/NEEDS-FIXES before releasing. Existing per-issue hostile passes remain authoritative, but do not trust an integration self-report blindly.
</review_prompt>
<scope>
Own release operations in this worktree and new .agents/run/batch-simplify-release/** evidence. May normally merge/fetch/push origin/master because L4 and human approval exist. No rebase/reset/force or remote branch deletion. No changes to application source, tests, dependency definitions, shared skills, proxies, Coolify, settings or secrets.
May stage a new immutable /workspace/releases/board/<approved-SHA>-<unique-suffix> artifact and atomically switch /workspace/releases/board/current using the existing supervisor. Existing nonempty release dirs must never be overwritten. Keep prior release for rollback. Runtime artifact directory creation follows existing release procedure; never create additional worktrees with mkdir. Do not mutate persistent production data.
May read supported supervisor source /workspace/config/opencode/tools/board/{start,supervisor}.sh and inspect only PID/cwd/ownership/health facts under /tmp/opencode/board-supervisor. No raw log/environment dumps or process argv exposing secrets.
May write a sanitized release receipt to root .agents/run/task-centred-architecture/outputs/batch-simplify-release-receipt.md for the manager. Do not edit manager mission/tasks/decisions.
No worktree teardown while release or verification is running. Preserve branches and ALL unique review harnesses, raw logs, screenshots, proof dirs and histories before later cleanup. Proof.md copies alone are not sufficient for cleanup.
</scope>
<steps>
1. Record hostile integration verdicts. Preserve/reconcile the dirty synthetic preview log without product edits or loss; untrack runtime logs only if evidence hygiene requires a narrowly scoped run-state commit. Never include actual secrets in any commit. Use /tmp/opencode for new scratch output.
2. Verify protected files vs #47, ancestors cc08379/268bd28/c9fb61b/d5a205d, full types/builds/tests, deterministic panel+service rebuild and relevant web browser harnesses. All tests use isolated synthetic stores. No live GitHub mutations.
3. Fetch origin/master once with bounded timeout and token-safe captured/sanitized error output. No remote -v, credential output or blind retry. Compare local master, remote master and approved staging. If remote moved, normal merge of origin/master is permitted but any product behavioural conflict/new unreviewed source requires STOP and fresh manager review before push. Never overwrite remote or pull the unrelated root branch.
4. Use this same worktree to advance master safely (master was not checked out elsewhere at manager inspection; confirm targeted topology before switching). Keep original feature branch. Normal fast-forward or no-ff merge of exact approved staging only. Push origin/master without force; verify remote SHA via sanitized ls-remote/fetch result. Do not claim push if outcome unknown.
5. Package exactly committed production artifacts and required dependencies using the established immutable release layout. Verify checksums cover every runtime artifact; stage complete web public assets, manifest, SW, binary icons and server bundle. Confirm prior symlink and live child baseline first. Do not read production credentials or data.
6. Atomic current-link switch + supported supervisor child restart. Validate ownership before signalling. A brief controlled restart is possible; never claim zero downtime without measuring. Do not kill unrelated processes. On bad health/artifact mismatch, restore prior link and restart with the same supported path, verify recovery, report failure honestly. Do not rotate or delete sessions.
7. Verify local and public TLS health (certificate validation enabled), exact public HTML/app.js/theme.css/sw.js bytes vs approved artifacts, network-first updated SW and no web Align Drafts control/endpoint. Inspect real public login DOM on desktop/phone viewports without authenticating with stored production credentials; screenshot it and capture page errors safely. Do not mutate real GitHub to prove transfer/reorder. Session persistence/CSRF/password rotation remains proven in isolated tests, not by reading live sessions.
8. Determine installed extension activation using only nonsecret supported extension/package metadata, without changing the busy root checkout. Release panel code on master is authorized; if host points at historic root or requires restart/activation steps, report exact safe user step rather than claim new panel is running. Do not install a parallel OpenChamber or change shared config to hide this limitation.
9. After remote and live checks pass, post plain-language release receipt comments to #47/#48 quoting human approval. As this explicit human-directed release pipeline only, move both to status:done and close them with completed reason, without changing human checklist boxes. Remove obsolete human review blockers only if obsolete, preserving human approval in Work Log. No auto-close beyond these two issues.
10. Save sanitized proof with commands, exits, remote SHA, deployed artifact hash/path, checksums, local/public HTTP statuses, screenshots/errors, PID ownership/restart, rollback info, issue receipts and exact remaining blind spots. Commit run-state evidence on an appropriate local feature/release ref; don't add an unreviewed product change to master. Copy concise sanitized receipt into manager root output path.
</steps>
<criteria>
Remote master includes all reviewed candidates; no unrelated root source merged. Live current artifact bytes and public served assets equal the approved committed build, local+public health 200, TLS valid, no web Align Drafts, no production persistent data/credentials touched, all empirical gates pass, human-directed #47/#48 closure receipts recorded. Installed extension activation must be explicitly VERIFIED or NOT VERIFIED with safe next step. No live GitHub transfer/create/close probes. Preserve rollback and evidence. If unable to meet a criterion, return BLOCKED/PARTIAL, not a success claim.
</criteria>
<output>
Write full proof .agents/run/batch-simplify-release/verifications/proof.md and sanitized root outputs/batch-simplify-release-receipt.md. Return <=15 lines: two integration hostile verdicts, final local+remote master SHA and push exit, release path/current target, checks/tests counts, HTTP/TLS/public hashes, production mutations performed, issue receipts/closure status, installed extension status, rollback and cleanup follow-ups, blind spots, actual provider/model.
</output>
