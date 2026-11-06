# Independent findings and coverage (2026-11-06)

Verdicts: **A5 Spec FAIL; A5 Quality NEEDS-FIXES; A4 final FAIL / NEEDS-FIXES.** Green automated suites do not supersede reproduced failures. Severity: P1 risks remote edits or exposes material the requested filter promises to hide; P2 correctness, completeness, usability or localization.

## Findings

1. **P1 OPEN — presentation is not global or parser-safe.** `web/public/app.js:6374–6387` trusts `issue.overview` (server preamble can be YAML), otherwise uses a second ad-hoc regex cleaner rather than the existing section/Markdown pipeline; List has another cleaner at `2058–2071`. `web/public/theme.css:3171–3174` only hides canvas notes and Add-note controls. Native browser: Client shows INTERNAL_AGENT/MODEL/WORKTREE, List INTERNAL_AGENT, drawer editable YAML plus Questions/Human Tasks, Decisions INTERNAL_QUESTION/CLOSED_QUESTION, Blocked INTERNAL_TASK/CLOSED_TASK. Canvas, Operations and Archive had no fixture sentinels visible in this run; that is not a universal leak-proof claim. Reload retains active mode and EN/FR disclaimers accurately call it a presentation filter, not a security boundary. Internal-label/Run controls not exhaustively exercised; no Run integration exists in this step. Projected `column:'draft'` can also classify planned/todo as draft and hide legitimate work; source concern not independently exercised with those statuses in presentation mode. This is a filter-contract failure, not a claim the disclaimer creates access control.
2. **P1 OPEN — A4 409 Retry can overwrite a remote note.** `web/public/app.js:2706` expects `err.payload.fingerprint`; server returns `payload.issue.fingerprint` (`web/server/app.ts:1611–1615`). Immediate Retry keeps old fingerprint, returns 409, zero PATCH. Refresh retains LOCAL_DRAFT but adopts current issue fingerprint; next Retry at `app.js:3123–3145` writes LOCAL_DRAFT over REMOTE_NOTE with one PATCH and no explicit reconciliation/overwrite confirmation. Native browser reproduces remoteRetained:false/localSaved:true. Draft retention is improved, safe conflict resolution is not.
3. **P2 OPEN — two quick task toggles conflict with the user's own action.** `web/public/app.js:5938–5945` disables only clicked checkbox and sends closed-over fingerprint; two distinct same-issue checkboxes clicked synchronously yield one PATCH and visible 409, second task stays unchecked. Server refusal is safe; client does not queue/adopt fingerprint. Double-click Answer produces exactly one PATCH and succeeds.
4. **P2 OPEN — combined cached timestamp is fabricated as current fetch time.** `web/server/app.ts:1257` assigns now() to aggregate even with cached repository issues. Clock advanced 1 second, upstream issue-list count stayed 1, fetchedAt advanced from 00:00:00 to 00:00:01. Failed-repository response preserves partial/failures but reports 00:01:01 as fetch time of stale data. Repository-scoped cache timestamp remains stable in independent test.
5. **P2 OPEN — Archive does not fetch closed history independently.** `web/server/app.ts:1263–1294` slices bounded state=all board results; default GitHub page cap is 10 × 100 (`web/server/github.ts:167–168`). Synthetic 1000-open + closed #1001 gives totalClosed:0, hasMore:false, truncated:true, partial:true; offset 1000 still empty. Combined issue cap further limits available history. No dedicated state=closed request occurs. Sorting and duplicate-free pages pass only within fetched subset. `web/public/app.js:6080–6153,6157–6188` ignore partial/truncated/failures; API metadata existing is not a user-visible warning. UI warning absence established by source inspection, not a special partial-response screenshot.
6. **P2 OPEN — Blocked predicate/count disagreement and closed items remain actionable.** `web/public/app.js:5655–5670` excludes question-only items from sidebar count, `6006–6012` includes them in section. Browser sidebar 3 versus heading 4; question-only card has no Human Tasks. Decisions `5771–5772` and Blocked omit state filtering, so closed #2 appears with Answer/checkbox controls. Presence of controls reproduced; writing that closed fixture not attempted.
7. **P2 OPEN — A4 marker set/strip not byte-identical for every original.** `web/server/board.ts:230–249,372–378`: "Plain" restores "Plain\n"; whitespace-only " \n\n" restores empty. Bodies already ending LF/CRLF blank lines round-trip in probe. Existing test gained final CRLF when prefix assertion became equality, removing original no-final-newline coverage; see test accounting. No arbitrary whitespace repair attempted in this audit.
8. **P2 OPEN — French/compact presentation incomplete.** `web/public/index.html:194,212,230,270–277,301` retains English loading/status headings; `web/public/app.js:6153,6188` hard-codes English errors. Actual French browser table shows Draft/Backlog/Todo/Planned/In Progress/Needs Human/In Review/Done. 401/500 Operations/Archive errors are English. French note Retry is localized, generic failure notice remains English. At 360px the Client disclaimer splits “Presentation” midword (`theme.css:3139–3167`, screenshot 20); authentic repeat capture was byte-identical. No document horizontal overflow in 24 French Decisions/Blocked/Operations/Archive width/theme combinations, but that is not proof of readable disclaimer or below-fold table.
9. **P2 OPEN — nonfinite paging response.** `web/server/app.ts:1278–1280` only rejects NaN/negative; offset=Infinity serializes to null, status 200. NaN, negative, huge finite and fractional tested cases return finite normalized values; huge offset legitimately returns no items.
10. **P2 FIXED — Operations workflow grouping.** `web/server/app.ts:1376` now prefers explicit statusLabel over coarse board column. Before fix, planned count was 0 rather than 1; after fix, unlabelled/planned/review items each counted once per qualified repository. Commit `47bda6ddfa235a290177051b498fb450f35e7eff`; same regression test red then green, no matcher changed. Eight tests added in that commit. Post-fix screenshots 09/10/11/12/24 show 1 draft, 1 backlog, 2 todo, 0 planned, 1 in-progress, 1 needs-human, 0 review, 2 done for generator's 8-issue fixture.

