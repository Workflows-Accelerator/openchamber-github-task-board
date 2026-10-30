<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views
Branch: feat/issue-48-panel-simple-views
Candidate: c9fb61b8f4d7fa2178481abaff588b2e23b8380e (correction round 1 completed by ses_657cef5df6795832c05d274d; commits 7a6b68e, 60ba457, c9fb61b on top of 253f9f2).
Prior candidate: 253f9f23e4b4eda7f39ca0a059dff3a21e33eb84; base: cc083796c4bf62b57aaa76e2908f8b5cd47347dd.
Review paths: panel/**, test/** changed by #48, shipped panel/main.js. App and test files READ ONLY. Write evidence only under this worktree's .agents/run/issue-48-panel-recheck/**. Preserve .agents/run/issue-48-panel-hostile/** and .agents/run/issue-48-panel-correction/** untouched.
Tests: npm run typecheck; npm run build:panel -- --outfile=.agents/run/issue-48-panel-recheck/verifications/scratch/main.js && cmp panel/main.js .agents/run/issue-48-panel-recheck/verifications/scratch/main.js; node --test --test-concurrency=1 test/*.test.js; node --test test/shipped-parity.test.js; Chromium browser verification against built panel/index.html + panel/main.js with synthetic OpenChamber bridge + fake GitHub.
Do not run web tests or access real GitHub, credentials, /workspace/.openchamber-data/**, /workspace/releases/** or production board. No merge, push, deployment or issue closure. Zero secret values in logs, argv or reports.
Preflight facts authoritative once candidate SHA is populated at dispatch; skip initial pwd/ls/status spin.
</env_preflight>
<goal>
Independently verify whether extension correction round 1 resolves all hostile review findings (C1–C2, H1–H3, M1–M3), keeps M4 cleanly documented for L5, maintains deterministic panel/main.js parity, and introduces zero regressions.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-48-panel-hostile-review-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/amendment-issue-48-confirmed-transfer.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-hostile/verifications/proof.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views/.agents/run/issue-48-panel-correction/verifications/proof.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<review_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are an independent reviewer, not the correction builder. Distrust self-reports and re-test every finding empirically in Chromium and JSDOM.
</review_prompt>
<scope>
1. Re-run adversarial Chromium and unit checks for every finding from the first review:
- C1 (free manual reorder): downward/upward moves across all-unmarked, mixed, equal-marker, and 53+ midpoint-exhausted drafts succeed via lazy neighbour marker initialisation/rebalance and sequential conflict-safe `updateIssueBody` writes; first reorder gesture moves immediately even when switching Sort to Manual order; partial failure reconciles honestly.
- C2 (D55 confirmed transfer): changing a saved draft's project `<select>` triggers an explicit confirmation dialog naming target project and warning number/URL may change BEFORE any network call; Cancel resets `<select>` with 0 network calls; confirm validates `targetRepo` against `availableProjectRepos()` and calls `POST /graphql` (`transferIssue`); non-definitive failure marks `issue.unconfirmed = true`, disables further mutations until refresh reconciles source+target, and prevents blind retry.
- H1 (360px filter popover): at 360x780 viewport, clicking `#btnFilterToggle` renders `#filterPopover` and `[data-filter="stage:draft"]` completely inside the viewport (`x >= 0`, `x + width <= 360`) and standard Playwright `.click()` succeeds without timeout.
- H2 (marker byte safety): fenced `<!-- board-order: 777 -->` examples, CRLF `\r\n` line endings, and trailing Markdown hard-break spaces survive `stripOrderMarker`/`setOrderMarker` and textarea display/save untouched.
- H3 (All Projects Graph collision): in All Projects Graph view, two `#1` issues in different repositories both render as distinct nodes without overwriting one another, while unqualified `#N` edges bind within the same repo.
- M1 (button reorder controls): editable draft rows expose accessible Move Up / Move Down buttons working by click/tap at 360px alongside `Alt+ArrowUp/Down` and drag-and-drop.
- M2 (inline edit preservation & focus): typing in a draft title/description survives `#btnRefresh` (`renderViews()`), pressing `Tab` after editing a title moves focus cleanly instead of dropping to `BODY`, and a failed description `PATCH` (`422`) retains the user's typed text in the textarea.
- M3 (repo tie-breaker): `compareManualOrder` and `byNumberDesc` tie-break deterministically by `repo` before `number`.
- M4 (disclosed legacy removals): verify M4 remains documented for L5 without re-bloating the unified toolbar, and verify no safety/answer-integrity/CPU tests were weakened.
2. Verify scratch `npm run build:panel` matches committed `panel/main.js` byte-for-byte (`cmp` exit 0), full root test suite and `shipped-parity.test.js` pass, and inspect updated 360px/980px screenshots.
</scope>
<criteria>
Return explicit two verdicts: Spec Compliance (PASS | PARTIAL | FAIL) and Quality (APPROVED | NEEDS-FIXES), plus per-finding status (C1, C2, H1, H2, H3, M1, M2, M3 CLOSED or OPEN with exact file:line and reproduction; M4 DISCLOSED FOR L5). Both verdicts must be PASS and APPROVED with zero open catastrophic/high/moderate code defects to advance to staging integration. L5 remains AWAITING HUMAN.
</criteria>
<output>
Write reproducible proof, logs and inspected screenshots under .agents/run/issue-48-panel-recheck/verifications/proof.md in this worktree. Return <=15 lines: two verdicts, C1–M4 status list, candidate SHA, test counts/exit codes, proof path, blind spots, and actual provider/model from runtime metadata. App/test files strictly untouched.
</output>
