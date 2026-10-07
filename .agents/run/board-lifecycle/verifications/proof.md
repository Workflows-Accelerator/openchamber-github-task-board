# Board lifecycle verification index

Updated: 2026-10-07. Status: INCOMPLETE — human validation and batch 2 proof still pending.

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

Repair 1: ses_5872aebae42f0424f9288287, engineer and auto-accept verified via session.list. Worktree .worktrees/team-dev-v2-binding-ratelimit-review-repair at 656cc4f, fix/v2-binding-ratelimit-review-repair. Brief briefs/board-v2-ratelimit-repair-1.md. Voice parallel repair is in a different repo. Neither repair may merge, push, close issues, change registered root or approve unrelated live permissions/forms.

## Recovery proof conditions
- Next dispatch after each completed repair is fresh read-only hostile review of exact commit. No resumed ended workers.
- Do not accept reviewer shortcuts of arbitrary page limits or small-issue-number uniqueness heuristics.
- Per-repo watermark/failure/overlap, auth cache scope, forced freshness and duplicate-mutation transport behavior remain explicit checks.
- Isolated real V2 reply fixtures may be used only without shared session/DB/service effects; no real shared-host session creation/reply is authorized in repair brief.
- State receipt: status-l4-halts-2026-10-07.md. Nothing pushed, merged from Batch 2, closed or human-approved.