## Reopen policy (unchanged)

A5 scope #4 explicitly approves a user-facing Reopen action. General issue-lifecycle Stage 9 is terminal for autonomous issue management and has no reopening transition; it does not negate the approved manual UI action. Destination `status:backlog` in `web/server/app.ts:2191` is not explicitly specified by A5 or D18, so exact destination remains an owner/morning-review policy question. No claim of owner approval; no product change; no real issue reopened. Fake HTTP confirms done is removed, state opens, backlog assigned.

## Coverage matrix against extra-focus items

| Item | Verdict | Reproduced evidence / limit |
|---|---|---|
| 1a Answer missing/stale fingerprint, malformed JSON | PASS | Actual HTTP 400/409/400; zero PATCH per refusal, independent test and final TAP. |
| 1b Human-task missing/stale fingerprint, malformed JSON | PASS | Same; six non-boolean completed values rejected; stale index after inserted task 409, zero PATCH. |
| 1c Reopen missing/stale fingerprint, malformed JSON | PASS | Same independent route matrix. |
| 1d Label-remove POST missing/stale fingerprint, malformed JSON | PASS | Same independent route matrix. |
| 1e Label-remove DELETE missing/stale fingerprint, malformed JSON | PASS | Same, JSON body supplied with current query fingerprint for malformed case. |
| 1f Double-click Answer | PASS | Native DOM two clicks, fake actual PATCH count 1, answer saved. |
| 1g Two quick distinct task toggles | FAIL | Own-action 409 and only first checkbox persisted; finding 3. |
| 2a Global presentation Canvas/List/drawer/Decisions/Blocked/Operations/Archive | FAIL | Findings 1/6, native visible sentinel evidence in browser.json. |
| 2b Saved presentation toggle/reload/exit | PASS | Native reload active, behavioral VM EN/FR tests restore mode and rows, data unchanged. |
| 2c Disclaimer EN/FR | PASS | Browser exact visible strings state not a security boundary. |
| 2d Reuse Markdown/section parsers rather than second cleaner | FAIL | Existing window.renderMarkdown path used by notes, but new preview cleaner is separate regex/trust path. |
| 2e Every hidden marker/internal label/Run/worktree control across every view | NOT RUN | Sentinels cover YAML/notes/questions/tasks; full control inventory not browser-exercised. |
| 3a Cached real fetch time | FAIL | Combined fetchedAt advances with unchanged upstream list count. Repo cache case PASS. |
| 3b Partial/truncated/failed metadata shown | FAIL | API preserves flags/failure message (PASS subcase), clients ignore them (source). |
| 3c Dedicated bounded closed fetch and reachable older history | FAIL | No state=closed request; closed #1001 unreachable beyond all-issue bound. |
| 3d Recent-first closure order/no duplicates | PASS | Within fetched subset: pages concatenate [2,3,1]. Does not repair completeness. |
| 3e Invalid paging NaN/negative/huge/fractional/nonfinite | FAIL | First four normalized, Infinity offset becomes null; finding 9. |
| 3f Closed7Days uses closure only | PASS | Old closed issue edited today excluded in independent API test with distinct timestamps. |
| 3g Every fetched issue counted once in status matrix | PASS | After 47bda6d, totals 4 alpha + 1 beta; explicit planned/review and no label handled. |
| 3h Oldest in-progress wording does not claim duration in state | PASS | UI says Oldest open in-progress and renders createdAt-relative issue age, not days-in-progress. |
| 3i Same issue number in separate repositories | PASS | Independent Operations fixture retains alpha#1 and beta#1 counts. Cross-repository browser links NOT RUN. |
| 4 Reopen contract review | PASS | Review complete; manual action approved, exact backlog destination unresolved, unchanged. |
| 5a Human-task byte preservation | PASS | LF/CRLF/BOM/fences/indented code/duplicate text/two-space nested list exact comparison; missing section rejects. |
| 5b Label absent on issue / repository | PASS | Absent and security-label requests refuse plainly with zero PATCH; fake does not model full label catalog. Label absent from entire real repo NOT RUN. |
| 5c Label removal preserves every other label | PASS | Exact outgoing labels payload ['status:todo','bug']; existing DELETE success test also passes. |
| 6a A4 proof wording carry-over | PASS | Display-only checkbox wording present; no live behavior changed. |
| 6b A4 set+strip body identity | FAIL | Two original-body classes still change; existing trailing blank lines PASS. |
| 6c Note 500/upstream socket failure retains draft + Retry EN/FR | PASS | Four native probes retain exact DRAFT values and Retry/Réessayer; actual fake PATCH attempts 1 each. Socket destruction is upstream transport failure, not browser offline. |
| 6d Note 409 draft retained, refresh retained | PASS | Native LOCAL_DRAFT survives initial 409 and explicit Refresh; Retry present. |
| 6e Note Retry after 409 preserves remote edit | FAIL | Refresh then Retry overwrites REMOTE_NOTE without reconciliation. |
| 6f Timed background poll, 409 Retry in both languages, full page-reload draft persistence | NOT RUN | Explicit Refresh tested; no claim of durable draft storage or complete language/failure cross-product. |
| 7 Test inventory/count/reversion sensitivity | PASS | independent/test-accounting.md lists 23 added/changed tests, helper changes and limitations; no full mutation run. |
| 7 .skip/.todo | PASS | Zero matches in test/ and web/tests/; final TAP skipped/todo 0. |
| 8a All 24 supplied screenshots inspected | PASS | Original 24 and six independent artifacts read; five changed Operations assets re-read. Manifest lists exact paths/dimensions/hashes. |
| 8b Regenerated incorrect Operations proof | PASS | Five post-fix captures with actual saved theme preference and native viewport. |
| 8c All visual acceptance dimensions | FAIL | Client 360 disclaimer split and English French statuses; scroll/below-fold not certified by static crops. |
| 8d 360/768/1280 × light/dark French section DOM layout | PASS | 24 combinations; zero document horizontal overflow, actual app assets, screenshots disabled in latest run. |
| 8e Complete EN/FR width/theme screenshot cross-product | NOT RUN | Original suite has subset in EN, two French desktop captures; not every language/theme/view combination pictured. |
| 8f Long issue titles | PASS | Native long-title fixture wraps with no document overflow in section DOM matrix. Drawer/Canvas narrow long-title matrix NOT RUN. |
| 8g Empty section views | NOT RUN | Not independently exercised in final native browser audit; no inferred PASS from fixture lists. |
| 8h Each data section 401/500 | FAIL | Operations/Archive show English errors; Decisions/Blocked reuse snapshot with no new fetch/no failure indication. This is not evidence a direct browser 401 response was handled in those views. |
| 8i Each section browser offline | NOT RUN | Network.emulateNetworkConditions unsupported/timed out; omitted and documented. Canvas/List/drawer/Client failure matrix also NOT RUN. |
| 8j Console/CSP diagnostics | PASS | Latest completed native run exceptions:[], consoleErrors:[], CSP:[] for observed events; no claim of all possible paths. |
| 8k Prohibited terms/emoji/button double-plus | FAIL | Full changed-file scan finds forbidden terms in existing test descriptions/regex and original A5 proof; no emoji matches. Literal ++ are increment operators, not UI duplication. No plus-icon-plus-text duplicate found by source inspection. |
| 8l Native screenshot automation fidelity | PASS | Native CDP targets and viewport controls, app loaded directly, fake GitHub only application-data source; latest theme capture uses saved tb_theme_mode then reload; no script/style tags, CSS overrides or fake DOM injected. Automation uses Runtime.evaluate to click/set input/preferences/read DOM. Earlier screenshots used direct theme attribute mutation; those unrecaptured theme claims are historical, not newly certified. |
| 8m Browser credential non-disclosure exhaustive scan | NOT RUN | Only synthetic credentials used; raw evidence does not include real credentials. No exhaustive independent DOM/storage secret audit claimed. |
| 9 Honest coverage and final suites | PASS | This matrix, raw logs and separate A4 verdict. |
| Live GitHub writes / release / production switch | NOT RUN | Forbidden by audit brief; no pushes, production changes or dependency additions. |

