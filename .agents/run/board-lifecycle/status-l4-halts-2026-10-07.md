# Batch 2 L4 halts and recovery — 2026-10-07

## State and acceptance
- Batch 1: awaiting original human review verdicts; none received. Do not repeat the full ask.
- Batch 2: HALT for both members; no merge/push/issue closure authorized. Builder success assertions are rejected.
- Repeated wakes for the same session are duplicates, not new work.

## Board
- Build: 656cc4f, base 9f651db, root feat/v2-binding-and-ratelimit.
- L4: ses_af99b63ee4e5d43f2caed88c, engineer tier verified previously; finished, HALT. Report verifications/l4-board-v2-ratelimit.md and adversarial artifacts board-v2-l4/.
- Report's 'catastrophic data loss' means local collection/display/cache omission or wrong repository attribution, NOT empirical evidence of deleted GitHub issues.
- Findings: raw-number merge collisions, 304 page loss/cold-empty handling, >100 changed-item truncation, targeted-only refresh violates D11, multi-repo cache poisoning, stale response after scope switch, comment completion race and unapproved refresh staleness, SDK lacks header transport, optimistic repo attribution, cross-repo attach, priority none behavior.
- Reviewer says all findings empirically proven, but inspection shows ETag tests copy simulateStreamRemainingPages/simulateFetchIssuesPage1_304 rather than execute the actual caller. These are credible source-backed hypotheses, NOT L3 proof. Repair reviewer must test production orchestration, not repeat source-copy tests.
- Per-repo cursor/watermark correctness, failed sync retention, overlapping idles/loads/mutations, auth identity cache scoping, retries/transport fallback remain explicit concerns even where not in final findings matrix.
- Main root continues serving rejected build; application tracked state clean. Untracked .opencode/ and .worktrees/ not owned by manager. Do not silently switch served root or merge a repair.
- git worktree add created .worktrees/team-dev-v2-binding-ratelimit-review-repair at 656cc4f, branch fix/v2-binding-ratelimit-review-repair.
- Fresh bounded repair ses_5872aebae42f0424f9288287 dispatched from briefs/board-v2-ratelimit-repair-1.md; session.list confirms 9router/engineer, permission * allow, busy, exact isolated location. Worker preparation scoped to its worktree (ignore/dependency symlink/HOME-adapted registration).

## Voice
- Build: cd6ab18, base 235d1ec, root feat/v2-compat-and-ratelimit.
- L4: ses_fc89160228e764868dff56b1 ended, HALT. Report verifications/l4-voice-v2-ratelimit.md.
- Findings: actual action/resources permissions, real multiselect/value mapping/field keys, empty list fallback and swallowed errors, complete cursor pagination, direct model lookup, partially warmed bare-number ambiguity, invalidation race.
- Reviewer suggestions to cap at 100/200 sessions or guess by issue number <100 are rejected: they merely move the truncation/ambiguity boundary. Estimated latency is not verified timeout behavior; don't silently change approved serial policy or drop slow repos.
- git worktree add created /workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair, branch fix/v2-ratelimit-review-repair at cd6ab18.
- git check-ignore rejected by manager shell. Ignore status unverified; no workaround attempt. Worker preparation scoped to THIS worktree (ignore rule, dependency symlink, HOME-adapted DB registration), following loaded management skill. No secret copying by manager.
- Fresh bounded repair dispatched: ses_1797615df11da447fd7d5863, requested engineer; session.list confirms 9router/engineer, permission * allow, busy, exact isolated location. Brief briefs/voice-v2-ratelimit-repair-1.md. A missing surgical-patch transclusion was corrected on disk immediately after dispatch; worker must use build/refactoring/surgical-patch path.
- No shared-host positive reply fixtures under this repair authority. Safe isolated real V2 fixture may run only without shared DB/session/service effects; otherwise report blocker/plan. Live empty GET lists don't prove reply success.

## Board repair 1 receipt (00ac1b9)
- Manager verified log 00ac1b9 on 656cc4f, clean tracked state, diff limited to .gitignore/panel core+main+bundle/test.
- Builder claims all 14 findings fixed; 265 tests green. NOT accepted. Fresh hostile review ses_3c63be63d8cbb73cde19dac3 (engineer) dispatched via briefs/board-v2-repair-1-l4.md.
- Manager oracle concern: test/review-repairs.test.js imports real core.ts helpers but main.ts behaviors are still local simulate* enactments (pageStream, coldStartFetch, loadComments, request). Reviewer must mark simulation-only proofs UNKNOWN and require production-path tests where orchestration is implicated.
- Builder-reported trade-offs needing USER decision later, not silently accepted: (a) GitHub since= cannot see deleted/transferred issues, so idle refresh misses removals without manual full refresh; (b) SDK host proxy drops custom headers, so non-PAT users get plain GETs and no 304 quota savings (correct but unoptimized). Neither is a defect by itself; no new polling/auth is approved to close them.

## Voice repair 1 receipt (252225a)
- Manager verified log 252225a on cd6ab18, clean tracked state, diff scoped to service host-client/taskboard, tests, run artifacts, .gitignore. panel/main.js delta is +7/-7 esbuild comment paths only (worktree-symlink build noise); no behavior change expected but reviewer confirms.
- Builder claims 9 L4 findings plus archive-flag and permission-session-resolution extras fixed; npm run verify 453 tests green. NOT accepted. Fresh hostile review ses_e8f6110f2851bb374fe3c0bd (engineer) dispatched via briefs/voice-v2-repair-1-l4.md.
- Manager scrutiny targets: (a) real V2 protocol oracle, not fixture shapes; (b) the repair replaced Issue #17 fast-path with unconditional sequential all-repo search — correct but possibly always-fan-out, which conflicts with D11 approved SAFE known-repo lookup; reviewer quantifies request/latency cost and whether trustworthy uniqueness caching survives; (c) positive live form/permission reply proof remains NOT RUN, correctly so — isolated fixture plan documented only.
- Rejected shortcuts restated to reviewer: no limit=100/200 session caps, no issue-number<100 heuristics.

