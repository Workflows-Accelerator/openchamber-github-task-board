<env_preflight>
BLOCKED DRAFT — fill candidate commit, dirty/clean state, builder report and active-worker facts after recovery builder ses_f456ddf0ac270174a79ccf0a finishes. No review dispatch while builder runs.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo
Branch feat/issue-37-multi-repo; base752407a, candidate FILL_AT_DISPATCH. Product/test diff from752407a read-only. Own only .agents/run/task-centred-architecture/outputs/issue-37-hostile.md and verifications/issue-37-review/**. Preserve original build/recovery evidence immutable. Scratch /tmp/opencode.
Dependencies linked. No installs/env copy. Commands node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npm run typecheck; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs. Never force-add web/dist. Build/probe/mutant in scratch if necessary, no source changes.
Do not touch panel/service/root tests/shared skills/config, credentials, real GitHub writes, other worktrees, hosting or infrastructure. No product fixes/merge/push/master/deploy/issue closure. Another ops worker may inspect production, do NOT interact with it or production.
Facts authoritative at dispatch; no broad initial status/pwd/ls. Targeted inspection needed for diff/commit evidence and after failures.
</env_preflight>
<goal>
Independently decide whether multi-repository support satisfies every approved contract without weakening accepted board safety.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-37-multi-repository.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-37-build-recovery.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
Builder report FILL_AT_DISPATCH. Do not trust summary counts or unused names as evidence.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not implement; FIX NOTHING. Read complete product and tests diff, source-to-consumer mechanism map before tests. No self-approval from builder.
1. Discovery reality: all repositories configured token can see, correct pagination, API identity and exact origins, finite bound and honest disclosure of caps/timeouts/rate limits. Later-page failure/malformed data must not be silently complete; duplicate/empty/list entry validation based on consumed fields. Archived marked, empty selectable. Previously known lost-access repository unavailable never empty or fabricated task data. No claim hidden private repos can be enumerated.
2. Authorization: every repository-qualified read AND write resolves through current validated discovery set server-side. Probe unknown repo, stale/revoked repo, case-variant, encoded path/query separators, contradictory repo+numeric id, config default fallback and cache reuse. Rejected request makes zero upstream target request and token never goes to client-chosen host. Allowlist refresh failure must fail safely without accidentally clearing true UI context or granting stale authority silently. Detail/answer/status routes all covered, not only list route.
3. Identity: same number A#5/B#5 across combined/current views, details, action-in-flight, cache publication, draft saving/restoring, selected repository persistence, pending navigation. Start A answer/section/status request then switch B same number, settle in both orders. A action never PATCHes B; failures do not overwrite B drafts/detail. One-sided A mutation must not protect or poison fresh B state. Mutant required: committed regression must fail number-only identity and allowlist-bypass fixtures. No assertions deleted or weakened to support new endpoint syntax.
4. UI honesty: last choice remembered, combined rows label repo, archived/empty/unavailable render correctly, 360px and desktop usable with keyboard/focus and no overflowing repository names. Partial repository failures visible with per-repo accuracy; failed discovery not empty picker; old partial cache never returns complete-looking rows. Bounded concurrency empirically measure max simultaneous calls, not merely inspect constant. Refresh during write cannot erase confirmed data or re-enable unknown dependent writes; preserve accepted #33 exact-question and revision behavior.
5. Security base: password/session/CSRF/auth origin and redirect refusal unchanged, no secrets/browser-storage or query credential leaks, fixed GitHub origin, no arbitrary override. #33 saved201browser/165HTTP or equivalent source matrices must actually exercise the new routes with adapted harness assertions, not accidentally404 and pass only status counts. UNKNOWN-never-repeat, detail shape validation, recognisable GitHub422 and mixed-indentation code exclusion preserved, exactly1PATCH for uncertain save (no hidden retry). No agent controls/PWA/notifications/new auth/hosting changes.
6. Independent runtime: rerun named full/type/build gates; confirm new committed regressions fail old tree for correct reasons; inspect DOM/screenshots plus console and server logs, not just generated artifact existence. Record exact adaptation from old harness and all missing proof. Browser synthetic upstream is not live GitHub or mobile device proof. No required test skip/count masking.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, machine PROCEED/HALT. Every required failure has path:line, event ordering, concrete observed outcome, minimal correction, introduced versus preexisting where empirical. Report closed/open matrix against original scope, tests/counts/exits, saved-matrix coverage, mutation proof, UI evidence inspected, no product edit. Independent verdict must not infer live production permissions, restart, or L5 from mocks.
</criteria>
<output>
At most12lines verdicts, ranked findings, scope closure, independent totals/exits and old-vs-new/mutant evidence, bundle parity/hash and screenshot/log observations, report/proof commit, blind spots, actual provider/model. No fixes/integration/deploy/closure; stop for manager judgement.
</output>
