# Issue #48 Web Simple Views — Correction Round 1 Verification Proof

## Summary & Verdicts
- **Branch:** `feat/issue-48-web-simple-views`
- **Starting Product Candidate:** `e630a9ddd044389787a66f458b1ee49c944db250`
- **Integrated Branch:** `fix/issue-47-fresh-app-stay-signed-in` (`268bd28738443863d6a58b5e4500ad20b6aaa05f`) merged via normal `git merge --no-ff` at `258e26fc5095d8fb75f5062fb8c8db6a468d70fa` (conflicts in `web/server/app.ts` and `web/tests/helpers.mjs` resolved preserving both `passwordHash: config.passwordHash` in `SessionStore` and `namesPath` in `app.ts`, plus per-fixture `mkdtempSync` directory isolation in `helpers.mjs`).
- **Findings Resolved:** 10 / 10 (`F1`–`F10` closed; 0 open).
- **Hostile Review Artifacts Preserved:** `.agents/run/issue-48-web-hostile/**` untouched.
- **L1–L4 Status:** PASS (`npm run typecheck` exit `0`; `npx tsc -p web/tsconfig.json` exit `0`; esbuild server bundle exit `0`; `node --test web/tests/*.test.mjs` `449/449` pass, exit `0`; `node --test --test-concurrency=1 test/*.test.js` `553/553` pass, exit `0`; `node web/tests/issue-48-browser-verify.mjs` `14/14` checks pass, `0` page errors, exit `0`; `node web/tests/browser-verify.mjs` exit `0`; `node .agents/run/issue-48-web-correction/verifications/verify-all-findings.mjs` `18/18` checks pass, `0` page errors, exit `0`).
- **L5 Status:** `L5 AWAITING HUMAN` (subjective phone simplicity and live GitHub / physical device / installed PWA checks remain for human review).

---

## Resolution of Independent Hostile Findings (`F1`–`F10`)

### F1 [Blocker] — Saved-draft project move (`web/server/github.ts`, `web/server/app.ts`, `web/public/app.js`, `web/tests/fake-github.mjs`)
- **Problem:** Moving a saved draft created a new issue in the target repository, posted a comment, and closed the source issue (`POST /repos/.../issues`, `POST .../comments`, `PATCH ... state:closed`).
- **Fix (D55):**
  - Replaced copy+comment+close in `web/server/app.ts` (`PUT /api/repos/:owner/:repo/issues/:number/move`) with explicit confirmation validation (`confirmed: true` required; returns `400 confirmation_required` with `0` GitHub writes otherwise) and native GitHub GraphQL `transferIssue(input: { issueId, repositoryId })` in `web/server/github.ts` (`getIssueNodeId`, `getRepositoryNodeId`, `transferIssue`), followed by fetching the canonical transferred issue from the target repository.
  - Permission/GraphQL refusal preserves the source issue open with `0` fallback creates/closes (`403 transfer_forbidden` / `422 validation_failed`).
  - Ambiguous post-dispatch transfer failures return `502 write_outcome_unknown` and mark the issue in `state.uncertain` on the client without blind retries.
  - Client `.draft-project` selector in `web/public/app.js` prompts `window.confirm('Transfer draft #' + issue.number + ' to ' + target + ' on GitHub? ...')`; Cancel resets the dropdown to `issue.repository.full` with `0` network requests. Confirmed transfers send `{ target, confirmed: true }`, validate the transferred repository identity in `isValidMutationPayload`, replace the source row (`owner/alpha#1` -> `owner/beta#N`), and migrate any buffered inline edits without touching same-number issues in other repositories.
  - Extended `web/tests/fake-github.mjs` with `/graphql` node-ID lookup and `transferIssue` support (`graphqlHook`, `transferPermissionDeniedRepos`, `transferErrorRepos`).

