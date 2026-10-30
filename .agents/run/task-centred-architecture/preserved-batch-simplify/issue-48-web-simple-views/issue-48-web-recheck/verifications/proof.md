# Deep Verification Result

**Task:** Independent hostile recheck of Issue #48 web/mobile simplified views Correction Round 1 (`F1`–`F10` and `#47` integration).
**Candidate:** `d5a205da26827d0555824339fcb14c9a39d7af7f` on branch `feat/issue-48-web-simple-views` (commits `258e26f`, `436c03e`, `566b138`, `22da7f4`, `d28caef`, `e576083`, `d5a205d` on top of `e630a9ddd044389787a66f458b1ee49c944db250` and merged `#47` `268bd28738443863d6a58b5e4500ad20b6aaa05f`).
**Status:** PASS (L0–L4 PASS; L5 AWAITING HUMAN)
**Spec Compliance:** PASS
**Quality:** APPROVED
**Timestamp:** 2026-10-29T16:31:00Z
**Reviewer model:** Genius (`9router/genius` from runtime metadata)

---

### Executed Levels
- **L0 Static:** PASS (`npm run typecheck` -> exit `0`; `npx tsc -p web/tsconfig.json` -> exit `0`; `npx esbuild web/server.ts --bundle ...` -> exit `0`; `git diff --exit-code 268bd28738443863d6a58b5e4500ad20b6aaa05f HEAD -- web/server/auth.ts web/server/config.ts web/public/sw.js` -> exit `0`).
- **L1 Unit / Regression:** PASS (`node --test web/tests/*.test.mjs` -> `449/449` pass, `0` fail, `0` skipped, exit `0`; `node --test --test-concurrency=1 test/*.test.js` -> `553/553` pass, `0` fail, `0` skipped, exit `0`).
- **L2 Integration / Storage Isolation:** PASS (Per-fixture `mkdtempSync` directory isolation verified for `sessions.json` and `project-names.json`; stand-in default store `$OPENCHAMBER_DATA_DIR/board/{sessions,project-names}.json` untouched across the full 449-test web suite and 553-test root suite; `#47` session persistence across restart, CSRF-at-rest non-plaintext storage, and password-rotation session invalidation verified).
- **L3 The User's Way (E2E / Browser):** PASS (`node web/tests/issue-48-browser-verify.mjs` -> `14/14` checks pass, `0` page errors, `16` screenshots, exit `0`; `node web/tests/browser-verify.mjs` -> exit `0`; `node .agents/run/issue-48-web-recheck/verifications/recheck-hostile.mjs` -> `12/12` hostile finding & matrix suites pass including all 20 view × sort combinations, `0` page errors, `6` targeted screenshots, exit `0`).
- **L4 Hostile Review (AI):** PASS (`10` prior findings `F1`–`F10` independently re-tested and confirmed `CLOSED`; `0` open blockers, highs, or mediums).
- **L5 Human Validation:** AWAITING HUMAN (combined `#47` + `#48` batch preview awaiting human validation).

---

### Commands, Counts, and Raw Evidence

Working directory: `/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views`
All commands ran with `TMPDIR` and `OPENCHAMBER_DATA_DIR` isolated under `.agents/run/issue-48-web-recheck/verifications/data/`.