## Screenshots and automation limits

`independent/screenshots.md` lists all 30 committed paths with dimensions and SHA-256. Original 01–08 show Decisions/Blocked in both themes and responsive widths; 08 cuts off lower content, not proof of scrolling. Regenerated 09–12 show corrected status distribution; 12 table is below fold. Original 13–16 show Archive tabs; do not prove long history completeness. Original 17–20 Client pages have no hostile YAML fixture, so their clean-looking preview did not establish filtering. Screenshot 20 repeat capture retains midword disclaimer split. 21–22 Discussions honestly explain not configured and provide navigation. 23 French Decisions visibly exposes questions with active presentation. 24 French Operations retains English status headers. Original warm-paper/light and dark aesthetics are visible, not evidence of full localization.

Independent `presentation-operations.png` is pre-47bda6d and still has wrong status counts; retained as historical evidence only. Five regenerated original Operations captures replace it for post-fix metrics. `task-toggle-conflict.png` and presentation Client/Decisions/Blocked/Archive captures illustrate reproduced findings. Canvas/List/drawer screenshot attempts intermittently hung (`Page.captureScreenshot` / Runtime.evaluate timeout); do not treat absent images as PASS. Latest completed browser run uses AUDIT_NO_SHOTS=1 and preserves DOM/actions/network evidence. No installed image-composition package; none added.