### F2 [Blocker] — Offline queue safety, revision retention, duplicate titles, and cold offline reload (`web/public/app.js`)
- **Problem:** Response loss after server commit left the item queued as normal so reload/reconnect created duplicate issues; in-flight local edits during sync were discarded; same-title UI submissions were dropped; cold offline reload with active Service Worker showed a login error instead of the local draft queue.
- **Fix:**
  - Queue entries in `saveToOfflineQueue` carry stable `id`, `revision: 1`, `state: 'queued'`, and `uncertain: false`. UI submissions (`saveToOfflineQueue(title, target, description, order)`) never deduplicate by title, preserving same-title drafts with distinct descriptions/orders (while 2-argument legacy calls `saveToOfflineQueue(title, repo)` with no description/order remain backward-compatible with `test/offline-drafts.test.js`).
  - When `syncOfflineDrafts` encounters an ambiguous/network failure (`write_outcome_unknown`, `status >= 500`, or fetch failure), the entry is marked `{ state: 'uncertain', uncertain: true }` and held out of automatic resend on subsequent `syncOfflineDrafts()` calls, reloads, or `online` events while remaining visible/recoverable in the local draft list with an `(outcome unknown)` badge.
  - If a queued draft is edited (`updateOffline` increments `revision`) while its create POST is in flight, `syncOfflineDrafts` detects `latestAfter.revision > sentRevision`, retains the entry in the queue with `confirmedNumber` and `confirmedFingerprint`, and applies a conflict-safe `PUT .../draft` on the next sync instead of dropping the edit or duplicating the issue.
  - On cold offline reload (`!navigator.onLine` when `/api/session` fails in `boot()`), `showOfflineShell()` renders the local draft editor in `Simple list` + `stage:draft` + `Manual order` with a clear offline notice and without pretending authentication succeeded.

