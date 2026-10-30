<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views
Branch: feat/issue-48-web-simple-views
Candidate: d5a205da26827d0555824339fcb14c9a39d7af7f (commits 258e26f, 436c03e, 566b138, 22da7f4, d28caef, e576083, d5a205d on top of e630a9ddd044389787a66f458b1ee49c944db250 and merged #47 268bd28738443863d6a58b5e4500ad20b6aaa05f).
Prior candidate: e630a9ddd044389787a66f458b1ee49c944db250; merged #47 base: 268bd28738443863d6a58b5e4500ad20b6aaa05f.
Review paths: web/**, generated web server bundle (scratch build only). App and test files READ ONLY. Write evidence only under this worktree's .agents/run/issue-48-web-recheck/**. Preserve .agents/run/issue-48-web-hostile/** and .agents/run/issue-48-web-correction/** untouched.
Tests: verify F9 isolation in diff FIRST before running full web test glob; then npm run typecheck; npx tsc -p web/tsconfig.json; node --test web/tests/*.test.mjs; node --test --test-concurrency=1 test/*.test.js; browser harnesses against fake GitHub and private temporary stores.
Do not access live board, real GitHub, /workspace/.openchamber-data/**, /workspace/config/**, /workspace/releases/** or saved credentials. No push, merge, deployment or issue closure. Zero secret values in logs, argv or reports.
Preflight facts authoritative once candidate SHA is populated at dispatch; skip initial pwd/ls/status spin.
</env_preflight>
<goal>
Independently verify whether web correction round 1 resolves all ten hostile review findings (F1–F10), cleanly integrates #47 session/test-isolation hardening, and meets the aligned simplified-board contract without regressions.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-web-hostile-review-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/amendment-issue-48-confirmed-transfer.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-hostile/verifications/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-correction/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are an independent reviewer, not the correction builder. Distrust self-reports and re-test every finding empirically.
</review_prompt>
<scope>
1. Verify F9 + #47 merge first: confirm 268bd28 ancestry, SessionStore receives passwordHash: config.passwordHash alongside namesPath, and every test fixture uses a unique temporary directory isolating both sessions.json and project-names.json (including hosting.test.mjs). Verify stand-in default store stays untouched, then run full web/tests/*.test.mjs and retained #47 restart/rotation/CSRF checks.
2. Re-run adversarial probes for F1–F8 and F10 against the corrected build:
- F1 (D55 confirmed transfer): cancel=0 writes; confirm invokes GraphQL transferIssue (never create+comment+close); canonical repo/number/URL returned and source/target caches updated without clobbering same-number issues; permission error keeps source intact; unknown outcome blocks blind retry and reconciles.
- F2 (offline queue): lost response after commit enters uncertain state and does NOT duplicate on reload/reconnect; in-flight edits preserve newer revision; duplicate titles keep distinct entries; cold offline reload under SW shows local draft queue cleanly without faking auth.
- F3 (marker byte safety): fenced `<!-- board-order: 42 -->`, CRLF line endings, and trailing Markdown hard-break spaces survive parse/strip/set and section edits untouched.
- F4 (qualified identity & buffers): beta#1 Mark Done never closes alpha#1 in UI; delayed Alpha response never overwrites active Beta drawer; checkbox/reorder preserves unsaved text buffers; refresh does not silently rebind stale buffer fingerprint; `- [ ]` renders unchecked in real DOM (`el.checked === false`).
- F5 (free manual order): downward moves across all-unmarked, mixed, and equal-marker drafts succeed; 54+ midpoint moves rebalance cleanly instead of 409; stale neighbour fingerprints are caught and partial multi-issue failures reconcile honestly.
- F6 (Pending items): `### Human Tasks:` items have working completion checkboxes (conflict-safe body update, never closing the issue) plus a GitHub issue link, alongside working Open Questions answers.
- F7 (dependencies): `- [ ] Blocked by #2` parses `[2]`; fenced `Depends on #2` parses `[]`.
- F8 (phone UX & a11y): 360px multiline draft descriptions do not clip (`scrollHeight <= clientHeight + 2` or expanded cleanly); question option buttons >=44px tall; drawer close restores focus to opener; capture and inspect updated 360/390/1280 screenshots.
- F10 (extension-only align): POST `/api/repos/.../issues/batch-align` is rejected (404/405) with 0 GitHub writes.
3. Check for newly introduced regressions across all 5 views, filters, sorts, short names, and root test suite.
</scope>
<criteria>
Return explicit two verdicts: Spec Compliance (PASS | PARTIAL | FAIL) and Quality (APPROVED | NEEDS-FIXES), plus per-finding status (F1–F10 CLOSED or OPEN with exact file:line and reproduction). Both must be PASS and APPROVED with zero open blockers/highs to advance to staging integration. L5 remains AWAITING HUMAN.
</criteria>
<output>
Write reproducible proof, logs and inspected screenshots under .agents/run/issue-48-web-recheck/verifications/proof.md in this worktree. Return <=15 lines: two verdicts, F1–F10 table/list, candidate SHA, test counts/exit codes, proof path, blind spots, and actual provider/model from runtime metadata. App/test files strictly untouched.
</output>
