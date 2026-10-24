<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board at 2151ce2 (review report committed). Product HEAD a795985; worktree was clean at dispatch except the review commit.
Owned: web/** board implementation and tests, web/README.md, root README board section if present, .agents/run/task-centred-architecture/ report/proof in this worktree. Nothing else.
Tests: node --test web/tests/*.test.mjs; npm test; npx tsc -p web/tsconfig.json; build; node web/tests/browser-verify.mjs. Existing root node_modules symlink; no installs.
Do not touch panel/**, service/**, shared skills/config, credentials, opencode.db, host settings, DNS/TLS, production, master, other worktrees. No push, merge, issue edits, deployment or live credentials. Synthetic GitHub only.
Preflight authoritative; skip startup discovery. Targeted checks allowed for stale resume or commit verification.
</env_preflight>
<goal>
Close exactly the findings accepted in the manager ruling, each with a real regression, without widening scope.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-rereview.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-33-rereview-ruling.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Test-first for each item; reproduce the reviewer's probe, then fix. Do not weaken or delete existing tests; if an existing test asserts wrong behavior (e.g. FIFO), change the assertion only with a comment citing the ruling.
R1 Unknown-outcome truth: wrap the whole upstream response read (headers plus body) as one ambiguous outcome. A committed write whose body read fails returns a distinct unknown status/message; the page says outcome unknown and offers a read-only refresh, never an automatic retry. Classify browser-side write transport/protocol failure as unknown too, wording distinct from a server rejection. Add a real local-HTTP truncated-response test and a browser probe.
R2 Bounded login occupancy: cap concurrent password verifications including queued work; requests waiting must receive a clear bounded 429 with retry guidance, not queue without limit; per-address in-flight slot must have a short deadline and always release on error/abort/timeout; no accumulating or permanent lockout; authenticated routes unaffected. Tests: slow-body occupancy released within the deadline; many distinct addresses are bounded; correct sign-in works after a completed/aborted attempt; authenticated requests stay 200.
R3 Remove blanket forwarded-header trust: default off and do not recommend enabling it in README for this slice. If the implementation keeps an opt-in, it must be peer-bound to a configured trusted proxy and document that it is untrusted otherwise; simplest acceptable fix is deletion of the feature. Achieve the same truthful rate-limit wording without claiming per-client accuracy behind a proxy. Keep existing authenticated sessions working.
R4 Closing fence must contain only the same marker and optional whitespace; otherwise the block stays open. Regression with the reviewer's exact case.
R5 Make the hash tool run on Node 22 (no TypeScript syntax in .mjs), and change README to a non-history-recording input (hidden prompt or reading from a file with restrictive permissions); test the documented command's exit. Keep stdin support. Do not print secrets in logs/tests.
R6 Either implement true LRU or correct docs/tests to FIFO; keep the capacity cap. Choose the smaller honest change and say which.
R7 Canonicalize comparison on readback so a correct CRLF write is success, while a real concurrent change is still detected as a conflict; add end-to-end CRLF readback regression.
R8 Validate the pagination collection path against the configured repository (not just origin) or explicitly document the trusted-upstream assumption in README; add the host-side test with a synthetic Link naming another repo. Choose validate-both as recommended.
Not in scope: BOARD_HOST bind, /health, deployment, push notifications, PWA, new auth model, OAuth, #31 question identity.
</scope>
<criteria>
Each finding has a failing-before/passing-after regression or a documented reason it cannot be reproduced. No automatic write retry. No claim of atomicity, DoS immunity, LRU, or per-client IP accuracy unless true. Full suite, tsc, and browser checks green; bundle sha256 recorded and matches a fresh build. Reports restate F1–F10 statuses truthfully.
</criteria>
<output>
Commit on feat/issue-33-standalone-board. Update the remediation report with a per-finding table keyed to this brief and the ruling. Return at most 15 lines: commit, per-finding status R1–R8, red/green evidence paths, test counts, bundle sha256, diff scope confirmation, what remains unverified, actual provider/model. One bounded hostile re-review follows; no merge.
</output>
