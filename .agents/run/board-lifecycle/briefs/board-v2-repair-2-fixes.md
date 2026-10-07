<goal>Fix exactly the four residual board defects from hostile review of 00ac1b9, with failing-first regression tests, no scope expansion.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-board-v2-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/disposition-matrix.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/test-oracle-matrix.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/board-v2-ratelimit-repair-1.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<context>
You are repair 2 (bounded fix) on branch fix/v2-binding-ratelimit-review-repair in THIS worktree at 00ac1b9. Independent L4 ses_3c63be63d8cbb73cde19dac3 returned PROCEED-WITH-CONDITIONS with exactly four defects D-01..D-04. Everything else in the repair is reviewed and accepted; do not refactor beyond these four fixes.
The reviewer proved defects against the real bundled SDK and built a production orchestration harness (transcluded above) that executes shipped panel/main.js. Your regression tests must execute real production functions or that harness style; copied simulate* enactments are explicitly rejected by this run and do not count as proof.
D11 and the run constraints still stand: no freshness loss, no guessed repos, no new polling/auth, no real GitHub mutations, no secrets in output. The known non-defect trade-offs (since= omits deletions/transfers; SDK host proxy drops conditional headers) remain documented gaps awaiting user decision; do not close them with new policy.
</context>
<scope>
Owned: panel/core.ts, panel/main.ts, test/review-repairs.test.js and minimal additions to test/, regenerated panel/main.js, worktree run artifacts. Commit locally on the current branch. No other files, no root checkout edits, no branch switches, no push/PR/issue closure, no DB/service changes, no delegation.
</scope>
<criteria>
Each fix has a regression test that FAILS against 00ac1b9 and PASSES after, executed against production code paths or the shipped bundle, not simulations. npm run typecheck, npm run build and node --test test/*.test.js pass with generated bundle parity. Report per-fix file:line and red/green evidence. Fresh hostile review follows; no acceptance claim.
</criteria>
<steps>
<step>Fix D-01 (HIGH) — storage JSON rejection: normalizeGithubIssues must never emit properties with undefined values (user and any others the reviewer identified). A cache write of a normalized issue must not trigger HOST_REJECTED from the SDK's strict JSON validation. Prove with a production-path test that persists a normalized issue through the real SDK validation or its exact rule.</step>
<step>Fix D-02 (MEDIUM) — sentinel PATCH: in All Projects mode an issue with missing/unknown repo must never resolve to the __all_projects__ sentinel for writes. Block the write with a clear user-visible error (and do not send any request) when repo is unknown; reads may still render such issues. Prove no PATCH request is attempted for an unknown-repo issue.</step>
<step>Fix D-03 (MEDIUM) — 304 aggregate substitution: a page-1 304 with a non-empty in-memory list must not skip validation of pages 2+. Later pages must still be checked (their own 304s may reuse their paired page bodies), or the fetch must degrade to a full unconditional fetch. Never substitute the aggregate cache and silently drop later pages. Prove with a 2-page scenario where page 1 is 304 and page 2 has changed.</step>
<step>Fix D-04 (LOW) — visible truncation: when incremental sync hits its page cap (>1,000 changed items) it must not silently stop. Set a visible truncation warning/flag in the UI/log and do not advance the watermark past the untruncated range. Prove with a >1,000-item fixture.</step>
<step>Run npm run typecheck, npm run build and node --test test/*.test.js; confirm panel/main.js parity and that panel/core.ts changes keep shipped-parity tests green. Save red/green logs in worktree run artifacts, commit once per fix, and report.</step>
</steps>
<output>
STATUS; RESULTS per fix D-01..D-04 (file:line, what changed, red/green); CHANGED paths and commits; EVIDENCE commands/counts/exits; NOT VERIFIED; BLOCKERS; LEARNINGS. Nothing is accepted until fresh hostile review and human verdict.
</output>
