<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board. Product HEAD f50519d, clean at dispatch. Prior hostile review 2151ce2; product remediation f50519d. No active builder. Restart duplicate workers all finished; e88126a is an unreachable duplicate commit; git diff e88126a f50519d is REPORT ONLY (6 lines). Review actual 2151ce2..f50519d tree, not individual claims.
Files: web/server/**, web/public/app.js, web/tests/**, web/tools/hash-password.mjs, web/README.md. Root node_modules symlink, no environment copy.
Tests: node --test web/tests/*.test.mjs; npm test; npm run build:web; npx tsc -p web/tsconfig.json; node web/tests/browser-verify.mjs. Disposable probes /tmp/opencode.
Only owned writes: .agents/run/task-centred-architecture/outputs/issue-33-final-hostile.md and .agents/run/task-centred-architecture/verifications/issue-33-final/**. Product/tests are read-only. No real GitHub writes, credential files, installed extension, other worktrees, master, push, merge, closure or deployment. Do not inspect private deployment or voice reports.
Preflight facts authoritative at startup; do not repeat git status/pwd/ls discovery. Targeted mutation/commit checks allowed.
</env_preflight>
<goal>
Give one final independent hostile security/correctness verdict on the R1-R8 remediation and the actual post-collision tree.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-33-rereview-ruling.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-rereview.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-remediation.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not write this. Fix nothing. Rerun prior probes independently; review entire remediation diff and runtime behavior for interleaved/half edits from duplicate builders. All builder claims including "nothing relevant unverified" are untrusted. Report production GitHub permissions/TLS and real keyboard focus as NOT RUN unless actually proven.
R1: truncated/parse/timeout/gateway/post-send errors UNKNOWN, no repeat. Only definitive pre-commit rejection may say failed. Do NOT adopt prior review's all 4xx/5xx rejection framing.
R2: login occupancy and queue bounded, slow unfinished request eventually frees capacity; no permanent lockout, existing sessions usable under flood.
R3: no forwarded-header trust from arbitrary peers; no BOARD_TRUST_PROXY bypass or misleading instructions.
R4: correct fence closer grammar. R5: hash tool actually executable on Node22 and documented password input does not put secrets in argv/history. R6: true LRU matches docs. R7: CRLF readback. R8: pagination path stays in repository, redirects/untrusted paths cannot receive token.
Maintain owner-accepted design: independent board password, server-only token, best-effort conflict warning; exact-text answers refuse stale/ambiguous questions; attention separate from phase; only human Done. Single repo is secure base; multi-repo #37 later. No deployment/bind fix/notification work in review. Recheck token/auth leakage, session/CSRF/origin boundaries and no automatic mutation retries.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES; Spec PASS/PARTIAL/FAIL; Quality APPROVED/NEEDS-FIXES. Per R1-R8 table with actual probes and outcomes, ranked new findings with file:line, concrete input, observed result and minimal correction. Full web tests, root suite, types, bundle parity and browser tests reproduced. Inspect screenshots/logs, not only test counts. Any new High triggers HALT; this is bounded, not a new fix loop.
</criteria>
<output>
Commit only report/proof. Return <=12 lines: verdicts; R1-R8 summary; any new ranked findings; counts; bundle sha256; report commit; blind spots; actual provider/model. No merge or issue closure.
</output>
