<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2
Branch: feat/chamberos-board-v2
Base commit: e90415b (repair complete; all ten reported commits verified via git log and git show --stat).
Clean/dirty state: clean (manager git status --short after completion wake).
Review range begins at 81ed5b6159991823fcef7a2c0abd780b6b3af897.
Files: web/server/board.ts, app.ts, github.ts; web/public/app.js, index.html, theme.css; web/tests/**; scripts/audit-a5*.mjs, scripts/generate-a5-screenshots.mjs; worktree A4/A5 verification artifacts.
Test commands: timeout 900 npm test; timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs; timeout 600 npm run typecheck; timeout 120 node scripts/audit-a5-data.mjs; timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs.
Do not touch: main checkout outside this worktree; panel/**; service/**; live GitHub issue data; production processes; /workspace/releases/**; /workspace/.openchamber-data/**; .env* or credentials; /proc/*/environ; repository settings. No push/PR/merge/reset/rebase, deletion, issue closure or live switch. No new dependencies or unrelated refactors. Zero emojis.
Preflight facts are authoritative at dispatch. Skip startup pwd/ls/git status discovery. Targeted checks remain permitted for mutations, pre-commit verification, stale resume, location changes or action failure. No other worker will be active here at dispatch.
</env_preflight>
<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
</goal>
<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A5-repair.md]
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
Read the worktree's A4/proof.md, A5/proof.md and A5/independent/audit-findings.md under .agents/run/chamberos-board-v2/verifications/. Treat builder claims as hypotheses, not proof. The preceding repair worker's completion is not independent verification.
</context_files>
<skills>
[@/workspace/code/openchamber-config/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/verify/browser/browser-testing-with-devtools/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Review the repair diff from 81ed5b6 through the verified base commit above. You may fix contained defects in web/**, scripts/audit-a5*.mjs, scripts/generate-a5-screenshots.mjs and worktree .agents/run/chamberos-board-v2/verifications/A4/** or A5/** for at most two rounds. Preserve existing unrelated edits and A1-A4 behavior. Do not weaken or remove tests to obtain green results. If a new product decision, data-loss risk or broader scope is required, stop and report that fork; do not invent a decision. Keep the approved manual reopen behavior unchanged and flagged for human review; never reopen real issues.
</scope>
<review_focus>
1. Presentation: enable the saved global switch, navigate Client/List/Canvas/drawer/Decisions/Blocked/Operations/Archive and reload. Check actual YAML, hidden markers, questions, tasks, metadata, internal labels, controls and notes are absent from user-visible previews without hiding planned/todo as draft. Use existing parser/renderer, no fake DOM/CSS injection. Check 360px disclaimer and French status/error strings.
2. Note conflict: draft against BASE_NOTE; change remote target note to REMOTE_NOTE; provoke stale-fingerprint 409. Poll, Refresh and ordinary Retry must preserve LOCAL_DRAFT and must not overwrite REMOTE_NOTE. Only an explicitly confirmed overwrite may replace it. Test safe retry when only non-note fields changed, two notes in one issue, cancel/reload and late responses. Assert upstream write counts and exact body bytes.
3. Marker identity: set+strip must preserve every byte of no-newline, LF, CRLF, whitespace-only, existing hidden comments, marker-looking user text and multiple valid marker variants. Ensure new metadata does not break existing marker parsing or position reads and does not strip legitimate body whitespace.
4. Same-issue task concurrency: two distinct quick checkbox clicks both succeed; serialize with current fingerprint, preserve the intended task under intervening edits; no lost updates or self-409, no retrying a changed index blindly. Cross-issue writes must not be serialized globally unnecessarily.
5. Data: real cached timestamp remains old on combined/operations/archive cache hits; partial/failure/truncated banners visible EN/FR; dedicated bounded state=closed fetch works with >1000 open issues, stable closed_at sorting and pagination without duplicates; finite normalized pagination including Infinity/-Infinity/NaN/negative/huge numbers. No fabricated complete totals. Blocked badge/list predicates identical and closed issues non-actionable.
6. Check existing A4/A5 acceptance beyond the nine probes; keep NOT RUN matrix explicit. Inspect console/server/network errors, no banned terms or double-plus, no forbidden changes or weakened tests. Browser proof must use unchanged app assets and fake GitHub only as the upstream test boundary.
7. Manager inspection at e90415b: suspicious partial presentation fix. Diff adds isInternalItem() prefix filtering and still renders most raw question/task text in Decisions/Blocked instead of hiding ALL such internals per repair scope. Do not invent an [internal] naming convention. Check drawer currently hides textarea save and marks readOnly but may still display raw YAML and body text; verify actual pixels, not CSS selectors alone. Diff also removes prior fingerprint extraction in saveIssueCanvas; verify safe non-note retry and explicit overwrite preserve remote geometry/other notes, deleted-note conflicts and any newer remote change. The note overwrite path appears to assign only remote fingerprint, not remote canvas: test whether overwriting note A can clobber a concurrent remote change to note B/card position.
8. Screenshot review: 17-client-1280-dark.png has clean overview/no YAML; French Operations headers now translated. But 20-client-360-dark.png has a huge empty warning box (nearly half viewport) hiding all actual tasks below fold. Fix that contained responsiveness defect without redesign. 24-bilingual-fr-operations shows presentation mode active while totals/table still count drafts; confirm expected hiding and data-scope honesty rather than claiming fully filtered. Preserve original historic evidence; repair worker overwrote browser.json/data.json and A4 proof sections—do not erase failed historical findings in your report.
</review_focus>
<criteria>
Each of the nine repair defects has independently reproducible evidence or remains explicitly FAIL/NOT RUN. Both suites/typecheck and both audit scripts pass, or unresolved failures are reported plainly. No data-loss/overwrite/presentation leak or false complete/fresh data claims. Screenshots are real and regenerated where behavior changes. Clean scoped worktree at finish. Never claim L5 passed or authorise a merge. Do not hide any blocker as a B1 carry-over.
</criteria>
<verification>
Run both suites, typecheck and the two audit scripts listed in env_preflight under their timeouts. Store raw summaries/exit codes in A5/proof.md. Baseline before repair: legacy 618, web 559; account for any changed test totals. Do not treat passing self-authored mocks alone as browser evidence. Verify cited SHAs with git show --stat; finish with raw git log --oneline 81ed5b6..HEAD and git status --short. Mark live GitHub writes and all unexecuted scenarios NOT RUN.
</verification>
<output>
Append a Post-repair hostile review section to A4/proof.md and A5/proof.md with findings/severity/resolution, exact commands, raw logs, browser artifacts and blind spots. Commit scoped changes. Reply in at most 20 lines: Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, findings/fixed/open counts, commit list, both suite totals/typecheck/probe summaries, final SHA, raw git log/status and proof paths. Do not fabricate artifacts or SHAs. This is L4, not human acceptance.
</output>
