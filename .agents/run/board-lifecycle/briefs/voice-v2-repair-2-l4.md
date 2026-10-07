<goal>Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/voice-v2-repair-2-fixes.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/oracle-audit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/disposable-fixture-contract.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<context>
Independent fresh reviewer for repair 2 commits f58e11b, 67f955f, d582374 (docs a5ddb77) on base 252225a in THIS worktree. Builder ses_e0f2d7ad18363e33a02e08a4 claims exactly three bounded fixes (integer form type, dead-V1-404 fall-through removal, partial multi-repo cache poisoning) with red/green proofs and 459 tests green. The prior review (l4-voice-v2-repair-1.md) verified 252225a's main repair and found these three residuals; your job is ONLY the delta 252225a..HEAD plus any collateral damage.
Contract oracle (from prior oracle-audit): V2 form types are exactly string, number, integer, boolean, multiselect, external. The builder reports `external` (display URL field) is still omitted from the answer whitelist — determine whether that omission is a residual defect or correct handling for a non-input field, and whether a form containing an external field can still be answered correctly for its input fields.
Legacy fallback semantics to enforce: V2 entity 404 (missing/expired form or permission) must surface as typed error with NO dead-route probing; legacy fallback is allowed ONLY when the V2 collection route itself 404s (pre-V2 host). Cache semantics: on any repo failure in All Projects getTasks, no incomplete aggregate may be cached as complete; healthy repos may serve per-repo cache; failed repos must retry next call.
Live host probes are read-only only (existing auth, values never echoed). Positive live form/permission reply proof remains NOT RUN and MUST NOT be attempted: the loopback host shares the live SQLite database and user session roster. Secrets never appear in any output.
</context>
<scope>
Read-only review of 252225a..HEAD in THIS worktree. No application edits, commits, merges, branch switches, stash/reset, push, PR, issue closure, DB writes, extension registration or service restarts. Only write sanitized review artifacts under /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-2-l4/ and report /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-2.md. Tests and read-only probes may run. Never create/prompt real host sessions, never reply to real forms/permissions, never mutate real GitHub issues. No delegation.
</scope>
<criteria>
Independent verdict per fix (integer type, 404 semantics, cache poisoning): PROCEED, PROCEED-WITH-CONDITIONS, or HALT. Findings need file:line, severity, expected vs actual, minimal repair. Confirm each claimed red proof actually fails at 252225a and each green test executes real production functions (not mock-only enactions) — run them yourself. Check collateral damage to the previously verified 9 repairs. Record exact commands/results and explicit NOT RUN paths. No release, closure or approval authority.
</criteria>
<steps>
<step>Verify branch and commit chain; run npm run verify, npm run build and the repair test file yourself; confirm service/main.js parity and zero panel/main.js churn. Re-run the three claimed red proofs against 252225a state (e.g. by inspecting the tests' base-reproduction logs or temporarily checking out the base state in a detached scratch comparison) to confirm they genuinely discriminate.</step>
<step>Fix 1 (integer): verify against @opencode/protocol form contract that integer answers parse and validate (accept 42, reject 42.5 and garbage) in BOTH normalize and reply paths, that multiselect/boolean/number handling is undisturbed, and decide the `external` field disposition precisely. Check QuestionInfo.type plumbing did not break older consumers.</step>
<step>Fix 2 (404 semantics): with tracking fetch, prove V2 entity 404 in replyQuestion/replyPermission throws typed NOT_FOUND with zero legacy-route requests, while true pre-V2 hosts (collection route 404) still fall back. Check the v2FormCollectionSupported/v2PermissionCollectionSupported tracking cannot misclassify a transient 404/5xx as 'unsupported host', and that auth errors still surface.</step>
<step>Fix 3 (cache poisoning): repo B failure + repo A success must not cache an incomplete aggregate; next call retries B and serves A from per-repo cache with zero network. Check generation protection on new per-repo list cache keys, key scope (repo/status/label) correctness, and that a later successful B fetch plus scope switch cannot serve stale data. Confirm the earlier cache-generation/in-flight coalescing repairs are not broken by the new per-repo keys.</step>
<step>Collateral sweep: run the full suite, re-verify the previously confirmed behaviors (cursor pagination incl. cyclic guard, archived mapping, terminal-null empty lists, Issue #17 collision open+closed, direct session lookup) still hold via existing tests. Record NOT RUN gaps. Stop after read-only review.</step>
</steps>
<output>
Write report with per-fix verdicts, findings file:line/severity/expected vs actual/minimal repair, red/green reproduction results, evidence commands/exits, NOT RUN gaps and numbered minimal repairs. Return status, results, evidence, learnings, report path and commits reviewed. Nothing is human-approved or released. Never include credentials.
</output>