## Commands and interpretation

- `timeout 900 npm test`: exit 0, 618/618. Raw `raw/npm-test.log`.
- `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs`: exit 0, 559/559. Raw `raw/web-test.log`.
- `timeout 600 npm run typecheck`: exit 0. Raw `raw/typecheck.log`.
- `timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs`: exit 0. Raw `raw/browser-final.log`, observations `browser.json`. Exit means harness completed, not product PASS.
- `timeout 120 node scripts/audit-a5-data.mjs`: exit 0. Raw `raw/data-final.log`, observations `data.json`; explicit FAIL entries are product findings.
- `timeout 120 node --test --test-timeout=30000 web/tests/a5-audit.test.mjs`: before product fix exit 1 (7 pass/1 fail); after fix exit 0 (8/8). Raw `raw/status-before-fix.log`, `raw/status-after-fix.log`.
- `timeout 60 node --test --test-timeout=30000 web/tests/a5-presentation-audit.test.mjs`: exit 0 (2/2), `raw/presentation-targeted.log`.
- Five-image Operations regeneration command and output: `raw/operations-screenshots.log`; selected via A5_SCREENSHOT_NAMES, timeout 300, exit 0. Repeat Client capture timeout 100, exit 0: `raw/client-screenshot.log`.

## DIDN'T WORK / FINALLY WORKED

