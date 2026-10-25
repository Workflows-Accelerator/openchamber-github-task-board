<env_preflight>
Ready: worktree created from review branch after #34 merge; clean at dispatch. No other worker owns panel/**.
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-35-write-refresh
Branch: fix/issue-35-write-refresh. Base: 12cb9c6 (feat/v2-binding-and-ratelimit including merged #28, #36, #34). node_modules symlink to root already present. Clean at dispatch. Expected baseline: full suite 517 passing.
Key files: panel/main.ts admission helpers trackIssueWrite/admitIssueRecord/protectedIssueGroups; single-repo and All Projects fetch publication paths; create/archive/tag/priority/status-none/complexity handlers; test/issue-28* and test/test-app-harness.js. Generated panel/main.js.
Tests: node --test test/issue-35-write-refresh.test.js; npm test; npm run typecheck; npm run build. Root dependencies via existing symlink, no installs, no env copy or DB registration.
Do not touch web/** (the #33 correction is running there in another worktree), service/**, shared skills/config, private reports, credentials, installed extension, real GitHub, master, other worktrees. No push/merge/closure/deployment. Synthetic fixtures only. Preflight authoritative at startup; targeted mutation checks allowed.
</env_preflight>
<goal>
Every offered panel write stays visible when an older refresh completes, in one repository and All Projects.
</goal>
<context_files>
GitHub issue is authoritative: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/35 (read with gh issue view, do not write/close it).
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-28-fix-adjudication.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-28-hostile-review-8625b0a.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-34-review-gate.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own panel/main.ts only for local snapshot admission, listed write handlers and aggregate publication; panel/main.js rebuilt; focused regression tests/harness minimal changes; .agents/run/task-centred-architecture/outputs/issue-35-fix.md and verifications/issue-35/**.
First inventory ALL local GitHub mutations and corresponding refresh publication paths. No second parallel admission system; reuse #28 helpers. Prove three known defects red before patch:
1. Successfully created issue is dropped when pre-create full refresh publishes (both creation paths).
2. Archive, tag add/remove, priority, status-none and complexity label mutations get regressed by pre-edit snapshots.
3. All Projects aggregate refresh overwrites a successful local write.
Test deterministic interleavings with explicit deferred barriers, not timing sleeps. Use repository-qualified identity: same issue number in two repos must never share protection. Include pending, success, rejection, refresh failure, repo switch and unconfirmed #34 outcomes as boundaries. No automatic retry/overwrite claims.
Preserve #28 freshness/cursor safeguards, #34 UNKNOWN/unconfirmed rules, #36 human-only Done guard. No new behavior for remote concurrent edits; local admission is not atomic GitHub conflict prevention. Unknown write result never shown as definite success/failure. Scope is stale refresh protection, not a wholesale mutation rewrite.
</scope>
<criteria>
Every known path has failing-before/passing-after evidence. Completion of an old snapshot never removes a locally created issue or regresses confirmed write fields; other fields/repositories remain fresh. Track settlement even on exceptions. New full/partial aggregate snapshots retain same invariant; unavailable repo not silently empty. All tests/typecheck/build green and generated bundle fresh. No direct Done/close route added.
</criteria>
<output>
Commit fix/tests/proof on the feature branch, not integration. Report mutation inventory and coverage table, exact red/green commands/exit codes and evidence paths, test counts, bundle hash, blind spots, actual provider/model. Return <=12 lines. Independent hostile review follows; do not self-authorize acceptance.
</output>
