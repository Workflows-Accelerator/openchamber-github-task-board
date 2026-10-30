<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views
Branch: feat/issue-48-web-simple-views
Base: af9b39c1753db0ca3f6a4314f1942bf66accb62f
Candidate: e630a9ddd044389787a66f458b1ee49c944db250 (preceding product commits 42de557 and cc9ce34).
State: builder reports clean and all changes committed. No other writer in this worktree. Extension builder is still running in a separate worktree; do not edit panel or tests.
Files to review: web/public/app.js, index.html, theme.css; web/server/app.ts, board.ts, github.ts; web/tests/simple-views*.mjs, multi-repo-client.test.mjs, fake-github.mjs, issue-48-browser-verify.mjs.
Preflight facts authoritative at startup; no initial pwd/ls/status discovery. Targeted diff/commit checks, failure diagnosis and stale-state checks allowed.
READ ONLY application and tests. You may create evidence only under this worktree's .agents/run/issue-48-web-hostile/**. Do not push, merge, close issues, deploy, access live services/data/credentials, or run the full web test glob yet: hosting.test.mjs is known to load/prune the real default session file. Even test-only credentials must never be printed. Default session path /workspace/.openchamber-data/** is out of bounds.
Safe commands: npm run typecheck; npx tsc -p web/tsconfig.json; targeted web test files only after confirming their server setups use isolated temporary session files; node web/tests/issue-48-browser-verify.mjs only if session and rename storage are both isolated. Build local bundle if needed. All HTTP/browser work on localhost with fake GitHub and temporary data paths.
</env_preflight>
<goal>
Conduct an independent hostile review of #48 web/mobile changes and identify every remaining blocker to the user's approved simple task-management experience.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-48-web-simple-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/amendment-issue-48-web-preserve-sessions-and-issues.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/simplification-review-requirements.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-session-hardening-review-gate.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent of the builder. Do not accept their self-review or green tests as proof of correct user behaviour.
</review_prompt>
<scope>
1. Must flag unapproved existing-issue move implementation (target create + source comment + close). User approved a project picker, not automatic closure/recreation. Locate all client/server paths, impact and tests. Smallest safe correction: allow assignment before creation, remove existing saved-issue destructive move path unless an already-supported history-preserving transfer plus explicit human confirmation exists. Do not waive human-only Done/closure.
2. Draft manual order: reproduce downward moves among ALL UNMARKED, mixed marked/unmarked, equal markers and many repeated midpoint operations. Builder says ordered-first contract cannot represent some downward moves via a single marker. Provide actual examples and the smallest engineering options preserving simple free reorder; explicit refusal does NOT fulfil user acceptance. Distinguish our overly restrictive engineering contract from user's actual requirement (easy cross-device order).
3. Offline safety: description/order survive queue/reload/reconnect; ambiguous POST outcomes must not automatically resend into duplicates. Reproduce response-loss-after-success and partial reconnection. No auto-sync claims without uncertain-write handling. Refresh and same-number cross-repo edits must never affect wrong task. CSRF, authorization, repository allowlist and stale conflict checks on every new mutation.
4. Shared view/filter/sort semantics, defaults, Pending items (existing Human Tasks feel and actions), human tasks/questions remain answerable, graph shows real declared dependencies. Review within 360/390px phone sizes and desktop. Draft add row must be easily reached; no page overflow, hidden project choices or minuscule targets. Inspect screenshots yourself and rerun browser with isolated data. Check changes while unsaved drawer/inline edits exist, empty/error/partial refresh states and keyboard/focus.
5. Renames persisted without path traversal/prototype pollution, XSS or lost concurrent updates; every server/test path isolates its rename/session data. Short names match shared contract. Hidden markers never display, body writes preserve raw Markdown outside target section (including fences, CRLF, multiple headings, duplicate comments).
6. Protected #47 changes are at af9b39c, not latest4b3f475; identify app.ts integration touchpoints but DO NOT merge. Root test rerun by builder had CPU flake, disclose; do not weaken tests.
7. Evidence integrity: compare builder coverage vs runtime outcomes. Report physical touch/screen reader/live GitHub not verified. Never use production data to test an isolation bug.
</scope>
<criteria>
Separate Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES. Known reorder gap means not full PASS until corrected. Every finding severity + file:line + reproducible example/command + smallest fix. No app changes during this review. Group related findings to enable one bounded correction, not endless loops.
</criteria>
<output>
Write detailed proof, commands/exit codes, screenshot inspections, defect reproductions, raw sanitized logs and recommended corrections to .agents/run/issue-48-web-hostile/verifications/proof.md in your worktree. L5 AWAITING HUMAN. Return at most 18 lines with two verdicts, findings ranked by impact, executed counts, report absolute path, known blind spots and actual provider/model if available (do not guess).
</output>
