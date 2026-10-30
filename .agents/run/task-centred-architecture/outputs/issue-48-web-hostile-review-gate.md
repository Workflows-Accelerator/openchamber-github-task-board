# #48 web hostile review gate — FAIL / NEEDS-FIXES (correction round 1 dispatched)

Date: 2026-10-29
Candidate: `e630a9ddd044389787a66f458b1ee49c944db250` on base `af9b39c1753db0ca3f6a4314f1942bf66accb62f`
Independent reviewer: `ses_ca48a1f70a74aef3aa647615`, actual `9router/genius` verified.
Verdicts: Spec Compliance `FAIL` | Quality `NEEDS-FIXES` | L5 `AWAITING HUMAN`.
Full proof: `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views/.agents/run/issue-48-web-hostile/verifications/proof.md` (1–255).

## Ranked Findings & Manager Rulings (all required in Correction Round 1)
1. **F1 [Blocker] — Saved-draft project move creates target, comments and closes source (`web/public/app.js:1025-1029`, `web/server/app.ts:1124-1152`):**
   - Ruling: Under D55 (confirmed 2026-10-29), replace copy+comment+close with explicit confirmation + native GitHub GraphQL `transferIssue(input:{issueId,repositoryId})` preserving history. Cancel = 0 writes; permission failure preserves source and shows error without fallback; ambiguous result holds identity and reconciles rather than blindly retrying; returns canonical number/URL/repo and invalidates source/target snapshots without affecting same-number issues.
2. **F2 [Blocker] — Offline queue duplicates committed drafts on response loss/partial sync, drops in-flight edits & same-title drafts, hides queue on cold offline reload (`web/public/app.js:427-481,940-941,1012,2003-2017`):**
   - Ruling: Track stable operation IDs + revisions + state (`queued`, `in_flight`, `uncertain`). Never auto-resend an `uncertain` create; reconcile against fresh server issues or require explicit user action. Retain newer in-flight revisions; never deduplicate by title. On cold offline reload with SW, show local draft queue clearly in offline mode without pretending auth succeeded or caching private API responses.
3. **F5 [Blocker] — Manual order refuses ordinary downward moves across unmarked/mixed/equal drafts (`0` writes), fails after 53 midpoints (`409`), accepts stale/colliding neighbours (`web/public/app.js:822-828,976-991`, `web/server/board.ts:51-53`, `web/server/app.ts:1113-1122`):**
   - Ruling: Permit conflict-safe lazy initialization/rebalance of affected unmarked/equal/precision-exhausted rows so EVERY requested move succeeds. Validate observed neighbour fingerprints/identities; handle partial multi-issue failures honestly and reconcile real order.
4. **F9 [Blocker] — Test fixture storage isolation (`web/tests/hosting.test.mjs:210`, `web/tests/helpers.mjs:26-46`, `web/server/app.ts:406`):**
   - Ruling: Merge `fix/issue-47-fresh-app-stay-signed-in` (`268bd28738443863d6a58b5e4500ad20b6aaa05f`), preserving `passwordHash: config.passwordHash` in `SessionStore` and `namesPath`. Also ensure every test fixture owns a unique directory (or explicit `projectNamesFilePath` / per-fixture `mkdtempSync` directory for `sessionFilePath`) so `path.dirname(sessionFilePath)/project-names.json` never collides across fixtures and cleans up on close.
5. **F3 [High] — `stripOrderMarker`/`setOrderMarker` blanks fenced `<!-- board-order: 42 -->`, inserts `\n` into CRLF, strips hard-break spaces (`web/server/board.ts:36-49`, `web/server/app.ts:1154-1169`):**
   - Ruling: Parse/strip/replace ONLY the terminal unfenced metadata marker line outside code fences, preserving CRLF/LF and trailing hard-break spaces everywhere else.
6. **F4 [High] — Mark Done, checklist, and inline buffers bypass qualified identity, generation, and fingerprint guards; `- [ ]` renders checked (`checked="false"`) (`web/public/app.js:144,633,651-718,963,996-1013`):**
   - Ruling: Qualify issue lookup by `repo + number`, guard late responses by read generation/active drawer identity, preserve unsaved text buffers across checkbox/reorder actions, bind inline buffers to observed fingerprints (do not silently rebind on refresh), and set boolean DOM `checked` property properly so `- [ ]` renders unchecked.
7. **F6 [High] — Pending items renders 0 human-task completion controls and no source GitHub link (`web/public/app.js:1136-1145,1475-1487`):**
   - Ruling: Render explicit human-controlled completion checkboxes/controls for `### Human Tasks:` items (using conflict-safe body section/checklist update, never auto-closing the issue) plus a link to the GitHub issue.
8. **F7 [Medium] — Dependency parser misses `- [ ] Blocked by #2` and reads fenced `Depends on #2` (`web/server/board.ts:58-62`):**
   - Ruling: Strip code fences before parsing dependencies and accept checklist/bullet prefixes (`- [ ] Blocked by #N`, `- Blocked by #N`, `Depends on #N`).
9. **F8 [Medium] — 360px multiline draft descriptions clip (`42/77px`), question option chips are `36px` tall (`<44px`), and closing drawer leaves focus on `BODY` (`web/public/app.js:1001,1895-1937`, `web/public/theme.css:826-886`):**
   - Ruling: Auto-size or expand multiline draft descriptions so lines do not clip, ensure question option buttons have `min-height: 44px`, and restore focus to the opener (or stable board control) when closing the drawer. Also compact top chrome/row spacing where practical for phone simplicity.
10. **F10 [Medium] — Extension-only `/api/.../issues/batch-align` remains callable on web API (`web/server/app.ts:33,689-709`):**
    - Ruling: Remove/disable the standalone web `batch-align` route and unused `alignDraftIssue` import; assert 404/405 with 0 GitHub writes.
