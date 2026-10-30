# Issue #48 Web/Mobile Simplified Views — L4 Acceptance Gate

- **Surface:** Standalone web/mobile board (`web/**`)
- **Branch:** `feat/issue-48-web-simple-views`
- **Accepted Candidate SHA:** `d5a205da26827d0555824339fcb14c9a39d7af7f` (commits `258e26f`, `436c03e`, `566b138`, `22da7f4`, `d28caef`, `e576083`, `d5a205d` on top of `e630a9ddd044389787a66f458b1ee49c944db250` and merged `#47` `268bd28738443863d6a58b5e4500ad20b6aaa05f`)
- **Correction Builder:** `ses_2f0b57e640bd20df38bc4158` (`9router/genius`)
- **Independent Hostile Recheck:** `ses_48cf0489bcd90c7a9d52bacd` (`9router/genius`)
- **Spec Compliance Verdict:** PASS
- **Quality Verdict:** APPROVED
- **State:** ACCEPTED, AWAITING BATCH (ready for non-master staging integration with `#48` panel `c9fb61b` and `#47` `268bd28`)

## Hostile Findings Closure (`F1`–`F10`)
- **F1 (Blocker — D55 confirmed native transfer):** CLOSED (`web/server/github.ts:445-496`, `web/server/app.ts:1392-1496`, `web/public/app.js:212-220,1158-1186,1317-1322`). Unconfirmed `PUT .../move` returns `400 confirmation_required` (`0` writes); cancel sends `0` requests; confirmed move calls GraphQL `transferIssue(input:{issueId,repositoryId})` with `0` copy/comment/close calls, returns canonical target repo/number/URL, preserves same-number issues in other repos, keeps source open on `403`, and blocks blind retry on `502 write_outcome_unknown`.
- **F2 (Blocker — offline queue safety & cold offline reload):** CLOSED (`web/public/app.js:495-631,1101-1115,1299-1310,2367-2371`). Ambiguous post-commit responses mark the queue item `uncertain` (`(offline · outcome unknown)`) and never auto-resend on reload/reconnect; in-flight local edits during sync flush via conflict-safe `PUT .../draft`; same-title UI submissions retain distinct queue entries; cold offline reload under active `/sw.js` renders the local draft queue without faking authentication.
- **F3 (High — byte-preserving terminal order marker):** CLOSED (`web/server/board.ts:37-162`, `web/server/app.ts:1498-1514`). Fence- and indent-aware line scanner splices only the final unfenced `<!-- board-order: ... -->` line, preserving fenced/indented examples, duplicate headings, CRLF line endings, and trailing two-space hard breaks byte-for-byte.
- **F4 (High — repo-qualified identity, readGeneration, buffers, boolean `checked`):** CLOSED (`web/public/app.js:105-146,160-162,756-856,1145-1174,1270-1293`). `el()` sets boolean properties (`checked`, `disabled`, `hidden`, `selected`), `publishMutation` qualifies updates by `repo + number` and `readGeneration`, checkbox toggles preserve unsaved drawer buffers, reorder preserves unsaved inline draft edits, and external refresh never rebinds stale buffer fingerprints.
- **F5 (Blocker — free manual reorder & precision rebalance):** CLOSED (`web/public/app.js:1189-1258`, `web/server/app.ts:1087-1391`). Downward moves across unmarked, mixed, and equal markers succeed; `55` midpoint bisections auto-rebalance cleanly; stale neighbour fingerprints fail with `409`; partial multi-issue failures return `502 write_outcome_unknown` with `updatedIssues`.
- **F6 (High — Pending items human-task completion & GitHub link):** CLOSED (`web/server/board.ts:547-552`, `web/public/index.html:142`, `web/public/app.js:1674-1683,1783-1785`). Interactive `#human-list` checkboxes update Markdown checklist items via conflict-safe `PATCH` without closing the issue, and `#N on GitHub ↗` links to the issue.
- **F7 (Medium — fence-aware dependency parser):** CLOSED (`web/server/board.ts:172-183`). Checklist/bullet/numbered `Blocked by` / `Depends on` / `Requires` items parse outside fenced/indented code blocks only.
- **F8 (Medium — 360px phone layout & a11y):** CLOSED (`web/public/app.js:419-468,1259-1266,1446-1448,2224-2228`, `web/public/theme.css:895-995`). Multiline draft descriptions auto-size (`0` clipping), compact phone chrome fits `2.5+` rows at `360×800` and `3` rows at `390×844`, all drawer buttons are `>=44×44px`, and closing the drawer restores focus to the opener.
- **F9 (Blocker — `#47` merge & per-fixture directory isolation):** CLOSED (`web/server/app.ts:400-425`, `web/tests/helpers.mjs:12-27`, `web/tests/hosting.test.mjs:476-579`). Zero diff on `web/server/{auth,config}.ts` and `web/public/sw.js` vs `#47` `268bd28`; every test fixture uses a dedicated `mkdtempSync` directory cleaned up on `app.close()`.
- **F10 (Medium — standalone web `batch-align` route removed):** CLOSED (`web/server/app.ts:689-691`). Returns `404 not_found` with `0` GitHub writes.

## Verification Summary
- `npm run typecheck`: exit `0`
- `npx tsc -p web/tsconfig.json`: exit `0`
- `npx esbuild web/server.ts --bundle ...`: exit `0` (`163.4kb`)
- `node --test web/tests/*.test.mjs`: `449/449` pass (exit `0`)
- `node --test --test-concurrency=1 test/*.test.js`: `553/553` pass (exit `0`)
- `node web/tests/issue-48-browser-verify.mjs`: `14/14` pass, `0` page errors (exit `0`)
- `node .agents/run/issue-48-web-recheck/verifications/recheck-hostile.mjs`: `12/12` pass incl. 20 view×sort combinations, `0` page errors (exit `0`)
- `node web/tests/browser-verify.mjs`: exit `0`
- Proof Paths:
  - `.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-hostile/verifications/proof.md`
  - `.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-correction/verifications/proof.md`
  - `.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-recheck/verifications/proof.md`

## Disclosures for Batched L5 Human Validation
- Multi-issue GitHub reorder rebalance is sequential and conflict-checked per issue, not an atomic multi-issue transaction (partial failures return `502 write_outcome_unknown` with `updatedIssues` so the UI reconciles actual persisted order).
- Project rename overrides are stored per surface (extension vs standalone web board).
- Native no-JS HTML form POST on login is unsupported (`400 invalid_json`, deferred Finding A from `#47`).
- Live GitHub GraphQL `transferIssue` permissions on real repositories, physical phone hardware touch feel, screen-reader voice output, and OS password-manager autofill prompts were not exercised in synthetic tests.