| Command | Exit | Summary / Artifact |
|---|---:|---|
| `git diff --exit-code 268bd28738443863d6a58b5e4500ad20b6aaa05f HEAD -- web/server/auth.ts web/server/config.ts web/public/sw.js` | `0` | Zero diff on protected `#47` files (`logs/protected-47-diff.log`) |
| `npm run typecheck` | `0` | Root TypeScript check clean (`logs/typecheck.log`) |
| `npx tsc -p web/tsconfig.json` | `0` | Standalone web TypeScript check clean (`logs/web-typecheck.log`) |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=.agents/run/issue-48-web-recheck/verifications/bundle/server.mjs` | `0` | `163.4kb` bundle built (`logs/build.log`) |
| `node --test web/tests/*.test.mjs` | `0` | `449/449` pass, `0` fail, `0` skipped (`logs/web-tests.log`) |
| `node --test --test-concurrency=1 test/*.test.js` | `0` | `553/553` pass, `0` fail, `0` skipped (`logs/root-tests.log`) |
| `node web/tests/issue-48-browser-verify.mjs` | `0` | `14/14` browser checks, `0` page errors, `16` screenshots (`logs/issue-48-browser-verify.log`) |
| `node .agents/run/issue-48-web-recheck/verifications/recheck-hostile.mjs` | `0` | `12/12` hostile & 20-combo checks, `0` page errors, `6` screenshots (`logs/recheck-hostile.log`, `recheck-results.json`) |
| `node web/tests/browser-verify.mjs` | `0` | Obscura CDP standalone verification clean (`logs/browser-verify.log`) |

---

### Hostile Findings Status (`F1`–`F10`)

| ID | Severity | Status | Exact Locations | Empirical Verification Summary |
|---|---|---|---|---|
| **F1** | Blocker | **CLOSED** | `web/server/github.ts:445-496`, `web/server/app.ts:1392-1496`, `web/public/app.js:212-220,1158-1186,1317-1322` | D55 confirmed transfer verified: unconfirmed `PUT .../move` returns `400 confirmation_required` (`0` writes); browser cancel sends `0` requests and resets select; confirmed move invokes GraphQL `transferIssue(input:{issueId,repositoryId})` with `0` REST issue creates, `0` comments, and `0` close patches, returning canonical `owner/beta#2` while keeping same-number `owner/beta#1` open and untouched; GraphQL `FORBIDDEN` returns `403 transfer_forbidden` keeping source open; `500`/ambiguous response returns `502 write_outcome_unknown`, adds `owner/alpha#1` to `state.uncertain`, blocks blind retry (`0` GraphQL calls), and reconciles on refresh. |
| **F2** | Blocker | **CLOSED** | `web/public/app.js:495-631,1101-1115,1299-1310,2367-2371` | Queue entries track `id`, `revision`, `state`, `uncertain`, `confirmedNumber`, and `confirmedFingerprint`. In a 3-draft batch where the 2nd response is aborted after server commit, counts after reconnect/re-sync are `[1, 1, 1]` (uncertain item is held with `(offline · outcome unknown)` badge and never auto-resent). In-flight edits during sync increment `revision` and flush via conflict-safe `PUT .../draft` (`1` issue total). Duplicate offline titles with distinct descriptions retain `2` separate entries. Cold offline reload under active `/sw.js` renders `#board-view` with `state.csrf === null`, `#signout-btn` hidden, and local drafts editable (`screenshots/recheck-cold-offline-reload-390.png`). |
| **F3** | High | **CLOSED** | `web/server/board.ts:37-162`, `web/server/app.ts:1498-1514` | `scanBodyLines` and `locateTerminalOrderMarker` ignore fenced (`` ``` `` / `~~~`) and 4-space/tab indented code blocks, splicing only the terminal unfenced `<!-- board-order: ... -->` line. CRLF bodies with fenced `<!-- board-order: 42 -->`, indented `<!-- board-order: 99 -->`, lookalike `<!-- board-ordering: 7 -->`, duplicate `## Overview` headings, and trailing two-space hard breaks (`  \r\n`) survive `parseOrderMarker`, `stripOrderMarker`, `setOrderMarker`, `PUT .../section`, and `PUT .../order` with zero bare `\n` bytes. |
| **F4** | High | **CLOSED** | `web/public/app.js:105-146,160-162,756-856,1145-1174,1270-1293` | `el()` sets boolean DOM properties (`node[key] = Boolean(value)`), so `- [ ]` renders with `checkbox.checked === false` and `getAttribute('checked') === null`. `toggleMarkDone` and `toggleChecklistItem` route through `publishMutation` qualified by `sameIdentity` (`repo + number`) and `generation === state.readGeneration`: marking `owner/beta#1` done leaves `owner/alpha#1` open, and a delayed `owner/beta#1` response does not overwrite an active `owner/alpha#1` drawer. Unsaved drawer overview and question answers survive checkbox toggles; unsaved inline draft edits survive reorder and save cleanly; external refresh does not rebind stale inline buffer fingerprints (surfaces `409 Conflict`). |
| **F5** | Blocker | **CLOSED** | `web/public/app.js:1189-1258`, `web/server/app.ts:1087-1391` | Downward manual moves in Chromium across all-unmarked `[null, null, null]`, marked-into-unmarked `[1000, null, null]`, and equal markers `[1000, 1000, 1000]` all succeed (`['Second draft', 'First draft', 'Third draft']`; `screenshots/recheck-reorder-*.png`). `55` successive midpoint bisections all return `200` (automatic 1000-step rebalance on precision exhaustion). Stale neighbour fingerprints return `409 conflict` with `0` writes. Mid-flight failure on the 2nd issue during multi-issue rebalance returns `502 write_outcome_unknown` with `updatedIssues` containing the 1st issue's updated state. |
| **F6** | High | **CLOSED** | `web/server/board.ts:547-552`, `web/public/index.html:142`, `web/public/app.js:1674-1683,1783-1785` | Pending items drawer renders interactive `#human-list input[type="checkbox"]` (`lineIndex`-backed conflict-safe `PATCH` updating `- [x] Approve beta release` while keeping `state === 'open'`), working question option chips, and `<a class="badge github-link" href="https://github.com/owner/beta/issues/1">#1 on GitHub ↗</a>` (`screenshots/recheck-pending-and-drawer-360.png`). |
| **F7** | Medium | **CLOSED** | `web/server/board.ts:172-183` | `listFields` scans `scanBodyLines(description)`, skipping `line.fenced || line.indentedCode`, and matches checklist/bullet/numbered prefixes (`- [ ] Blocked by #2`, `- [x] Depends on #3`, `1. Requires #4` -> `[2, 3, 4]`) while ignoring fenced `Depends on #99` and indented `Depends on #88`. |
| **F8** | Medium | **CLOSED** | `web/public/app.js:419-468,1259-1266,1446-1448,2224-2228,2357-2360`, `web/public/theme.css:895-995` | At `360×800`, `autoSizeTextarea` expands 3-line wrapped descriptions so `clientHeight === scrollHeight === 108` (`0` clipped lines; `screenshots/recheck-multiline-description-360.png`). Compact phone spacing starts row 1 at `413px` (`2.5+` rows visible on `360×800`, `3` rows on `390×844`). All drawer buttons (including `.question-option-btn`) and `.checklist-label` rows measure `>=44×44px` (`0` undersized controls). Closing drawer via `#back-btn` restores focus to opener (`data-issue-key="owner/beta#1"`). |
| **F9** | Blocker | **CLOSED** | `web/server/app.ts:400-425`, `web/tests/helpers.mjs:12-27`, `web/tests/hosting.test.mjs:476-579` | `#47` (`268bd28738443863d6a58b5e4500ad20b6aaa05f`) is merged cleanly; `SessionStore` receives `passwordHash: config.passwordHash` alongside `namesPath`. Every test fixture allocates its own `mkdtempSync` directory (`test-board-*`) and removes it recursively on `app.close()`, isolating both `sessions.json` and `project-names.json`. Stand-in default store remained untouched across all `449` web tests and `553` root tests. |
| **F10** | Medium | **CLOSED** | `web/server/app.ts:689-691` | Standalone web `batch-align` handler and `alignDraftIssue` import are removed; `POST /api/repos/owner/alpha/issues/batch-align` and `POST /api/issues/batch-align` both return `404 not_found` with `0` GitHub writes. |

---

### Inspected Screenshots (`.agents/run/issue-48-web-recheck/verifications/screenshots/`)
- `recheck-multiline-description-360.png`: 360×800 phone draft list showing full 5-line wrapped description without clipping, compact top chrome, and 2.5+ draft rows visible.
- `recheck-pending-and-drawer-360.png`: 360×800 task detail drawer showing `#1 on GitHub ↗` badge link, unchecked `- [ ]` criterion (`checked === false`), and checked `- [x]` criterion.
- `recheck-cold-offline-reload-390.png`: 390×844 cold offline reload under Service Worker showing offline banner, `Cold offline reload idea` draft row with `(offline)` badge, hidden sign-out button, and bottom quick-add form.
- `recheck-reorder-{all-unmarked,marked-into-unmarked,equal-markers}.png`: 390×844 manual downward reorder results (`Second draft`, `First draft`, `Third draft`).
- `issue-48-web-390-844-{simple,cards,kanban,graph,pending,drafts}.png`: all 5 views and draft capture at 390×844 phone viewport.
- `issue-48-web-1280-800-{simple,cards,kanban,graph,pending,drafts}.png`: all 5 views and draft capture at 1280×800 desktop viewport.
- `issue-48-web-360-800-{long-project-drafts,add-row-bottom,view-sheet,empty-filter}.png`: 360×800 long project name truncation, bottom capture form, modal sheet, and actionable empty filter state.

---

### Learnings & Blind Spots
- **DIDN'T WORK:** Initial `recheck-hostile.mjs` probes called `loadConfig` without `BOARD_GITHUB_LOGIN`, hit `/sections/overview` instead of `/section`, tested `stripOrderMarker` without accounting for the preserved `\r\n\r\n` separator before the terminal marker line, and used `(Yes / No)` instead of `[A] Yes [B] No` for `parseQuestionOptions`. **FINALLY WORKED:** Used `browserConfig(fake, ...)` from `helpers.mjs`, called `PUT .../section` with `{ sectionId: 'overview' }`, matched the exact byte-preservation contract (`fencedOnly + '\r\n\r\n'`), and used `[A] Yes [B] No` option syntax.
- **Not Verified (L5 & Environment Boundaries):** Live deployed board (`https://board.workflows.ac`), real GitHub REST/GraphQL API token permissions on real repositories, physical iOS/Android touch ergonomics and subjective phone density feel, screen-reader voice output, and native OS password-manager autofill prompts remain for **L5 Human Validation**.
