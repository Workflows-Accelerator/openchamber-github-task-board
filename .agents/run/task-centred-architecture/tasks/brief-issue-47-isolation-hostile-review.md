<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin
Branch: fix/issue-47-fresh-app-stay-signed-in
Reviewed product base: 4b3f4750bf20bf370bbdc4632a05714e8e3dd009
Candidate: 268bd28738443863d6a58b5e4500ad20b6aaa05f
State: builder finished, local commit contains test-only fixes plus evidence; no active writer in this worktree. Preserve prior evidence.
Files: web/tests/app.test.mjs, helpers.mjs, hosting.test.mjs and .agents/run/issue-47-session-hardening/**. Read all web tests that construct servers/SessionStore/child processes to audit isolation.
Preflight facts authoritative; do not start with git status/pwd/ls. Targeted mutation/diff/failure checks allowed.
Tests: inspect isolation first; only then node --test web/tests/hosting.test.mjs and node --test web/tests/*.test.mjs, with all file paths proven private temporary paths; npm run typecheck; npx tsc -p web/tsconfig.json.
Do NOT access, stat, load, edit or probe /workspace/.openchamber-data/**, live files, real secrets, live server or release directory. Do not change application or test code, merge, push, deploy or close issues. Evidence-only writes in .agents/run/issue-47-isolation-review/**.
</env_preflight>
<goal>
Independently prove that test runs cannot load or prune real sign-ins and that preserved restart evidence remains reproducible and secret-free.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/brief-issue-47-isolate-tests.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-47-session-hardening-review-gate.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-47-fresh-app-signin/.agents/run/issue-47-session-hardening/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent of the repair builder; test-only changes still require review. Challenge the actual setup rather than merely running its tests.
</review_prompt>
<scope>
1. Compare 4b3f475..268bd28. Ensure no product/auth/config change or test weakening. Every runtime test fixture and child process constructing a BoardServer/SessionStore must specify private temporary session storage, including restarts, error paths, helper overrides and cleanup. Inspect actual call paths, not just grep for env var text.
2. Validate regression discrimination: old path must alter ONLY a temp stand-in, repaired HOSTING setup path must leave sentinel byte-identical and use its private store. Reject a tautological test that demonstrates two hand-written setups without exercising the actual hosting helper/constructor flow under review. No global env mutation races across concurrent tests.
3. Session file cleanup occurs after server/process shutdown; no shared path conflicts. Audit rename storage introduced on #48 only as a future integration warning, not in this branch. Do not allow safe defaults here to mask unsafe caller overrides elsewhere in web tests.
4. Inspect retained harnesses and logs for absolute stale worktree paths, raw tokens/cookies/passwords, generated fixture secrets, unsafe defaults or references to missing /tmp/antigravity files. Re-run the retained real-config and HTTP-restart harnesses only if safe and properly isolated; retain clean outputs. Test credentials must be generated or innocuous synthetic fixtures, never actual production values or printed usable test secrets.
5. Confirm prior behaviour (sign-in restart/password change/logout/CSRF) remains green and no new test store points to real default. Any unsafe suite = do not run full glob; report remaining defect with exact source/call path. Multi-process, installed PWA and physical autofill stay NOT RUN.
</scope>
<criteria>
Two verdicts: Spec Compliance PASS/PARTIAL/FAIL and Quality APPROVED/NEEDS-FIXES. Release-blocking E closed only with meaningful old-vs-new behavioural proof and all runtime paths isolated. Report new defects together for one bounded correction if needed, not speculative enhancements.
</criteria>
<output>
Write independent detailed proof/logs to .agents/run/issue-47-isolation-review/verifications/proof.md in this worktree. Return at most15lines: verdicts, E CLOSED/OPEN, findings/severity/file:line, exact test counts/exit codes, evidence path, actual provider/model if available, unverified live impact UNKNOWN. L5 AWAITING HUMAN. No Done or deployment claim.
</output>
