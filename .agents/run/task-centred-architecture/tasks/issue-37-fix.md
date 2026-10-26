<env_preflight>
Fix round after independent hostile review ses_6b54491a2faa88e53630488e (9router/genius, HALT). Candidate is 5b231ff; reviewer proof commit 8a958fe added only review artifacts. Product source at 5b231ff unchanged.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo
Branch feat/issue-37-multi-repo; base752407a. Tracked-clean. node_modules symlink exists; no installs, no env copy.
Scope files: web/server/{repositories,app,board,github}.ts as needed, web/public/app.js, web/tests/**, web/README.md. No panel/**, service/**, root tests, shared skills/config, dependencies.
Do not modify review evidence: .agents/run/task-centred-architecture/outputs/issue-37-hostile.md and verifications/issue-37-review/** stay byte-identical; verifications/issue-37-build/** untouched.
Tests: node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; npm run typecheck; esbuild bundle to web/dist (gitignored, never force-add) and report its hash and source/bundle parity.
No real GitHub writes, credentials, installed extension, push, merge, closure, deployment or other worktrees. Scratch /tmp/opencode.
Preflight authoritative at dispatch; targeted checks before commits.
</env_preflight>
<goal>
Close F1, F2 and F3 from the independent review and the high-value part of F4 with the smallest correct change, each proven by a regression that fails when the guard is broken.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/.agents/run/task-centred-architecture/outputs/issue-37-hostile.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-37-multi-repository.md]
</context_files>
<scope>
1. F1 — stale allowlist during refresh (web/server/repositories.ts around 43-62). The cached snapshot is returned before `inFlight` is consulted, and the refresh marks `attemptedAt` first, so a revoked repository stays authorisable for the duration of a refresh. Make authorisation await completion of any in-flight discovery refresh before it decides availability, or equivalently expose a resolved snapshot that cannot be stale. Required regression: during a gated refresh that will revoke access, a write to the old repository must be refused before any upstream call — assert zero target calls and zero upstream requests for that repository, and assert the response is a definitive refusal (503/400 class), not a dispatch. Also assert that a repository present in both old and refreshed results still works.
2. F2 — cross-repository UI race (web/public/app.js). A write belonging to the previously selected repository cancels the board-load generation for the newly selected one, leaving `selected=beta`, `boardRepo=alpha`, refresh disabled, and beta's data discarded. Make generation ownership repository-qualified: a write may only cancel or republish loads for the repository it was issued against, and selecting a repository must not leave a board showing another repository's name. Required regression: gated GET for beta plus a slow write on alpha; assert after resolution that the rendered board's repository equals the selected repository and refresh is enabled, or that the stale response is discarded without leaving mismatched labels.
3. F3 — false UNKNOWN. `app.ts:364` returns 503 `discovery_unavailable` before dispatch, but the client maps every >=500 to `write_outcome_unknown`. Distinguish a pre-dispatch refusal from an ambiguous outcome: when the server states no operation was dispatched, the client must show a definitive refusal with retry guidance and must not add the item to the uncertain set. Required regression: same request with zero upstream calls, assert no uncertain marker and a definite message. Keep the existing rule that a genuinely ambiguous outcome stays UNKNOWN and is never auto-repeated.
4. F4 — bounded aggregate and honest truncation, minimal part only: add a total cap on the combined issue count with an explicit truncated marker (existing per-repository cap may stay), ensure a page of only duplicates also reports truncation, and stop emitting the literal "for null" (and equivalent empty-value text) in startup/log messages. Do not redesign the choice digest or the unavailable-history store; record those as accepted low risks in the report and README instead.
5. F5 disclosure: update web/README.md with the real limits now in force (aggregate cap, restart-loses-unavailable-history, synthetic-only proof, no hidden-private enumeration), without changing behaviour.
6. Test discipline: for each of F1-F3, run the new regression against 5b231ff (or a scratch copy of the old source) to show it fails for the intended reason, then against the fix to show it passes. Add at least one mutation per fix: (a) restore early cached return in repositories.ts — F1 regression must fail; (b) let the write publish cross-repository — F2 regression must fail; (c) map 503 back to unknown — F3 regression must fail. Report exact commands, exits and the failing assertion.
7. Keep the change surgical. No new abstraction, no rework of the accepted #33 boundaries, no behavioural change to authentication, CSRF, origin, redirect, conflict detection, UNKNOWN-never-repeat, or answer binding. If a fix genuinely requires touching shared machinery, explain why the smaller local change is wrong.
</scope>
<criteria>
F1-F3 closed with discriminating regressions and mutations; F1 proves zero upstream calls on the stale path; F2 proves the board never labels itself with a different repository than the selection; F3 proves no uncertain marker without a dispatched write. F4 minimal part and README disclosure done. Web tests, root tests, both typechecks and bundle/parity green; bundle hash reported; no change to review evidence. No self-approval.
</criteria>
<output>
At most 12 lines: fix per finding, regression and mutation evidence with commands/exits, test totals, bundle hash and parity, what remains open and labelled low, blind spots, actual provider/model. Independent recheck follows; no merge/deploy/close.
</output>
