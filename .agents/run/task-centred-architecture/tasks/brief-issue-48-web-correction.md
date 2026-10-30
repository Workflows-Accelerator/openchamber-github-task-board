<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views
Branch: feat/issue-48-web-simple-views
Base/current product candidate: e630a9ddd044389787a66f458b1ee49c944db250
State: DISPATCHABLE NOW. Independent reviewer ses_ca48a1f70a74aef3aa647615 completed read-only with 0 app/test edits and untracked proof under .agents/run/issue-48-web-hostile/** (preserve that directory untouched). No concurrent writer in this worktree.
Integration input: fix/issue-47-fresh-app-stay-signed-in at268bd28738443863d6a58b5e4500ad20b6aaa05f, independent L4 passed; contains4b3f475 session hardening and268bd28 test isolation.
Owned paths: web/** plus own .agents/run/issue-48-web-correction/**. Do not edit panel/**, root test/**, shared/config files or dependencies. Normal git merge may incorporate the #47 branch's committed evidence only; do not rewrite that history.
Tests: inspect all new test/browser server storage first; npm run typecheck; npx tsc -p web/tsconfig.json; node --test web/tests/*.test.mjs only AFTER merging #47 isolation and auditing all #48-added server paths; node --test --test-concurrency=1 test/*.test.js; node web/tests/issue-48-browser-verify.mjs against fake GitHub/private local stores; server bundle as existing build script.
Do not access live board, real GitHub writes, /workspace/.openchamber-data/**, /workspace/config/**, /workspace/releases/**, real credentials or remote URLs. No push, deployment, master edit, rebase, reset, force, issue closure or worktree cleanup. Synthetic test secrets never logged or put in argv. Preserve reviewer evidence.
Preflight facts authoritative after review receipt exists. No startup pwd/ls/status spin. Targeted merge/commit/state checks after mutations or stale facts allowed. If merge conflicts arise, resolve only known #47/#48 overlapping web files; stop for unexplained changes.
</env_preflight>
<goal>
Correct the independent web review findings so quick draft capture and reordering meet the approved simple experience while preserving existing tasks and the reviewed sign-in improvements.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-web-initial-review-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/amendment-issue-48-web-preserve-sessions-and-issues.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-isolation-accepted.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/amendment-issue-48-confirmed-transfer.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-web-hostile-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-hostile/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
1. Integrate latest #47 with a normal merge (no cherry-pick/rebase) from the named branch, preserving config deterministic password salt, passwordHash SessionStore wiring, CSRF derivation, fresh-app registration/login and isolated tests. Prove both features together. Do not run full web glob before known isolation is present. Audit new browser harness/session/project-rename paths, including option overrides and subprocesses, and isolate every one.
2. D55 approved confirmed native GitHub transfer on BOTH surfaces (see amendment-issue-48-confirmed-transfer.md). Replace existing-draft create/comment/close move operation in client AND server; leaving a hidden unsafe callable path is not a fix. Ask explicit confirmation before transfer; Cancel performs zero writes. Use fresh issue and target repository node IDs; retain returned canonical identity/number/URL and invalidate source/target snapshots without affecting same-number issues. Permission failures preserve source, show useful message and never copy/recreate/close as fallback. Ambiguous response must hold mutation identity, reconcile rather than blindly retry, and keep navigation/edits from targeting stale source or new number in wrong repo. New unsaved drafts retain project choice before creation including offline queue. No additional auth scopes or credentials; no automatic Done/closure.
3. Free manual reorder: all unmarked, mixed, equal ranks, both directions, start/end and precision exhaustion must work. Keep GitHub hidden numeric marker and deterministic tie break, but manager's single-item-write limitation is superseded when it makes the approved behaviour impossible. Use the smallest lazy neighbouring-marker initialization/rebalance needed; do not rewrite titles, unrelated body sections, labels or state. Fetch raw fresh body, preserve conflict/UNKNOWN checks for EVERY touched issue. Simulate stale/partial/ambiguous write and reconcile real order without false success or blind re-send. Do not imply whole-list atomicity across GitHub. Capture any multi-issue write limitation plainly. Manual action must visibly use Manual order and persist across browser reload and a second browser instance.
4. Capture safety: keep local payload when create outcome is unknown, prevent automatic duplicate retries after response loss/reload/reconnect. Prefer minimal explicit uncertain state + reconcile guidance over a speculative distributed idempotency platform. Keep pre-dispatch failures safely retryable. Do not delete queued ideas or mark uncertain entries synced without a verified corresponding issue. Two submissions/Enter bursts and sign-out/reconnect must not send same local entry concurrently. Preserve optional description and target project.
5. Compact Draft list only to meet existing minimal brief: one title line, optional muted description, compact project identity, accessible secondary controls without a full always-visible extra form row per issue. Preserve 44px touch targets and keyboard movement. Do not remove views or redesign workflow. Use phone screenshots to reduce wasted top chrome/repeated helper text and excess row height, not merely claim no overflow. Add row stays bottom and reachable. Compare with original supplied screenshots; do not call subjective simplicity approved until human review.
6. Fold ALL ten independent review findings F1–F10 from issue-48-web-hostile-review-gate.md and proof.md into this single bounded pass:
- F1: confirmed native GitHub GraphQL transferIssue (replacing copy+comment+close), cancel=0 writes, permission error preserves source without fallback, unknown holds identity and reconciles. Fake GitHub in web/tests/fake-github.mjs must support GraphQL node IDs + transferIssue mutation for local L2/L3 verification.
- F2: offline queue operation ID + revision + uncertain state; never auto-resend uncertain creates; preserve in-flight edits and same-title distinct entries; cold offline reload with SW renders local offline draft editor cleanly instead of hiding the queue behind a sign-in error.
- F3: terminal unfenced marker parsing/stripping/replacement only; preserve fenced `<!-- board-order: ... -->`, CRLF line endings, and Markdown trailing hard-break spaces.
- F4: qualify Mark Done/checklist/inline buffers by repo+number, read-generation/drawer guard on late responses, preserve unsaved text across checkbox/reorder mutations, bind inline buffers to observed fingerprints, and fix `el()` boolean `checked` property so `- [ ]` renders unchecked.
- F5: lazy neighbour initialization/rebalance across unmarked, mixed, equal and precision-exhausted ranks (53+ midpoints), plus neighbour identity/fingerprint validation and honest partial-write reconciliation.
- F6: Pending items renders explicit human-task completion checkboxes (`### Human Tasks:`) using conflict-safe checklist updates (never auto-closing the issue) plus a source GitHub link.
- F7: fence-aware dependency parser supporting `- [ ] Blocked by #N`, bullet/numbered prefixes, and ignoring code fences.
- F8: auto-size/expand multiline draft descriptions so 360px lines never clip, ensure question option buttons meet >=44px height, restore focus on drawer close, and trim avoidable phone header/row bloat.
- F9: merge `fix/issue-47-fresh-app-stay-signed-in` (`268bd28738443863d6a58b5e4500ad20b6aaa05f`) keeping `passwordHash: config.passwordHash` AND `namesPath`, and give each test fixture its own unique directory (`mkdtempSync`) so both `sessions.json` and `project-names.json` are isolated and cleaned up.
- F10: remove/disable `/api/repos/.../issues/batch-align` on the standalone web server (extension-only per D42/D54) and assert HTTP 404/405 with 0 GitHub writes.
No unrelated refactors, new dependencies, native form redesign or waived tests.
</scope>
<criteria>
Regression before fix for every required independent finding, then passing tests and local browser proof of actual built runtime. Reorder covers all-unmarked downward, mixed, equal, precision, stale and partial failures, second-client refresh; raw-body preservation includes CRLF/fenced marker samples. Move route cannot create or close saved issues. Offline response-loss-after-success cannot auto-duplicate; idea remains recoverable. Capture never launches agent. New screenshot set 360/390 phone +1280 desktop, clean page/console/network logs. Both typechecks/build/all isolated suites pass; do not weaken timing thresholds or safety assertions. Native no-JS POST and physical-phone/installed-host/real-GitHub limits remain explicit unless genuinely verified.
</criteria>
<signals>
Scope M; sensitivity HIGH (saved issues and offline capture); ambiguity bounded by approved UI and reviewer findings; reversibility local commits. This is correction round1 for web #48, not an unlimited feature expansion. Stop for a real product fork, security boundary, unknown external data mutation or inability to preserve issue bodies safely.
</signals>
<output>
Commit corrections locally in verified steps. Write detailed findings resolution, commands, counts, artifacts and limitations under .agents/run/issue-48-web-correction/verifications/proof.md. Return <=15 lines: status/candidate SHA, merge SHA/conflicts, findings closed/open, counts/exit codes, browser proof/screenshots path, UX measurements and blind spots, actual provider/model if known. L5 AWAITING HUMAN. No Done/deployed claim; independent recheck follows.
</output>
