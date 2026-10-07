<goal>Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/board-v2-ratelimit-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-board-v2-ratelimit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/rate-limit-manager-review.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/status-l4-halts-2026-10-07.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<context>
Independent fresh reviewer for repair commit 00ac1b9 (base 656cc4f) on branch fix/v2-binding-ratelimit-review-repair in THIS worktree. Builder ses_5872aebae42f0424f9288287 reports all F-01..F-14 fixed, typecheck/build/265 tests green. The prior review (l4-board-v2-ratelimit.md) itself used copied simulation tests and was criticized for it; do NOT repeat that error.
Manager already observed that test/review-repairs.test.js imports real helpers from panel/core.ts but re-implements main.ts behaviors as local `simulatePageStream`, `simulateColdStartFetch`, `simulateLoadComments`, `simulateRequest` functions. Determine exactly which defects are proven against real production functions and which remain unproven enactments. A green suite is not evidence of correct orchestration.
D11 contract: idle refresh must pick up CHANGED ISSUES across ALL repos in current scope (agent edits AND other people's github.com edits), not targeted-only repos of idle sessions. Voice 30s reuse does NOT authorize board comment staleness. Full-scope refresh is required; scope reduction is feature loss.
Known trade-off the builder reported and is NOT a defect by itself: GitHub /issues?since= omits deleted/transferred issues, and the SDK host proxy drops custom headers so non-PAT users degrade to unconditional GET. Verify the code degrades CORRECTLY (no data loss, no fake 304 savings claims) rather than accepting or rejecting the trade-off as policy.
</context>
<scope>
Read-only review of 656cc4f..00ac1b9 in THIS worktree. No application edits, commits, merges, branch switches, stash/reset, push, PR, issue closure, DB writes, extension registration or service restarts. Only write sanitized review artifacts under /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/board-v2-repair-1-l4/ and report /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-board-v2-repair-1.md. Tests and read-only probes may run. Never create real issues, mutate real GitHub data, or approve live permissions. Secrets must never appear in any output.
</scope>
<criteria>
Independent verdict per repair item F-01..F-14 plus watermark/concurrency/retry/deletion gaps: PROCEED, PROCEED-WITH-CONDITIONS, or HALT. Findings need file:line, severity, expected vs actual, minimal repair. Distinguish tests that execute real production functions from copied simulations; source-string or enactment proof is not functional proof. Record exact commands/results and explicit NOT RUN user paths. No release, closure or approval authority.
</criteria>
<steps>
<step>Verify branch, commit 00ac1b9 and diff scope; run npm run typecheck, npm run build and node --test test/*.test.js yourself and record exits. Confirm generated panel/main.js parity with npm run build output.</step>
<step>Test-oracle audit: for each of the 12 tests in test/review-repairs.test.js state whether it imports and executes the real production function/handler (mergeIssuePages, syncIncrementalRepoIssues, normalizeGithubIssues, buildMultiIssueAttachPayload, handleIdleRefresh, fetchIssues, streamRemainingPages, loadComments, retry wrappers) or a local simulate* re-enactment. Any defect proven only by a copied simulation is NOT proven; mark it UNKNOWN and require a production-path test.</step>
<step>Identity: same issue number in two repos must both survive merge, incremental sync, caches, per-repo storage, drawer active-issue writes and V2 attach payloads. Check repo || '' key fallbacks, missing repo on old items, __all_projects__ sentinel handling and cross-repo bundles. Test 3 repos with colliding numbers and a closed duplicate.</step>
<step>Pagination/304: pageBodyCache must pair exact query+auth ETag with body; 304 without body must force unconditional refetch, never render empty or drop pages 2+. Cold start 304 must not overwrite storage with []. Cache keys must not leak unbounded timestamped entries. Forced Refresh must bypass caches. >1000-issue cap must not mark partial data complete without visible warning.</step>
<step>D11 incremental: all repos in current scope sync on every idle event even if idle sessions link one repo or none; per-repo watermarks advance only after ALL pages of a successful fetch with safe request-start overlap; failed fetch keeps prior cursor/watermark and keeps showing prior data; overlapping idles/load/switch/mutation races cannot clobber newer state or re-serve pre-mutation data; deletes/transfers not covered by since= must be documented as a freshness gap requiring user decision, silently ignored is a finding.</step>
<step>Comments/writes: drawerGeneration + repo-qualified guard on comment loads, no stale cross-issue render, commentsCache invalidated on manual Refresh/repo switch/reopen as claimed, and explicit freshness preserved where D11 requires. Drag updates single PATCH with priority-none clearing and atomic rollback; optimistic create attributes correct repo after await/switch; retries preserve body/query/headers, never retry non-rate-limit auth errors or ambiguous POST commits.</step>
<step>Record measured request counts where feasible (fixtures), separate from unmeasured percent claims. List every NOT RUN user path (real iframe, real GitHub before/after, live browser screenshots). Stop after read-only review.</step>
</steps>
<output>
Write report with per-item verdicts, findings file:line/severity/expected vs actual/minimal repair, test-oracle table (production vs simulation), evidence commands/exits, NOT RUN gaps, and numbered minimal repairs. Return status, results, evidence, learnings, report path and commit reviewed. Nothing is human-approved or released. Never include credentials.
</output>