- DIDN'T WORK: initial Operations test failed `0 !== 1` for planned. FINALLY WORKED: prefer explicit workflow status in 47bda6d; unchanged test 8/8, final suite 559/559.
- DIDN'T WORK: initial data probe hit unqualified scoped route and counted fake request `.url`; failure metadata lookup threw `TypeError: Cannot read properties of undefined (reading 'map')`. FINALLY WORKED: explicit `/api/combined/operations` and fake request `path`/`query`; final completed probe records real cached-time/history failures.
- DIDN'T WORK: Network.emulateNetworkConditions timed out. FINALLY WORKED: omit unsupported offline method, record NOT RUN; upstream socket-destruction note probe completed but is not equivalent coverage.
- DIDN'T WORK: Page.captureScreenshot intermittently timed out on Canvas/List/drawer/narrow combinations; later Runtime.evaluate could also time out. FINALLY WORKED: retain six earlier authentic images, disable shots for completed native DOM/action matrix, regenerate selected original Operations/Client assets independently.
- DIDN'T WORK: matrix reload after note/Canvas run produced `Error: Wait failed: reload matrix`. FINALLY WORKED: navigate List before reload; repeated final harness exit 0.
- DIDN'T WORK: overlapping auditor's earlier question success request returned 400 instead of expected 200 in untrusted log. FINALLY WORKED: do not claim that run; fresh refusal tests plus native double-Answer prove current question path, final suites rerun. Original overlapping source cannot be recovered, so exact earlier cause remains unverified.

---

## Final independent repair audit (2026-11-06, 81ed5b6..ddfaa2c)

Final verdicts after independent audit of repair range `81ed5b6..175af85` and contained defect fixes in `ddfaa2c` (`ddfaa2c92819e5851b2579065570630cf28609bd`):
- **A5 Spec Verdict:** `PASS`
- **A5 Quality Verdict:** `APPROVED`
- **A4 Spec Verdict:** `PASS`
- **A4 Quality Verdict:** `APPROVED`

Historical failed logs (`raw/data-final.log`, `raw/browser-final.log`, `raw/status-before-fix.log`, `raw/overlap-untrusted-added.log`, and `raw/browser-175af85-historical.json`) are preserved in `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/`.

### Resolution of original 9 findings + 7 additional defects uncovered at `175af85` and fixed in `ddfaa2c`

1. **Finding 1 (P1 FIXED — Global presentation mode & `isDraftIssue` status preservation):**
   - `f2439fd` + `ddfaa2c` (`web/public/app.js:1705-1713`, `6822-6896`): Client Presentation Mode strips YAML front matter via `stripFrontMatter`, renders overview through `window.renderMarkdown`, hides open questions, human tasks, internal labels (`ready-to-run`), worktree metadata, and canvas notes across all views (`list`, `canvas`, `drawer`, `decisions`, `blocked`, `operations`, `archive`, `client`), and re-applies localized strings when switching EN/FR.
   - At `175af85`, `isDraftIssue` still tested `issue.column === 'draft'`, which hid `status:planned` and `status:todo` tasks because `buildBoardIssue` projects those into coarse `column: 'draft'`. Fixed in `ddfaa2c` (`web/public/app.js:1705-1713`) so only explicit `status:draft` (or unlabelled draft-column items) are treated as draft. Verified in `scripts/audit-a5.mjs` (`leaked: []` across all views, `plannedVisible: true`, `todoVisible: true`).
2. **Finding 2 (P1 FIXED — A4 note 409 conflict retention, refresh persistence, and explicit Overwrite):**
   - At `175af85`, `f2439fd` added `Use remote` / `Overwrite` buttons on initial 409, but refreshing the board while `LOCAL_DRAFT` was open cleared `hasConflict` and adopted the remote fingerprint, so clicking `Retry` still overwrote `REMOTE_NOTE` with `1 PATCH` (`raw/browser-175af85-historical.json`: `remoteRetained: false, localSaved: true`). Additionally, detaching `.canvas-note-textarea` during `refresh()` fired a synthetic `blur` event that triggered `commitSave(false)`.
   - Fixed in `ddfaa2c` (`web/public/app.js:3280-3355`, `3380`, `3386-3435`): `state.noteDraftEdits` persists `{ text, baseText, conflict, conflictFingerprint }` across refreshes, blocking `Retry` (`PATCH: 0`, `remoteRetained: true`, `localSaved: false`) until explicit `Overwrite` (`PATCH: 1`, `overwrittenText: "LOCAL_DRAFT"`), and `blur` ignores detached `noteEl`.
