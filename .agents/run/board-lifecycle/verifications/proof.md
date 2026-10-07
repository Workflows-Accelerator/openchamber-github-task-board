# Board lifecycle verification index

Updated: 2026-10-07. Status: INCOMPLETE — L5 human validation pending. Both Batch 2 chains pass L4 (PROCEED); integration merges into the served preview branches in flight before the single Batch 2 ask.

## Batch 1 — contract, three views, voice All Projects fix, lifecycle skill

- Board contract/views merger: builder/reviewer ses_9623172ae6d79b9821e636bc reports `npm run typecheck` clean; `node --test test/*.test.js` 244 pass/0 fail; shipped-parity 13 pass/0 fail; bundle built in root checkout. Manager checked `git log master` showing 9f651db and `git log issue-lifecycle-issue-contract-l4r` showing 4194652. No browser click-through performed.
- Hostile hardening 4194652: fenced examples excluded from parsers; heading indentation restricted; explicitly other-bound session blocked in single-session fallback; idle routing fixed in draft/vague-idea branches in both resolvers. Evidence in completion receipt; prior reports l4-03-contract.md and l4-04-views.md.
- Voice #17: local master merger 21fd1d1; prior L4 report l4-02-crashfix.md; mocked suite 427 reported. Live GitHub request not verified.
- Skill #21: 03f0b6e and c17c1f1, L4 report l4-01-skill.md. Real dogfooding not performed.
- L3 browser/voice workflow: NOT RUN.
- L5: AWAITING HUMAN; prior numbered request l5-batch-1.md, no verdict received. User alone closes issues or moves them to Done. Nothing pushed.

## Batch 2 voice — V2 client + D11 efficiency

### Receipt and provenance
Builder ses_6a5a8749c6759270a40cbafd completed. Commit verified by manager `git log --oneline -5` at /workspace/extensions/chambervoice: cd6ab18 on feat/v2-compat-and-ratelimit, base 235d1ec. `git diff master...feat/v2-compat-and-ratelimit --stat`: 7 files changed, 1313 insertions, 162 deletions including generated bundle and tests. Tracked working tree clean at receipt; unrelated untracked supervisor state left alone.

### Executed levels (reported by builder, not independently accepted)
- L0: builder reports `npm run typecheck` and `npm run build` PASS; raw exit logs not yet saved here.
- L1: builder reports `node --test test/host-client.test.js` 19 passing, `node --test test/taskboard.test.js` 40 passing, `npm run verify` 437 passing across 54 suites. Host boundary largely mocked.
- L2: read-only built HostClient calls against live V2 host on loopback succeeded: project session list 26, global session list 50, activity map 21. GET /api/session HTTP 200 with {data,cursor} and location.directory. GET /api/form and /api/permission/request HTTP 200 with EMPTY data arrays. Legacy /api/question and /api/permission HTTP 404. Auth presence verified by builder; secret values deliberately omitted.
- L3: NOT RUN — no successful real form answer, no safe real permission reply, no voice invocation proof, no live GitHub before/after request measurement.
- L4: HALT, fresh read-only engineer reviewer ses_fc89160228e764868dff56b1 completed. Report verifications/l4-voice-v2-ratelimit.md. Independently ran `npm run verify` (exit 0, 437 tests) and live read-only V2 probes; actual schema defects remain despite green suite. Acceptance NOT granted; repair 1 ses_1797615df11da447fd7d5863 running in isolated worktree.
- L5: AWAITING BATCH — not reviewable until voice and board pass hostile review and missing proof is addressed.

### Claims not accepted
Builder's 'nothing relevant unverified' conflicts with empty form/permission listings; it is not accepted. A successful empty GET does not prove field shape, answer mapping, decision delivery, or a resumed session. Global list exactly 50 with a cursor may indicate first-page truncation. Cached numeric issue mapping may hide cross-repo collisions when lists are partially warm. These are hostile review targets, not manager-verified defects yet.

### Safety
No review may answer unrelated live user questions or approve/deny real permissions. Positive proof must use a disposable, harmless fixture or remain explicitly NOT RUN. Do not print or record auth passwords, tokens, cookies. The builder's chat contained a login secret; that value must not be propagated to briefs, git receipts, or further chat.

## Batch 2 board

Builder ses_068d6622598dc3b1059dbd91 ended at 656cc4f, base 9f651db. Manager inspected log, tracked state and diff: 6 app/test files changed, including generated panel/main.js; no tracked app edits pending. Root remains on feat/v2-binding-and-ratelimit with manager-only checkpoints.

