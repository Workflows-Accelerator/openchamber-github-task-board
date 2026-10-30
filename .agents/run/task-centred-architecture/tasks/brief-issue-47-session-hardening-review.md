<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin
Branch: fix/issue-47-fresh-app-stay-signed-in
Base commit: cc083796c4bf62b57aaa76e2908f8b5cd47347dd
Previous reviewed candidate: af9b39c1753db0ca3f6a4314f1942bf66accb62f
Current candidate: 4b3f4750bf20bf370bbdc4632a05714e8e3dd009
State: committed and clean as reported by builder; dependencies already installed/symlinked.
Key files: web/server/auth.ts, web/server/config.ts, web/server/app.ts, web/tests/auth.test.mjs, web/tests/config.test.mjs, web/tests/app.test.mjs, web/public/sw.js.
Tests: npm run typecheck; npx tsc -p web/tsconfig.json; node --test web/tests/*.test.mjs; node --test --test-concurrency=1 test/*.test.js.
Preflight facts are authoritative at startup: do not run initial git status, pwd, or ls discovery. Targeted checks are permitted for action failures, mutation checks, or stale state after compaction.
Do not touch application code, live services, real session files, credentials, /workspace/.openchamber-data/**, /workspace/config/**, /workspace/releases/**, or panel/**. Do not push, merge, deploy, or close issues. Use temporary synthetic credentials and private temporary session files for tests; never print any credentials or tokens.
</env_preflight>
<goal>
Independently challenge the session-hardening changes for #47 and prove whether the 30-day sign-in promise and security boundaries actually hold.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-47-fresh-app-signin.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-47-l4-fixes.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/verifications/issue-47-l4.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are an independent reviewer, not the builder; apply this prompt to the supplied diff and reject the builder's self-grading.
</review_prompt>
<scope>
Read the full #47 diff for context, with special focus on af9b39c..4b3f475:
1. Critical regression challenge: the fix added a deterministic password salt in config.ts because random password hashing could make unchanged passwords invalidate sessions after restart. Prove TWO independently constructed real loadConfig calls with identical BOARD_PASSWORD and session secret produce stable session validation across process restarts; changing password or secret invalidates old sessions. Exercise BOARD_PASSWORD_HASH as well. Do not rely only on mocked SessionStore constructor inputs.
2. Validate deterministic salt strength and password fingerprint logic. No raw password, raw session ID, usable cookie, or CSRF token on disk; comparisons timing-safe where needed; CSRF remains session-bound and cannot be computed using only file contents. Check configuration/environment variants and any weakening of existing authentication.
3. CSRF derivation across restarts: valid signed cookie survives unchanged configuration and obtains a working CSRF token; cross-session token replay and missing tokens rejected; logout deletion persists and cannot resurrect after restart. Old-format entries are safely discarded without a crash. State explicitly any unavoidable one-time sign-in.
4. Persistence failures, malformed files, short writes, temporary-file handling, permissions, concurrency, lastSeen throttling, expired-entry cleanup and bounded storage. Verify real server behaviour with isolated files where practical; never use the live data path.
5. Ensure service-worker/cache fixes still work and no test isolation causes sessions to leak between tests or into the default live data path.
6. Record known finding A: native form POST without JavaScript returns invalid_json; do not fix it in this read-only task. Finding D: missing public-dir fallback must remain explicit, not called verified.
</scope>
<criteria>
Two separate verdicts: Spec Compliance PASS/FAIL and Quality APPROVED/NEEDS-FIXES. No APPROVED based on unit-only self-written mocks if restart behaviour has not been exercised. Findings must have empirical reproduction or exact source evidence, severity, file:line, and recommended smallest fix. Missing evidence is NOT RUN, not PASS.
</criteria>
<output>
Write detailed reproducible evidence to your worktree's .agents/run/issue-47-session-hardening/verifications/proof.md (commands, exit codes, artifacts, findings; L5 AWAITING HUMAN). Application files stay unchanged. Return at most 18 lines: verdicts, finding summary, real-config restart result, test counts, report absolute path, unverified behaviour. Include actual provider/model metadata only if available from your runtime; do not guess.
</output>
