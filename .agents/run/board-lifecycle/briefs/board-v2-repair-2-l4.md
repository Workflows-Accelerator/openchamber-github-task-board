<goal>Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/board-v2-repair-2-fixes.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-board-v2-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/disposition-matrix.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/production-orchestration.test.js]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<context>
Independent fresh reviewer for repair 2 commits bea33c0, 0c3b60a, f2583e2, 147d8dd (tests a8014aa, docs bca2bc9) on base 00ac1b9 in THIS worktree. Builder ses_5c0356f5e154169806b9fdea claims exactly four bounded fixes (D-01 storage JSON rejection, D-02 sentinel PATCH, D-03 page-1 304 skipping pages 2+, D-04 silent truncation) with production-path tests and 269 tests green. The prior review (l4-board-v2-repair-1.md) verified 00ac1b9's 14 repairs and found these four residuals; your job is the delta 00ac1b9..HEAD plus collateral damage to those 14.
Builder's 'NOT VERIFIED: nothing relevant' is NOT accepted; enumerate what genuinely remains unverified yourself (real iframe, real GitHub mutations, live browser).
Test-oracle standard: copied simulate* enactments were rejected earlier and remain rejected. The builder claims its new test-app-harness.js executes the production panel/main.js bundle with SDK bridge mocks — scrutinize whether the mocks faithfully reproduce the real SDK contract (especially isJsonValue strictness and storage rejection) or merely assert what the tests themselves define.
Key semantics to enforce: (D-01) normalized issue objects must never contain undefined-valued properties in any path that reaches host.storage.set; (D-02) unknown-repo issues must never PATCH the __all_projects__ sentinel or any invalid URL — writes abort with a clear user-visible error; (D-03) page-1 304 must never skip validation of later pages and never render stale/partial lists as complete; (D-04) incremental sync must not advance the watermark past untruncated ranges and must surface truncation to the user.
D11 and run constraints stand: no freshness loss, no guessed repos, no new polling/auth, no real GitHub mutations, no secrets in output. Known gaps (since= omits deletions/transfers; SDK host proxy drops conditional headers) remain documented and awaiting user decision; do not treat them as defects to fix or as accepted policy.
</context>
<scope>
Read-only review of 00ac1b9..HEAD in THIS worktree. No application edits, commits, merges, branch switches, stash/reset, push, PR, issue closure, DB writes, extension registration or service restarts. Only write sanitized review artifacts under /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-2-l4/ and report /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-board-v2-repair-2.md. Tests and read-only probes may run. Never mutate real GitHub issues. No delegation.
</scope>
<criteria>
Independent verdict per fix D-01..D-04: PROCEED, PROCEED-WITH-CONDITIONS, or HALT. Findings need file:line, severity, expected vs actual, minimal repair. Confirm each red proof genuinely fails at 00ac1b9 and each green test executes real production code (run them yourself). Check the 14 previously verified repairs still hold (run the full suite and the prior reviewer's production-orchestration.test.js). Record exact commands/results and explicit NOT RUN paths. No release, closure or approval authority.
</criteria>
<steps>
<step>Verify branch and commit chain; run npm run typecheck, npm run build and node --test test/*.test.js yourself; confirm panel/main.js parity. Re-run the prior reviewer's production-orchestration tests to confirm no regression.</step>
<step>D-01: audit every path that reaches host.storage.set for undefined-valued properties (normalizeGithubIssues and any other normalizer). Verify the harness's SDK mock actually replicates isJsonValue rejection; a mock that permits undefined proves nothing.</step>
<step>D-02: verify repoForIssue returns empty/abort for unknown or sentinel repos in ALL write paths (status, labels, comments, body edits, drag updates), each surfaces a clear error, and no request is ever sent. Check reads still render unknown-repo issues harmlessly.</step>
<step>D-03: 2-page scenario where page 1 is 304 and page 2 changed must fetch and merge page 2; page-1 304 must never render a stale or partial list as complete. Check interaction with the pageBodyCache pairing, cold-start unconditional retry, and streamRemainingPages scheduling.</step>
<step>D-04: >1,000 changed fixture must set the truncation flag, warn the user via the chosen mechanism, and NOT advance the watermark past the untruncated range; next sync must cover the missed range. Check the cleared ETag cache cannot cause unbounded refetch loops.</step>
<step>Collateral sweep: full suite green; previously verified behaviors (repo-qualified merging, cache isolation, drawer generation guards, single-PATCH drag, optimistic create repo attribution, retry semantics) still hold. Enumerate remaining NOT RUN gaps yourself. Stop after read-only review.</step>
</steps>
<output>
Write report with per-fix verdicts, findings file:line/severity/expected vs actual/minimal repair, red/green reproduction results, test-oracle assessment of the harness mocks, evidence commands/exits, NOT RUN gaps and numbered minimal repairs. Return status, results, evidence, learnings, report path and commits reviewed. Nothing is human-approved or released. Never include credentials.
</output>