- L0: reviewer reports `npm run typecheck` PASS, exit 0.
- L1: reviewer reports `node --test test/*.test.js` PASS, 253 tests; 10 hostile proof tests also green, proving modeled failures rather than correct operation.
- L2: direct authenticated GitHub 200 then 304 quota probe reported previously; SDK header capability unsupported in current contract. Actual proxy implementation/browser path remains to be established by repair.
- L3: NOT RUN actual running board iframe/real GitHub before-after savings; browser click-through not proved.
- L4: HALT, independent engineer ses_af99b63ee4e5d43f2caed88c. Report l4-board-v2-ratelimit.md and artifacts board-v2-l4/. Findings include cross-repo raw-number merge, 304 missing bodies, >100 incremental truncation, D11 targeted-only loss and cache/scope/comment races.
- Evidence caveat: inspected proof-etag-304-drops-subsequent-pages.test.js; it tests copied simulation functions, NOT the production fetchIssues/stream handlers. Therefore report's 'all empirical' claim is too broad; require production-path regression proof.
- Terminology caveat: reported 'data destruction' concerns local board/cache omissions, not remotely deleted GitHub issues; no destructive remote write proved.
- L5: BLOCKED until repair, new L4 and real-path proof. Existing Batch 1 request also targets a preview now serving experimental Batch 2 code; no user verdict presumed.

Repair 1: ses_1797615df11da447fd7d5863 ended at 252225a (base cd6ab18) — claims 9 findings fixed, 453 tests; manager verified commit/diff/clean state; NOT accepted. Hostile review ses_e8f6110f2851bb374fe3c0bd: PROCEED-WITH-CONDITIONS (3 residual defects); bounded fix ses_e0f2d7ad18363e33a02e08a4 running via briefs/voice-v2-repair-2-fixes.md. Board repair 1: ses_5872aebae42f0424f9288287 ended at 00ac1b9 (base 656cc4f) — claims F-01..F-14 fixed, 265 tests; NOT accepted; hostile review ses_3c63be63d8cbb73cde19dac3: PROCEED-WITH-CONDITIONS (4 residual defects D-01..D-04, incl. HIGH storage JSON rejection); bounded fix ses_5c0356f5e154169806b9fdea running via briefs/board-v2-repair-2-fixes.md. Neither repair chain may merge, push, close issues, change registered root or approve unrelated live permissions/forms. Fresh L4 required after each bounded fix before any human review request.

## Batch 2 convergence — final L4 state (supersedes the in-flight wording above)

- Voice chain: repair 2 (f58e11b/67f955f/d582374, docs a5ddb77) reviewed PROCEED-WITH-CONDITIONS by ses_6d098c99a8d60ed4cbb8364e (1 residual: external form field type). Repair 3 ses_de7b947c163f3c1c57b71b9f ended at a7e3ac9 — single surgical fix (external fields filtered in normalizeQuestionRequest, replyQuestion inputFields iteration, object-answer key strip). Fresh L4 ses_2baffff1f2bb7cbf79f5d8be: **PROCEED, zero residual findings**. Red proof reproduced at base a5ddb77 (3!==2 question count; UNSUPPORTED_FORM_FIELD), green at a7e3ac9; independent adversarial permutations (external first/middle/end/multiple) pass; collateral sweep of 12 prior repairs PASS. Report l4-voice-v2-repair-3.md; artifacts voice-v2-repair-3-l4/ (reproduction-audit.md, oracle-audit.md, test-oracle-matrix.md, live-evidence.md).
- Board chain: repair 2 (bea33c0/0c3b60a/f2583e2/147d8dd, tests a8014aa, docs bca2bc9) reviewed **PROCEED (zero residual)** by ses_edc44a2c528758b04a5d3a20: D-01 storage JSON rejection, D-02 sentinel PATCH guard, D-03 page-1-304 multi-page validation, D-04 truncation flag + watermark guard all verified fixed with red/green at 00ac1b9; F-01..F-14 collateral intact. 269/269 tests green — manager independently reproduced `node --test test/*.test.js` in the worktree. Report l4-board-v2-repair-2.md + artifacts board-v2-repair-2-l4/ committed on the fix branch (4353672) and carried into the root tree by the integration merge. Reviewer learning: repair-1's production-orchestration mock (querySelector null) broke real DOM rendering; builder's test-app-harness.js is the accepted production-bundle harness standard.
- **Batch 2 quorum reached**: both members passed L4. L5 = AWAITING HUMAN; one combined ask after the integration merges land in the served preview branches (fix chains are NOT yet what the served roots run).
- NOT RUN (both chains, unchanged): real iframe/webview browser E2E; real GitHub mutations; positive live form/permission reply proof (shared host DB/session roster — design limitation; disposable-fixture-contract.md outstanding); end-to-end measured quota savings.

## Recovery proof conditions
- Next dispatch after each completed repair is fresh read-only hostile review of exact commit. No resumed ended workers.
- Do not accept reviewer shortcuts of arbitrary page limits or small-issue-number uniqueness heuristics.
- Per-repo watermark/failure/overlap, auth cache scope, forced freshness and duplicate-mutation transport behavior remain explicit checks.
- Isolated real V2 reply fixtures may be used only without shared session/DB/service effects; no real shared-host session creation/reply is authorized in repair brief.
- State receipt: status-l4-halts-2026-10-07.md. Nothing pushed, merged from Batch 2, closed or human-approved.