### F3 [High] — Byte-preserving unfenced terminal order marker (`web/server/board.ts`, `web/server/app.ts`)
- **Problem:** `parseOrderMarker`/`stripOrderMarker`/`setOrderMarker` matched `<!-- board-order: ... -->` inside fenced code blocks, stripped trailing Markdown hard-break spaces (`  \r\n`), and mixed `\n` into CRLF bodies.
- **Fix:**
  - Added fence-aware line scanning (`findTerminalOrderMarkerSpan`) that ignores fenced code blocks (`` ``` `` / `~~~`) and indented code blocks, locating only the final unfenced own-line `<!-- board-order: ... -->` marker at the end of the body.
  - `stripOrderMarker` and `setOrderMarker` splice only that terminal marker span and preserve the document's line ending (`\r\n` vs `\n`), all fenced marker examples, duplicate headings, lookalike comments (`<!-- board-ordering: 7 -->`), and trailing Markdown hard-break spaces byte-for-byte.
  - Section and whole-body edits in `web/server/app.ts` preserve the existing terminal marker via `parseOrderMarker` + `setOrderMarker`.

### F4 [High] — Qualified identity, generation guards, inline buffer fingerprints, and `el()` boolean `checked` (`web/public/app.js`)
- **Problem:** `toggleMarkDone` and `toggleChecklistItem` matched board rows by bare `issue.number`, lacked read-generation guards, and wiped unsaved overview text; `draftMutation` deleted unsaved inline title/description buffers on reorder; refresh silently rebound stale inline edits to new server fingerprints; `el()` set `checked="false"` attribute so `- [ ]` rendered checked.
- **Fix:**
  - `el()` sets DOM boolean properties (`node[key] = Boolean(value)`) for `checked`, `disabled`, `hidden`, and `selected`, so `checked: false` renders unchecked.
  - Routed `toggleChecklistItem` and `toggleMarkDone` through `publishMutation(response, issue, generation, kind)`, which qualifies board row updates by `sameIdentity(row, issue)`, guards drawer updates by `generation === state.readGeneration && sameIdentity(state.detail, issue)`, and calls `rememberDraft()` / `restoreDraft()` (`renderDetail(false)`) so unsaved overview and question answers survive checkbox toggles.
  - `state.draftEdits` entries store `{ title, description, fingerprint }`. Non-text mutations (`order`, `move`) update the buffered entry's `fingerprint` (and `editKey` on cross-repo transfer) only when the mutation started from that exact `preFingerprint` and left title/description unchanged. External board refreshes never rebase `state.draftEdits` onto a changed server fingerprint, so saving a stale inline edit after another device modified the issue sends the originally observed fingerprint and surfaces a `409 Conflict` while retaining the user's text.

### F5 [Blocker] — Free manual reorder across unmarked, mixed, equal, and precision-exhausted ranks (`web/server/app.ts`, `web/public/app.js`)
- **Problem:** Moving the first unmarked draft down across unmarked drafts (`A, B, C`), moving a marked draft down across unmarked drafts (`A(1000), B(null), C(null)`), or moving across equal markers (`1000, 1000, 1000`) refused with `0` writes; bisecting midpoints >53 times returned `409 Conflict`; stale neighbour fingerprints were not validated.
- **Fix:**
  - Client `reorderDraft` checks whether `previous` and `next` have usable distinct markers (`canUseSingleMidpoint`). When single-midpoint insertion is possible, it sends `previous`, `next`, and observed `neighbours` (`{ repo, number, fingerprint, order }`). When neighbours are unmarked, equal, inverted, or exhausted, it computes a clean `(idx + 1) * 1000` sequence across the list (`updates` for rows whose marker changes + `neighbours` for unchanged rows).
  - Server `PUT /api/repos/:owner/:repo/issues/:number/order` supports both single-issue midpoint updates (with automatic repository rebalance when `midpointOrder(previous, next)` is exhausted or collides) and multi-issue `updates` + `neighbours` initialization/rebalance across single or multiple repositories.
  - Every touched or neighbour-checked issue is fetched fresh and verified against its observed fingerprint before any write; if a later write in a multi-issue rebalance fails after earlier writes succeeded, the server returns `502 write_outcome_unknown` with `partialWrites` and fresh `updatedIssues` so the client reconciles actual persisted order and marks only the failed issue uncertain.

### F6 [High] — Pending items human-task completion controls and GitHub link (`web/server/board.ts`, `web/public/index.html`, `web/public/app.js`)
- **Problem:** Pending items tasks had `0` completion controls for `## Human Tasks` (`#human-list` rendered plain `<li>` text) and no link to the GitHub issue in the detail drawer.
- **Fix:**
  - Included `lineIndex` on `humanTasks` items in `web/server/board.ts`.
  - Updated `#human-list` in `web/public/index.html` to `class="checklist"` and rendered interactive checkboxes via `renderChecklist('human-list', 'human-empty', issue.humanTasks, false)` in `web/public/app.js`, updating the task's Markdown checklist item via conflict-safe `PATCH` without auto-closing the issue.
  - Added `<a class="badge github-link" target="_blank" rel="noopener noreferrer">#N on GitHub ↗</a>` in `detailBadges(issue)` when `issue.htmlUrl` is present.

### F7 [Medium] — Fence-aware dependency parser (`web/server/board.ts`)
- **Problem:** `parseDependencies` missed checklist-prefixed `- [ ] Blocked by #2` and falsely matched `Depends on #2` inside fenced code blocks.
- **Fix:**
  - Stripped fenced and indented code blocks via `stripCodeBlocksForParsing(body)` before scanning lines, and updated the prefix matcher to `^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+\.\s+)?(?:depends on|blocked by|requires)\b` so checklist items, bullets, and numbered lists are recognized while fenced examples are ignored.

### F8 [Medium] — Phone multiline draft descriptions, `>=44px` drawer question buttons, drawer focus restoration, and compact phone chrome (`web/public/app.js`, `web/public/theme.css`)
- **Problem:** 3-line draft descriptions clipped on 360px phones (`clientHeight: 42` vs `scrollHeight: 77`); drawer question option chips were `36px` tall (`<44px`); closing the drawer left focus on `BODY`; phone top chrome and draft rows left only one full draft card visible in a `360×800` viewport.
- **Fix:**
  - Added `autoSizeTextarea` on render, input, view switch, and window resize so multiline draft descriptions expand to fit their content (`clientHeight: 71 === scrollHeight: 71` for a 3-line description at `360px`).
  - Updated `.question-option-btn` in `web/public/theme.css` to `min-height: 44px; min-width: 44px; padding: 8px 12px` (`0` buttons below `44×44px`).
  - Recorded `state.drawerOpenerKey` (`identity(issue)`) and `state.drawerFromDraftBtn` in `openIssueView`, added `data-issue-key` on `.task-row` and `.draft-open-btn`, and restored focus in `restoreDrawerFocus()` when closing the drawer (including guarding `route()` via `state.closingHash` so the `hashchange` event does not clobber restored focus).
  - Compacted `@media (max-width: 600px)` topbar, section header, helper text, and `.draft-row` spacing while keeping all touch targets `>=44×44px`: on `360×800`, top chrome above the first draft row dropped from `528px` to `413px`, and single-line draft row height dropped from `230px` to `147px` (`3` draft rows visible in the first viewport on `390×844` and `2.5+` rows on `360×800`).

### F9 [Blocker] — Merge `#47` and isolate per-fixture storage (`web/server/app.ts`, `web/tests/helpers.mjs`)
- **Problem:** `project-names.json` was derived as `path.join(path.dirname(config.sessionFilePath), 'project-names.json')`; when multiple test servers shared `/tmp`, `project-names.json` collided across fixtures.
- **Fix:**
  - Merged `fix/issue-47-fresh-app-stay-signed-in` (`268bd28738443863d6a58b5e4500ad20b6aaa05f`), preserving `passwordHash: config.passwordHash` in `SessionStore` and `namesPath` in `web/server/app.ts`.
  - Updated `allocateSessionFile()` and `cleanupSessionStorage()` in `web/tests/helpers.mjs` to create a dedicated `fs.mkdtempSync(path.join(os.tmpdir(), 'test-board-'))` directory per fixture and remove the entire temporary directory on `app.close()`, isolating both `sessions.json` and `project-names.json`.

### F10 [Medium] — Standalone web `batch-align` route removed (`web/server/app.ts`)
- **Problem:** Extension-only `POST /api/repos/:owner/:repo/issues/batch-align` and `POST /api/issues/batch-align` remained callable on the standalone web server.
- **Fix:**
  - Removed the `batch-align` route handler and unused `alignDraftIssue` import from `web/server/app.ts`; requests now return `404 not_found` with `0` GitHub writes.

---

## Verification Commands & Exit Codes

| Command | Exit Code | Result Summary |
| :--- | :---: | :--- |
| `npm run typecheck` | `0` | Root TypeScript check clean (`tsc --noEmit`) |
| `npx tsc -p web/tsconfig.json` | `0` | Standalone web TypeScript check clean |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=.agents/run/issue-48-web-correction/verifications/bundle/server.mjs` | `0` | Bundled standalone server (`163.4kb`) |
| `node --test web/tests/*.test.mjs` | `0` | `449 / 449` tests pass (`0` failures) |
| `node --test --test-concurrency=1 test/*.test.js` | `0` | `553 / 553` tests pass (`0` failures, including `test/offline-drafts.test.js`) |
| `node web/tests/issue-48-browser-verify.mjs` | `0` | `14 / 14` Playwright checks pass, `0` page errors, `16` screenshots saved |
| `node web/tests/browser-verify.mjs` | `0` | Obscura CDP standalone board verification passes (`0` page errors) |
| `node .agents/run/issue-48-web-correction/verifications/verify-all-findings.mjs` | `0` | `18 / 18` hostile-finding + `#47` restart checks pass, `0` page errors, `6` targeted screenshots saved |

---

## UX & Layout Measurements (`360×800` & `390×844` Phone Viewports)

- **Initial storage footprint:** `localStorage.length + sessionStorage.length === 0` after sign-in and initial board load.
- **360×800 draft list (`corrected-multiline-description-360.png`):**
  - First draft row top offset: `413px` (reduced from `528px` in hostile review baseline).
  - Row 1 (with 3-line description): `top: 413px, bottom: 589px, height: 176px`; description textarea `clientHeight: 71px === scrollHeight: 71px` (0 clipped lines; baseline was `42px / 77px`).
  - Row 2 (single-line description): `top: 589px, bottom: 736px, height: 147px` (reduced from `230px` in baseline; fully visible inside `800px` height).
  - Row 3: `top: 736px, bottom: 883px, height: 147px` (starts within first `800px` viewport).
- **360×800 detail drawer (`corrected-pending-and-drawer-360.png`):**
  - `#human-list input[type="checkbox"]`: `1` interactive checkbox rendered and verified (`PATCH` updates `- [x] Approve beta`).
  - `#detail-meta a.github-link`: `1` source GitHub link rendered (`#1 on GitHub ↗`).
  - Visible drawer buttons `< 44×44px`: `[]` (`0` undersized targets; question option buttons `Yes`/`No?` are `>=44px` tall).
  - Drawer close focus restoration: `document.activeElement.getAttribute('data-issue-key') === 'owner/beta#1'`.
- **390×844 cold offline reload (`corrected-cold-offline-reload-390.png`):**
  - Service Worker active + context offline + `page.reload()`: `#login-view` hidden (`true`), `#board-view` visible (`true`), `.draft-row-offline` count `1`, single-line secondary strip (`(offline)`, `Alpha`, `↑`, `↓`), and bottom `+ Add a draft...` capture form visible.

---

## Artifacts Produced
- Verification harness & logs:
  - `.agents/run/issue-48-web-correction/verifications/verify-all-findings.mjs`
  - `.agents/run/issue-48-web-correction/verifications/verify-all-findings.json`
  - `.agents/run/issue-48-web-correction/verifications/verify-all-findings.log`
  - `.agents/run/issue-48-web-correction/verifications/issue-48-browser-verify.json`
  - `.agents/run/issue-48-web-correction/verifications/bundle/server.mjs`
- Screenshots (`.agents/run/issue-48-web-correction/verifications/screenshots/`):
  - `issue-48-web-390-844-{simple,cards,kanban,graph,pending,drafts}.png`
  - `issue-48-web-1280-800-{simple,cards,kanban,graph,pending,drafts}.png`
  - `issue-48-web-360-800-{long-project-drafts,add-row-bottom,view-sheet,empty-filter}.png`
  - `corrected-reorder-{all-unmarked,marked-into-unmarked,equal-markers}.png`
  - `corrected-pending-and-drawer-360.png`
  - `corrected-multiline-description-360.png`
  - `corrected-cold-offline-reload-390.png`

---

## Explicit Limitations & Unverified Boundaries
- **Multi-issue reorder non-atomicity:** GitHub REST API does not provide a multi-issue atomic transaction. When lazy marker initialization or rebalance updates multiple issues, each issue is conflict-checked via its ETag/fingerprint before patching; if a mid-flight failure occurs after earlier writes succeed, the server returns `502 write_outcome_unknown` with `partialWrites` and `updatedIssues` so the client reconciles the actual persisted order and flags only the unverified issue.
- **No-JS form submission:** The standalone web app requires JavaScript for `/api/*` fetch mutations; native no-JS HTML form POST is not supported.
- **Environment boundaries not exercised (by rule):** Live deployed board, real GitHub API/GraphQL endpoints, physical mobile hardware, screen-reader voice output, and OS password-manager autofill prompts were not touched and remain for L5 human verification.