3. **Finding 3 (P2 FIXED — Rapid consecutive human-task checkbox toggles):**
   - At `175af85`, `f2439fd` added `humanTaskQueues[key]` but disabled all `.human-task-checkbox` inputs synchronously on the first click and closed over `issue.fingerprint` outside the queue callback, so a synchronous second click in the browser was ignored (`PATCH: 1`, `checked: [true, false]` in `raw/browser-175af85-historical.json`).
   - Fixed in `ddfaa2c` (`web/public/app.js:6188-6252`): only the clicked checkbox is disabled before its queued turn and `currentIssue.fingerprint` is read inside the serialized queue task. Browser probe `two quick task toggles` now records `PATCH: 2`, `checked: [true, true]`, `notice: ""`.
4. **Finding 4 (P2 FIXED — Combined cached timestamp accuracy):**
   - Fixed in `19bc8c9` (`web/server/app.ts:1208`, `1299`, `1506`): combined board and operations `fetchedAt` compute `new Date(Math.min(...repoFetchedTimestamps)).toISOString()` from contributing repository caches rather than `now()`. Verified PASS in `node scripts/audit-a5-data.mjs` (`advancedWithoutUpstreamFetch: false`, `failureFabricatedFreshFetchTime: false`).
5. **Finding 5 (P2 FIXED — Dedicated closed archive fetch and partial/truncated warning banners):**
   - Fixed in `19bc8c9` (`web/server/app.ts:1178-1197`, `1311-1335` and `web/public/app.js:6595-6607`, `6674-6686`): `repositoryClosedIssues` issues dedicated `state=closed` queries so closed issue `#1001` is reached beyond 1,000 open issues (`totalClosed: 1`, `closedNumbers: [1001]`), and `#operations-warning` / `#archive-warning` display localized warning banners when `partial`, `truncated`, or `failures` are present.
6. **Finding 6 (P2 FIXED — Blocked/Decisions predicates and closed-issue filtering):**
   - Fixed in `f2439fd` (`web/public/app.js:1715-1725`): `isIssueBlocked` and `isIssueDecision` strictly exclude `issue.state === 'closed'`, and sidebar badge counts match section card counts (`sidebarBlocked: 2`, `headingBlocked: "2"`, `closedInBlocked: false`, `closedInDecisions: false`).
7. **Finding 7 (P2 FIXED — Exact byte identity in `setCanvasMarker` / `stripCanvasMarker`):**
   - Fixed in `b7f1517` (`web/server/board.ts:242-265`, `395-413`): `;sep=N` records exact preceding newline separator count so `stripCanvasMarker` restores all 5 test classes (`"Plain"`, `"Plain\n"`, `"Plain\n\n"`, `"Plain\r\n\r\n"`, `" \n\n"`) byte-for-byte (`equal: true` in `node scripts/audit-a5-data.mjs`).
8. **Finding 8 (P2 FIXED — French localization and 360px Client disclaimer layout):**
   - Fixed in `f2439fd` + `ddfaa2c` (`web/public/index.html`, `web/public/theme.css:3140-3175`, `web/public/app.js:6822-6896`): all 8 workflow status headers/cells and 401/403/500/offline error messages are localized in French, and at 360px `.disclaimer-text` wraps cleanly on whitespace without mid-word splitting (`disclaimerSplit: false`, `englishStatus: []`, `overflow: false` across all 24 French section/viewport/theme combinations).
9. **Finding 9 (P2 FIXED — Non-finite archive pagination normalization):**
   - Fixed in `19bc8c9` (`web/server/app.ts:1338-1344`): `!Number.isFinite` normalizes `Infinity` and `NaN` to finite `limit: 100` and `offset: 0`. Verified PASS in `node scripts/audit-a5-data.mjs`.