## Voice repair 1 L4 result (ses_e8f6110f2851bb374fe3c0bd)
- Verdict PROCEED-WITH-CONDITIONS on 252225a. 9 original findings verified repaired: 453 tests, build parity, live pagination of 1365 sessions in 954ms, archived mapping from time.archived, terminal-null on empty lists with zero dead-route calls, Issue #17 collision safety restored open+closed.
- 3 residual defects (reviewer-reproduced): (1) host-client.ts:1073 form whitelist omits V2 `type:"integer"` -> valid forms throw UNSUPPORTED_FORM_FIELD; (2) replyQuestion/replyPermission 404 on missing/expired V2 entity falls through to dead V1 routes masking the error; (3) getTasks All Projects caches a partial list 30s when one repo fails.
- Reviewer noise confirmed: panel/main.js delta comment-only; service bundle zero-diff on rebuild. Dead code noticed, not changed (knownIssueRepos map unread after sequential search).
- Latency measured: All Projects cold fan-out 1.6s at 200ms/repo, 0ms warm cache. Positive live reply proof still NOT RUN; disposable-fixture-contract.md documents the isolated plan.
- Bounded fix ses_e0f2d7ad18363e33a02e08a4 dispatched (engineer) via briefs/voice-v2-repair-2-fixes.md: exactly the 3 defects, red/green tests, no scope expansion. Fresh L4 required after.

## Board repair 1 L4 result (ses_3c63be63d8cbb73cde19dac3)
- Verdict PROCEED-WITH-CONDITIONS on 00ac1b9. All 14 original findings F-01..F-14 verified repaired or properly bounded. Test-oracle audit confirmed manager concern: 7 of 12 builder tests were copied simulations; reviewer authored production-orchestration.test.js executing shipped panel/main.js to close the gap. 11 hostile production tests green.
- 4 residual defects (reviewer-reproduced): D-01 HIGH normalizeGithubIssues emits `user: undefined`, SDK strict JSON validation rejects it and host.storage.set throws HOST_REJECTED on cache writes; D-02 MEDIUM unknown-repo issues resolve to __all_projects__ sentinel and send invalid PATCH; D-03 MEDIUM page-1 304 with non-empty in-memory list substitutes aggregate cache and skips page 2+ validation; D-04 LOW incremental sync silently stops at 10 pages without truncation flag/watermark guard.
- Measured request counts per scenario now on record (cold start 304: 2 reqs, paging 145 with page2 304: 1 req restoring 45 items, >100 incremental: 2 reqs merging 150, All Projects idle 3 repos: 3 reqs, drawer race: no stale render, manual refresh: caches cleared). These are fixture measurements, not production traffic.
- Bounded fix ses_5c0356f5e154169806b9fdea dispatched (engineer) via briefs/board-v2-repair-2-fixes.md: exactly D-01..D-04, production-path red/green tests required (simulations rejected). Fresh L4 required after.
- Known non-defect gaps unchanged and awaiting user decision: since= omits deletions/transfers (manual Refresh reconciles); SDK host proxy drops conditional headers (non-PAT users degrade to plain GET, correct without quota savings).

## Voice repair 2 receipt (f58e11b/67f955f/d582374, docs a5ddb77)
- Manager verified commit chain on 252225a, clean tracked state, diff scoped to service host-client/taskboard, tests, run artifacts; panel/main.js untouched (zero churn as claimed).
- Builder claims exactly 3 fixes: integer form type (red/green), dead-V1-404 fall-through removal (typed NOT_FOUND, legacy fallback only on pre-V2 collection 404), partial-cache poisoning (per-repo generation-protected cache + aggregate canCache guard, failed repo retries). 459 tests claimed green. NOT accepted.
- Builder-disclosed residual: V2 form type `external` (display URL field) still omitted from answer whitelist — reviewer must decide residual defect vs correct non-input handling.
- Fresh hostile review ses_6d098c99a8d60ed4cbb8364e (engineer) dispatched via briefs/voice-v2-repair-2-l4.md: delta review + collateral sweep of the 9 previously verified repairs. Positive live reply proof remains NOT RUN by design (shared host database/roster); no live session mutation is authorized.

## Issue receipt limitation
- Manager attempted allowlisted `gh issue list --repo Workflows-Accelerator/openchamber-github-task-board --state open --limit 30 --json number,title,labels,url`; shell exit 127, gh not installed.
- No remote issue receipt/status update made at this boundary. Do not route around manager shell denial using REST/execute. Existing repair workers explicitly own no issue writes; avoid spawning a duplicate repo worker. Remote receipt sync remains pending a bounded worker dispatch after current app workers end, or restored gh availability.

## Recovery and proof
1. Board repair is in its own isolated worktree and brief; no duplicate sessions.
2. Every completed repair gets a fresh hostile-review delegate, exact mandatory hostile prompt in brief, before any acceptance.
3. Batch 2 review waits for both members passing L4 and adequate real user-path evidence; known blind spots must be stated.
4. Only the USER closes/moves Done or pushes. No PRs, push, reset, rebase or arbitrary manager shell commands.
5. Board and voice roots are serving experimental commits, not local master. Surface that caveat before asking human to click through Batch 1; do not claim the old batch is what currently loads.
