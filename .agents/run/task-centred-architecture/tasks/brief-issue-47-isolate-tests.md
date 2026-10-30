<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin
Branch: fix/issue-47-fresh-app-stay-signed-in
Base/current product candidate: 4b3f4750bf20bf370bbdc4632a05714e8e3dd009
State: product committed clean as reported; previous review left untracked .agents/run/issue-47-session-hardening evidence which MUST be preserved. Previous builder and reviewer finished, no running writer here.
Owned files: web/tests/** ONLY for test-isolation repairs and durable evidence under .agents/run/issue-47-session-hardening/**. No application-code changes; no panel/tests outside web/tests. Current #48 web reviewer is read-only in a separate worktree.
Tests: targeted web/tests/hosting.test.mjs first after isolation repair, then node --test web/tests/*.test.mjs with explicitly isolated per-test store paths; npm run typecheck; npx tsc -p web/tsconfig.json.
Preflight facts authoritative at startup, no initial discovery git status/pwd/ls; targeted diff/mutation/failure checks allowed.
Do not read, stat, load, edit, prune or test against /workspace/.openchamber-data/** or any live sessions file, even to check if earlier runs affected it. No production access, credential printing, push, merge, deployment or GitHub closure. Do not run full web suite before fixing known default-path access.
</env_preflight>
<goal>
Make every #47 test run incapable of loading or changing real saved sign-ins, and preserve reproducible secret-free review evidence before integration.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-session-hardening-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin/.agents/run/issue-47-session-hardening/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<scope>
1. Fix finding E at hosting.test.mjs:186,210: every server constructed by tests must use an isolated temporary session file or an explicit in-memory test store. Do not use a production path. Use existing helpers where appropriate, unique per-test paths with cleanup after server close, no concurrent shared env mutation.
2. Audit ALL web test server/session constructors and child-server environment setup for the same leak. Config-only tests may assert path resolution without opening that path. Ensure option omission cannot accidentally load or prune default real sessions in tests. Correct test setup only; do not add application bypasses.
3. Add a behavioural regression using a private TEMPORARY default-store stand-in populated with sentinel data, then run the hosting constructor flow with its isolated store. Show sentinel unchanged and isolated store being used. No test may probe the actual production default to prove this. Test must discriminate previous buggy setup from repaired setup, not merely grep for env var text.
4. Preserve prior real-config/HTTP restart evidence: locate /tmp/antigravity/test_restart_behavior.mjs and test_http_restart.mjs from the review. If present, inspect for hardcoded secrets and unsafe paths, then retain secret-free reproducible source under your run-state evidence and run with synthetic private data. If missing, reproduce minimal real loadConfig + HTTP restart/logout/rotation harness and retain source/logs instead. No raw cookies, passwords, session tokens in recorded logs; redact before retention. Do not claim copied evidence was rerun unless it was.
5. Keep original proof.md historical facts intact, append corrected isolation result and commands, L5 AWAITING HUMAN. Record any previously unverified impact as UNKNOWN, never infer live data was safe or damaged without evidence.
</scope>
<criteria>
No runtime product change. The targeted hosting suite and full safe web suite pass with all new filesystem effects confined to generated private temporary locations; explicit behavioural proof old setup fails/new setup passes. Typechecks clean. No test weakening or deletion. Preserve file cleanup and no global env races.
</criteria>
<output>
Commit local test fixes and evidence. Return <=15 lines: status, commit SHA, changed files, old/new behavioural regression results, test counts and exit codes, durable evidence absolute path, any unsafe tests not corrected and any unverified live impact. Do not claim Done, deployment or human validation.
</output>