10. **Additional defects fixed in `ddfaa2c` (`web/server/board.ts:195-232`, `web/public/app.js:5054-5057`, `5140`, `5728-5780`, `7067`, `7370-7383`, `7406-7412`):**
    - `extractDependencyRepository` parses `repository.full_name` and `repository_url` from GitHub REST dependency payloads so real-shaped cross-repository blockers retain `owner/repo` identity.
    - `openIssue` resolves issues across `state.board.issues`, `state.archive.backburner`, `state.archive.closed`, and `GET /api/repos/:owner/:repo/issues/:number`.
    - `boot()`, `route()`, `selectProject()`, `#refresh-btn`, and `loadBoard()` preserve `state.activeSectionView` (`tb_active_section`) across reloads, refreshes, and project switches.

### Updated coverage matrix after `ddfaa2c` and packaged release audit

| Item | Post-repair Verdict | Evidence |
|---|---|---|
| 1a–1f Answer/Human-task/Reopen/Label-remove fingerprints, malformed JSON, double-click Answer | PASS | Unchanged PASS (`web/tests/a5-audit.test.mjs`, `scripts/audit-a5.mjs`). |
| 1g Two quick distinct task toggles | PASS | `ddfaa2c` `web/public/app.js:6188-6252`; `browser.json` `two quick task toggles`: `PATCH: 2`, `checked: [true, true]`. |
| 2a–2e Global presentation filter across all views, `planned`/`todo` preservation, Markdown parser reuse, hidden controls | PASS | `ddfaa2c` `web/public/app.js:1705-1713`; `browser.json` `leaked: []` across all views, `plannedVisible: true`, `todoVisible: true`. |
| 3a–3i Operations & Archive cached `fetchedAt`, warning banners, dedicated `state=closed` fetch, non-finite paging, cross-repo links | PASS | `data.json` 14/14 PASS; `packaged-browser.json` cross-repo badge & drawer navigation (`owner/other-repo#10`) PASS. |
| 4 Reopen contract review | PASS | Flagged for human decision (`status:backlog` in `web/server/app.ts:2191` unchanged). |
| 5a–5c Human-task byte preservation & label removal | PASS | `data.json` & `web/tests/a5-audit.test.mjs` PASS. |
| 6a–6f A4 marker byte identity, note 500/network/409 retention, refresh retry protection, explicit Overwrite, timed poll & full reload over unsaved draft | PASS | `data.json` 5/5 byte-identical; `browser.json` & `packaged-browser.json` PASS (`PATCH: 0` on refresh retry, `PATCH: 1` on Overwrite, `PATCH: 0` on timed poll, clean reload). |
| 7 Test inventory (573 web tests, 618 legacy tests, 0 `.skip`/`.todo`) | PASS | `raw/web-test-repair-final.log` (573/573), `raw/npm-test-repair-final.log` (618/618). |
| 8a–8l Regenerated 24 A5 screenshots + 24 French matrix screenshots + empty sections + 401/403/500/offline error handling + 200% zoom & touch note drag/resize + partial Arrange failure & Undo | PASS | `raw/generate-a5-screenshots-repair-final.log`, `raw/browser-repair-final.log`, `raw/packaged-browser-final.log` (12/12 PASS). |
| Browser `Network.emulateNetworkConditions` offline toggle / Live GitHub writes / Live release switch | NOT RUN | `Network.emulateNetworkConditions` unsupported in headless shell (offline tested via socket destruction & `fetch` network rejection); live GitHub writes and production cutover forbidden by task brief. |

### Final repair audit commands and logs

- `timeout 900 npm test`: exit 0, 618/618 (`raw/npm-test-repair-final.log`).
- `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs`: exit 0, 573/573 (`raw/web-test-repair-final.log`).
- `timeout 600 npm run typecheck`: exit 0, 0 errors (`raw/typecheck-repair-final.log`).
- `timeout 120 node scripts/audit-a5-data.mjs`: exit 0, 14/14 PASS (`raw/data-repair-final.log`, `data.json`).
- `timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs`: exit 0, all probes PASS (`raw/browser-repair-final.log`, `browser.json`).
- `timeout 240 node scripts/generate-a5-screenshots.mjs`: exit 0, 24/24 screenshots regenerated (`raw/generate-a5-screenshots-repair-final.log`).
- `timeout 180 env PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/ddfaa2c-foundation node scripts/audit-a5-packaged.mjs`: exit 0, 12/12 packaged probes PASS (`raw/packaged-browser-final.log`, `packaged-browser.json`).
