# Deep Verification Result

**Task:** Independent read-only hostile review of #48 web/mobile simple views.
**Candidate:** `e630a9ddd044389787a66f458b1ee49c944db250` (`42de557`, `cc9ce34`, `e630a9d`); base `af9b39c1753db0ca3f6a4314f1942bf66accb62f`.
**Status:** FAIL — acceptance blockers reproduced; no application corrections made.
**Spec Compliance:** FAIL. Views and capture exist, but free reorder, non-destructive project assignment, lossless editing, safe offline recovery and actionable Pending items are incomplete.
**Quality:** NEEDS-FIXES.
**Timestamp:** 2026-10-29T13:08:30Z; final checks completed later the same day.
**Reviewer model:** Genius, provider/model `9router/genius` (runtime system metadata).

## Boundary and authority

Application and tests remained read-only. Evidence is under this worktree's `.agents/run/issue-48-web-hostile/**`. HTTP and Chromium used localhost boards and `web/tests/fake-github.mjs`, not GitHub. Session and rename files used private temporary directories; harnesses remove them on shutdown. No push, merge, issue closure on GitHub, deployment, live service operation, credential inspection or production-data access. Synthetic source-issue closure below occurred only inside the fake GitHub process.

Authoritative contracts read:
- `/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md`
- `.../tasks/brief-issue-48-web-simple-views.md`
- `.../tasks/amendment-issue-48-web-preserve-sessions-and-issues.md`
- `.../outputs/simplification-review-requirements.md`
- `.../outputs/issue-47-session-hardening-review-gate.md`
- `.../outputs/issue-48-web-initial-review-gate.md`

The original builder brief suggested create-and-close moves, but the subsequent amendment and review rulings explicitly reject them. A confirmation dialog cannot make that implementation compliant. Likewise, the ordered-first/single-marker engineering restriction does not supersede the user's requirement to reorder freely.

## Executed levels

- **L0 Static:** PASS — both typechecks and local bundle, exit 0; no protected-file diff.
- **L1 Unit / Regression:** PASS for selected files only — 39 feature/client tests plus 26 auth/service-worker tests, **65/65**, no skips. Not the complete web or root suite.
- **L2 Integration:** EXECUTED, acceptance FAIL — actual local HTTP routes, fake GitHub writes, stale fingerprints, marker corruption, precision exhaustion, concurrent ranks and storage-isolation reproduction.
- **L3 The User's Way:** EXECUTED, acceptance FAIL — Chromium through real rendered controls, phone/desktop screenshots, injected response loss and delayed writes. Some probes also use the exposed `window.__taskBoard` functions to control state; those are identified below rather than presented as physical-device proof.
- **L4 Hostile Review:** COMPLETE, FAIL — ten grouped findings below remain open. Passing harness exit means the expected defect was reproduced, not that product acceptance passed.
- **L5 Human Validation:** **AWAITING HUMAN** for the combined #47/#48 batch after corrections and integration. No running integration preview established here; no human acceptance or release authorization.

## Commands, counts and raw evidence

Working directory for every relative command:
`/workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views`

Latest consolidated run set `TMPDIR="$PWD/.agents/run/issue-48-web-hostile/verifications/data"`. Harnesses additionally create their own private session/rename directories. The feature-route fixture itself uses its own `/tmp/opencode/issue48-routes-*` directory and deletes it. No test used the real default session path.

| Exact command | Exit | Result / raw log |
|---|---:|---|
| `npm run typecheck` | 0 | `logs/typecheck.log` |
| `npx tsc -p web/tsconfig.json` | 0 | `logs/web-typecheck.log`, empty success output |
| `node --test web/tests/simple-views.test.mjs web/tests/simple-views-client.test.mjs web/tests/multi-repo-client.test.mjs` | 0 | 39/39; `logs/targeted-tests.log` |
| `node --test web/tests/auth.test.mjs web/tests/sw.test.mjs` | 0 | 26/26; `logs/protected-tests.log` |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=.agents/run/issue-48-web-hostile/verifications/bundle/server.mjs` | 0 | 143.4 kB; `logs/build.log` |
| `node .agents/run/issue-48-web-hostile/verifications/builder-browser-isolated.mjs` | 0 | 14 named checks, 16 screenshots, `pageErrors: []`; `logs/builder-browser.log` |
| `node .agents/run/issue-48-web-hostile/verifications/hostile-runtime.mjs` | 0 | 25 JSON records, including 20 view/sort combinations; 6 screenshots, `pageErrors: []`; `logs/hostile-runtime.log`, `runtime-results.json` |
| `node .agents/run/issue-48-web-hostile/verifications/hostile-extra.mjs` | 0 | 9 JSON records, 1 additional screenshot, `pageErrors: []`; `logs/hostile-extra.log`, `extra-results.json` |
| `node .agents/run/issue-48-web-hostile/verifications/order-body-runtime.mjs` | 0 | 5 JSON records; `logs/order-body-runtime.log` |
| `node .agents/run/issue-48-web-hostile/verifications/isolation-runtime.mjs` | 0 | 1 JSON record; `logs/isolation-runtime.log` |
| `git diff --check` | 0 | no tracked whitespace errors |
| `git diff --exit-code af9b39c e630a9d -- web/server/auth.ts web/server/config.ts web/public/sw.js` | 0 | no changes to protected files |
| `git rev-parse HEAD` | 0 | exact candidate SHA above |

`logs/exits.log` retains the ten successful verification-command exit codes. Runtime logs total **40 JSON records**, including setup/result metadata; do not call these 40 independent passing acceptance assertions. Screenshots total **23**. All three successful browser harnesses recorded zero uncaught page errors. HTTP failures intentionally injected by the harness are not absent merely because `pageErrors` is empty.

`logs/app-diff.txt`, `logs/ui-diff.txt`, `logs/auth-integration-diff.txt`, `logs/candidate-commits.log` retain source/integration context. `logs/marker-precision.log` retains direct parser/precision probes. Logs were scanned without printing secret values: 19 log files before this report, zero contained any literal test credential defined by the test helper. Harness sources import test constants rather than embedding or logging their values.

### Not run

- **Full web test glob:** deliberately NOT RUN. `web/tests/hosting.test.mjs:210` constructs a board without isolated session storage; see F9. Do not rerun it until isolation is repaired.
- **Root/panel suite:** NOT RUN by this reviewer. Builder reported 553/553 on rerun after an unchanged CPU timing assertion failed at **51.76 ms**. This is a builder-reported flake, not independent proof of a clean first run. No assertion was weakened.
- Latest #47 hardening plus #48 integrated runtime, physical phone, screen reader, actual GitHub writes, installed-app legacy-worker upgrade and live password autofill: NOT VERIFIED.

## Hostile findings, ranked by impact

Severity vocabulary: **Blocker** prevents release/core accepted flow; **High** risks lost work or wrong task state; **Medium** is a concrete functional/accessibility gap. All findings remain open. Corrections are recommendations, not changes made by this review.

### F1 — Blocker: choosing a saved draft's project recreates it and closes its source

**Locations:** `web/public/app.js:1025–1029`, `953–972`; `web/server/app.ts:725–732`, `1124–1152`; transport `web/server/github.ts:425–440`. Tests explicitly encode the forbidden result at `web/tests/simple-views.test.mjs:104–116`.

**Reproduce:** run `hostile-runtime.mjs`; log record `unapproved destructive project move`. Sign in to the local fixture; PUT `/api/repos/owner/alpha/issues/1/move` with the fresh fingerprint and `target: "owner/beta"`. Actual status **200**; GitHub-bound writes in order:

```text
POST /repos/owner/beta/issues
POST /repos/owner/alpha/issues/1/comments
PATCH /repos/owner/alpha/issues/1
sourceState: closed
```

The same path is available through the All Projects row selector and native confirmation. The isolated builder browser also exercises it successfully — a green check proves the rejected operation exists. History remains on one issue while future work moves to a new identity. Partial failures can leave copies; no durable move journal exists in this path. Existing failure tests cover create/comment/close failures but do not authorize the product semantics.

**Smallest safe correction:** retain project choice for new/queued drafts; remove saved-issue project mutation from client and server. Display a read-only project name for saved drafts and disclose that transfer is unavailable. Only restore transfer after a supported history-preserving path and explicit human approval of its semantics. Replace create-and-close expectations with refusal/no-side-effect assertions; do not merely remove failing assertions.

### F2 — Blocker: offline synchronization duplicates committed work and loses newer local edits

**Locations:** `web/public/app.js:427–444` (title-based deduplication), `448–481` (snapshot/retry/delete), `940–941`, `1012` (editing same queue ID), `1808–1812` (clearing submitted fields), `2003–2017` (offline boot).

**Reproduce:** run `hostile-runtime.mjs` and `hostile-extra.mjs`:

1. Queue a draft with description and order. Intercept its POST, let `route.fetch()` commit to fake GitHub, then abort the browser response. First sync leaves **one real issue and one queued draft**. Reload/reconnect automatically POSTs it again: **two issues**, both with the original description/order.
2. Queue three drafts; lose the second response after commit. Remaining titles are `Partial two`, `Partial three`. Reconnect produces counts **1, 2, 1**. Ordinary retained-queue tests do not cover this ambiguous outcome.
3. Hold a sync POST, edit the queued row's description to `New during sync`, Save, then release. Server persists `Old queued description`; queue becomes empty. Same-ID changes are discarded because only IDs absent from the original snapshot survive the merge.
4. Offline, submit the same title twice with different descriptions. Only first description is stored; second input is cleared without a duplicate warning.
5. With service worker controlling the page, queue `Cold offline idea`, switch offline and reload. Local storage still has description/order but page shows sign-in error and **zero offline rows**. See `screenshots/cold-offline-reload.png`.

**Smallest bounded correction:** give queue entries stable operation IDs plus revision/state (`queued`, `in flight`, `uncertain`, confirmed identity). Never automatically resend an ambiguous create. Reconcile or require explicit review; server-side persistent idempotency/reconciliation is needed before claiming exactly-once recovery across process failure. Retain any revision newer than the acknowledged one; do not deduplicate by title. A cold offline shell should expose only the local draft editor, clearly offline and without pretending authentication was revalidated or caching private API responses. Add response-loss, partial replay, in-flight edit, same-title and offline-reload regressions.

### F3 — High: marker manipulation corrupts unrelated Markdown bytes

**Locations:** `web/server/board.ts:36–49`; `web/server/app.ts:1110–1122`, `1154–1157`, `1167–1169`.

**Reproduce:** `hostile-runtime.mjs` record `marker destroys fenced source`; `order-body-runtime.mjs` record `section edit destroys fenced marker elsewhere`. Start with CRLF body containing two Overview headings, a fenced `<!-- board-order: 42 -->` sample, similarly spelled `<!-- board-ordering: 7 -->`, and trailing actual marker. Reorder or save only first Overview. Status **200**, but the fenced example disappears and its line becomes bare `\n` among CRLF lines. Second heading and similarly spelled comment survive; this is selective corruption, not wholesale normalization.

Direct probe in `logs/marker-precision.log`: `parseOrderMarker` treats a fenced-only sample as real rank **42**. Rewriting `Keep this hard break  \r\n\r\n` strips the two meaningful Markdown hard-break spaces. The comment in `stripOrderMarker` claiming every non-marker byte is preserved is not true.

**Smallest correction:** locate the actual terminal own-line metadata marker outside fences/indented code using byte offsets; parse/hide/replace that span only, preserving line endings and all other whitespace. Define duplicate real-marker handling separately from fenced examples. Section/whole-body writes must carry the same actual marker without rewriting unrelated Markdown. Add exact-byte tests for fences, CRLF, hard breaks, duplicate headings/comments and spelling lookalikes.

### F4 — High: mutation paths bypass identity/revision safeguards and erase unsaved text

**Locations:** `web/public/app.js:651–679`, `683–718`, especially `707`; `953–965`, `996–1013`; `1524–1544`. Existing guarded publisher available at `103–128`.

**Reproduce:** `hostile-runtime.mjs` and `hostile-extra.mjs`:

- All Projects contains alpha#1 and beta#1. Mark Done on beta closes **beta on server**, but client board marks **alpha closed** and leaves beta open. `find(i.number === issue.number)` ignores repository identity.
- Delay Alpha's successful Mark Done response. Back to board, open Beta, release Alpha. Visible drawer changes to **Alpha**, overwriting current navigation. Response publication has no read-generation/source guard.
- In a drawer, type unsaved Overview, uncheck a genuinely checked acceptance criterion. Server checklist changes, but textarea reverts to `Original`. This was confirmed with a real DOM click, not only a direct helper call.
- Edit inline title `B` to `UNSAVED B`; Move up. Reorder succeeds but text disappears and buffer count becomes **0**. `draftMutation` deletes the entire text buffer for non-text mutations too.
- Buffer a description, let another device change it, Refresh, then Save. Buffered text is applied with the **new** issue fingerprint and silently overwrites the other device's description; no conflict notice. Buffer contains no observed revision.
- An unchecked `- [ ]` acceptance criterion renders **checked**. `el()` sets HTML `checked="false"`, whose presence is truthy. Base inspection confirms this boolean-attribute problem already existed at `af9b39c`; do not falsely label it introduced by #48.

**Smallest bounded correction:** route checklist and Mark Done through the existing identity-qualified, generation-guarded publication/unknown-outcome machinery; snapshot unsaved fields before rerender and keep recoverable drafts bound to their observed fingerprint. Store fingerprints with inline buffers; never rebind them silently on refresh. Clear only the fields actually acknowledged by a text save, not by reorder/project changes. Set boolean DOM properties (or omit false boolean attributes). Add same-number, delayed-response, unsaved-checkbox/reorder and stale-buffer tests in a real DOM as well as unit tests.

These retained drawer bugs are release-relevant because #48 promises to preserve these interactions; they are not all newly introduced lines. Client same-number mispublication did **not** close alpha on the server in this reproduction.

### F5 — Blocker: manual order cannot perform ordinary downward moves or recover collisions

**Locations:** `web/public/app.js:822–828`, `976–991`; `web/server/board.ts:51–53`; `web/server/app.ts:1113–1122`.

**Reproduce:** `hostile-runtime.mjs` uses real Move down buttons with Manual order:

| Fixture | Action | Actual |
|---|---|---|
| A, B, C all unmarked | Move A down once | A, B, C unchanged; **0 writes**; asks user to move older draft up first |
| A=1000, B/C unmarked | Move A down once | unchanged; **0 writes**, same refusal |
| A/B/C all 1000 | Move A down once | unchanged; **0 writes**, no-space refusal |

Screenshots: `reorder-all-unmarked.png`, `reorder-marked-into-unmarked.png`, `reorder-equal-markers.png`.

`order-body-runtime.mjs` also performs **53 actual successive midpoint writes**, then next request returns **409 order_precision** at neighbours `1000` and `1000.0000000000001`; no rebalance. Two distinct authenticated sessions moving different issues into the same boundary each receive **200**, yielding `[1500,1500]`. A stale-neighbour request also receives **200** after the neighbour moved from 2000 to 4000, because only the moved issue's fingerprint is checked. That is stale placement, not proof of cross-issue atomicity.

**Root conflict:** finite marked items always sort before unmarked ones; changing only A's marker cannot put A after an unmarked B. This is an overly restrictive engineering contract, not a user choice to forbid downward moves. Explicit refusal and deterministic tie-breakers do not satisfy easy free reorder.

**Smallest options:** keep numeric GitHub markers but permit conflict-safe writes to affected rows when initializing legacy/unmarked order, repairing ties or exhausting precision. Option A: initialize/rebalance the affected slice, then apply the move. Option B: serialize and renumber the full affected ordered list on a move (simpler, more writes). Validate neighbour identities and observed fingerprints, surface concurrent changes, and account for partial multi-issue writes; a server-local lock alone does not coordinate the extension. Align the adjusted protocol on both surfaces before claiming cross-device order. Do not make the user choose numeric mechanics. Preserve the already-visible Manual-order hint and accessible controls.

### F6 — High: Pending items displays human actions but cannot complete them

**Locations:** `web/public/app.js:1136–1145`, `1475–1487`; `web/public/index.html:103–166` (drawer surface).

**Reproduce:** `hostile-runtime.mjs` record `pending answer works, human completion absent`; screenshot `hostile-pending-360.png`. Pending card lists `Approve beta` and `Decide beta?`. Opening it permits answering the question; actual GitHub body contains `Answer: Yes beta`. Human-task section contains **0 inputs/buttons**, only text spans. No link to the source on GitHub is rendered by this client either. Mark Done closes the whole issue, not the individual human action, so is not a substitute.

**Smallest correction:** expose explicit human-controlled completion for each human task, using exact source identity/line and conflict-safe body editing; preserve question answer interaction and source navigation. Never auto-complete the issue. Keep Pending-items grouping/feel, add complete/answer/source-link browser checks. This is a retained capability gap against the review requirements, not a claim that #48 deleted a previously working web human-task button.

### F7 — Medium: Graph misses declared checklist dependencies and invents edges from code samples

**Locations:** `web/server/board.ts:58–62`; `web/public/app.js:1110`, `1120–1135`.

**Reproduce:** `hostile-runtime.mjs` record `dependency parser`: `- [ ] Blocked by #2` produces `dependencies: []`; fenced `Depends on #2` produces `[2]`. These are actual `buildBoardListItem` results. Graph subsequently consumes these fields, so dependency tree is unreliable for common checklist declarations and documentation examples.

**Smallest correction:** parse the supported dependency declaration forms outside fenced/indented code (including checkbox and numbered-list prefixes); qualify source repository and preserve missing/cyclic references. Add both positive declaration and negative code-example tests. A compact dependency list-tree is an acceptable phone rendering; false source data is not.

### F8 — Medium: phone text, touch targets and drawer focus remain incomplete

**Locations:** `web/public/app.js:1001–1002`, `1895–1902`, `1909–1915`, `1931–1937`; `web/public/theme.css:826–829`, `883–886`.

**Reproduce:** `hostile-runtime.mjs` record `description lines clipped`: 360px screen, a three-line inspiration has **clientHeight 42 / scrollHeight 77**. Screenshot `hostile-multiline-description-360.png` visibly clips later lines. Existing long-name screenshot also clips a wrapped description. `hostile-extra.mjs` finds question option buttons **51×36** and **77×36**, below the promised 44px target height. Close drawer using Back: active element becomes **BODY**, not source task.

**Smallest correction:** auto-size description textarea on render/input or use an expanding readable preview with explicit editing affordance; give question choices minimum 44px touch area; retain the opener's qualified identity and restore focus to it (or a stable board control if removed). Verify keyboard opening/closing and touch-size checks on the drawer, not just board toolbar.

**Human simplicity concern, not a separate invented redesign requirement:** at 390×844, first draft starts around y=450 and each row consumes roughly 150px. Only about 2.5 rows appear; add form is below them. At 360px the form is reachable by scrolling and project selector remains visible, but this is heavier than a plain to-do list. Ask human to judge density after hard defects are fixed rather than calling it accepted or demanding a broad redesign now.

### F9 — Blocker for safe verification: server-construction tests do not isolate both stores

**Locations:** `web/tests/hosting.test.mjs:186–213`, especially `210`; `web/tests/helpers.mjs:26–46`; `web/server/app.ts:401–406`; default resolution `web/server/config.ts:236`.

**Reproduce safely:** do **not** execute the hosting test as written or inspect real data. Source confirms `createBoardServer({ config, fetchImpl: spyFetch })` without isolated session path. Existing #47 review gate already flags that startup loads/prunes the real default store. This known blocker remains uncorrected; full web glob withheld.

Independent new reproduction: `isolation-runtime.mjs` changes OS temporary directory to a private stand-in under this evidence tree, starts two helper boards with distinct auto-generated session files, renames a project through the first, then reads names through the second. Second sees `Cross-fixture leak`. Both session files share a parent, so `path.dirname(sessionFilePath)/project-names.json` is the **same file**. Random session filenames alone do not isolate new rename storage; helper cleanup removes only session file. No production-data probe was used.

**Smallest correction:** make every fixture own a unique directory holding both session and project-name files, and clean it after shutdown. Repair direct server construction too, then assert against a private stand-in default store that it remains untouched. Only then run full web suite and integrated #47 checks. Production rename persistence beside board data is not itself a bug; test fixture placement is.

### F10 — Medium: extension-only alignment remains callable from web API

**Locations:** `web/server/app.ts:689–709`; imported `alignDraftIssue` at `web/server/app.ts:33`.

**Reproduce:** `order-body-runtime.mjs` sends authenticated CSRF-protected POST `/api/repos/owner/repo/issues/batch-align` with `{}`. Status **200**, `alignedCount: 2`, both issues patched with `body` and `labels`. No observed fingerprint supplied and this path bypasses `writeIssue`. The UI removal test at `web/tests/simple-views-client.test.mjs:82–88` only scans HTML; it cannot establish extension-only operation.

**Smallest correction:** remove/disable standalone web batch-align route and unused import; keep extension alignment unchanged. Add HTTP assertion that web endpoint is unavailable with zero GitHub writes. This route is inherited from the base, not newly introduced by #48, but still contradicts the approved extension-only boundary. No unauthenticated exploit is claimed.

## Positive evidence and limits of builder coverage

- Defaults Simple list / no filters / Priority; device-state reload and Settings rename work in isolated browser run. Short-name examples, fallback and case-insensitive overrides pass selected tests. Full `owner/repo` remains available in title/secondary labels.
- All five views plus draft list render at 390×844 and 1280×800. 360px long-name board has no horizontal page overflow. Add form is structurally below list, reachable by scrolling; screenshot shows usable project selector rather than a hidden choice.
- 20 real-renderer combinations (five views × four sorts) used the same selected attention/stage/project filters. Priority/manual and created/updated yielded expected two-row order. Fixture has no edges, so this does not certify graph topology sorting. Unit tests cover OR within filter groups and AND across groups.
- Manual-reorder controls are disabled outside Manual order with visible `Choose Sort: Manual order to rearrange drafts.` hint; builder browser proves pointer and CDP synthetic-touch upward reorder. Free downward reorder remains F5.
- Enter creates a `status:draft` issue with description and no agent/session request. Inline text saving and ordinary offline description/order sync work on the happy path. Unknown-outcome recovery does not; see F2.
- Mutation security: `/api/project-names` and issue `/draft`, `/order`, `/move` each return **401** anonymous, **403** missing CSRF, **400** unlisted repository; unknown-repository fake GitHub hits **0**. Create route returns 401/403 in separate runtime probe. Target stale fingerprint rejected on all three draft operations with **409**. Selected tests also cover ETag 412 becoming conflict. These checks do not make stale neighbours safe.
- Rename traversal-like repository, angle-bracket name and prototype-like input rejected with 400; separate same-process concurrent saves to alpha and beta retain both keys. Selected test proves restart persistence and reset. No multi-process shared-file race test was run; synchronous read/write/rename in one process does not prove distributed locking.
- Hidden real markers do not appear in normal rendered drawer/overview. Byte safety around fenced samples fails F3.
- Partial refresh preserves successful repository rows: with Beta failing and no filters, Alpha remains visible and empty state is hidden. With Draft filter and no matching draft, partial notice remains explicit and capture stays visible. With both repositories failing, empty message says refresh incomplete, not empty project. Earlier filtered-empty observation was **not** lost Alpha data; extra probe rules that out.
- Builder browser's 14 checks include the destructive move as an expected success and test only selected happy-path order positions. VM element stubs do not implement real HTML boolean-attribute semantics. Green builder tests therefore neither waive F1/F5 nor detect F2/F4.

## Screenshot inspection

All paths relative to this report: `screenshots/`. Browser saved 23 images, with phone and desktop view families plus hostile probes. Direct visual inspection included the five phone views, phone/desktop draft lists, desktop simple/cards/graph/pending/kanban, 360px sheet, long-name and bottom-add examples, empty filter, hostile drawer/pending/reorder, multiline description and cold offline reload.

- `issue-48-web-390-844-{simple,cards,kanban,graph,pending,drafts}.png`: distinguishable renderers; readable short badges. Draft list density concern above; Pending rows are text, not actionable checkboxes.
- `issue-48-web-1280-800-{simple,cards,kanban,graph,pending,drafts}.png`: desktop uses bounded content width; kanban has narrow columns and further content below fold rather than overflowing page. No physical scroll-feel conclusion.
- `issue-48-web-360-800-view-sheet.png`: visible sheet options and close control; keyboard Escape focus-to-toolbar covered in builder browser.
- `issue-48-web-360-800-{long-project-drafts,add-row-bottom,empty-filter}.png`: project selector truncates long display name but remains visible; scrolling reaches capture; Clear remains available in filtered empty state. Wrapped inspiration can clip.
- `reorder-{all-unmarked,marked-into-unmarked,equal-markers}.png`: controls remain present despite ordinary downward operations being refused.
- `hostile-drawer-360.png`, `hostile-pending-360.png`: drawer/source-task navigation exercised; missing human completion and checkbox issue are supported by DOM/server evidence, not inferred solely from images.
- `hostile-multiline-description-360.png`: later lines visibly clipped; DOM dimensions above quantify it.
- `cold-offline-reload.png`: sign-in error occupies offline shell; saved queue invisible although storage retains it.

No screenshot is evidence of actual iOS/Android physical touch, screen-reader announcements, native saved-password autofill or live GitHub behavior.

## #47 integration touchpoints — identified, NOT merged

`git show 4b3f475 -- web/server/app.ts` shows exactly one application-server change relative to the shared base:

```ts
const sessions = new SessionStore({
  secret: config.sessionSecret,
  passwordHash: config.passwordHash,
  filePath: sessionFilePath,
```

#48 inserts `namesPath`/`projectNames()` immediately before that constructor (`web/server/app.ts:405–417`); the constructor now sits at **419–425**, and candidate lacks `passwordHash`. The insertion is adjacent to the original base line 402 context, not a competing modification to the secret/filePath fields. Integration must preserve both the names storage logic and the hardening constructor argument. Other #48 server hunks cover repositories/names, create validation, draft routes and marker-preserving write paths (`logs/app-diff.txt`). Protected `auth.ts`, `config.ts`, `sw.js` remain identical to base.

No cherry-pick/merge attempted. Candidate's 26 auth/SW tests test base #47 behavior, not proof of newer password-rotation/CSRF-at-rest hardening. Fresh integration worker must incorporate `4b3f4750bf20bf370bbdc4632a05714e8e3dd009`, repair F9, then prove latest #47 and corrected #48 together. Existing #47 gate also defers native no-JavaScript login and version-fallback follow-ups; neither was expanded here.

## One bounded correction and re-verification plan

1. Remove saved-draft destructive move and web batch-align routes; retain new/queued project choice.
2. Correct marker parser/byte preservation and GitHub order protocol together. Allow affected-row initialization/rebalance, validate observed neighbours and partial writes, align extension protocol through its owner.
3. Unify mutation publication with qualified identity, generation, unknown-outcome and observed-text-buffer handling; repair real DOM checkbox state and explicit human-task completion.
4. Fix offline operation lifecycle/reconciliation and revision retention; make local capture usable after offline reload without weakening authentication.
5. Apply targeted phone sizing/focus fixes; keep broader density judgement for one human preview.
6. Integrate latest #47 with passwordHash wiring and isolated session/rename fixtures. Rerun targeted adversarial harnesses expecting corrected outcomes, then safe full suites. A defect-reproduction assertion must be replaced by the legitimate new acceptance expectation, not skipped or loosened.

No request for another concurrent writer, push, deployment or individual human sign-off is made here.

## Failures, learning and blind spots

- **DIDN'T WORK:** first main harness exit 1, `locator.evaluate: Error: strict mode violation: locator('.draft-description') resolved to 2 elements`. Prior move fixture leaked an extra issue into later browser fixture. **FINALLY WORKED:** remove that intentionally created target before independent browser fixtures and use exact accessible textbox locator. Raw failed output retained in `logs/hostile-runtime-first-failed.log`; final rerun exit 0.
- **DIDN'T WORK:** first extra harness exceeded the 120000ms tool timeout while request routing shared a service-worker-controlled context; process was stopped. Log ends after offline-reload result (`logs/hostile-extra-first-timeout.log`). **FINALLY WORKED:** retain worker-enabled context solely for offline reload, use a separate `serviceWorkers: 'block'` context for route injection. Final exit 0.
- **DIDN'T WORK:** initial 20-combination addition exit 1, `AssertionError [ERR_ASSERTION]`, actual `['Filtered low','Filtered urgent']` versus expected reverse for tied recency fixture. **FINALLY WORKED:** correct fixture expectation to documented number tie-break; source behavior was not changed. `logs/filter-harness-wrong-tie-expectation.log` retained. Final 20 combinations pass.
- **DIDN'T WORK:** evidence-only text edit failed `Could not find oldString` because indentation differed. **FINALLY WORKED:** matched the source's single-space indentation; no application edit.
- **Not verified:** physical touch/scroll comfort, iOS/Safari and Android devices, screen reader, actual GitHub ETag/comment behavior, multi-process rename writes, high-load performance, latest integrated session hardening, old installed worker upgrade, live deployment and production data. Only local fake-GitHub processes were used.
- **Builder flake:** root 553/553 rerun and 51.76ms first-run failure remain reported claims from initial review gate, not independently rerun counts.
- **Human gate:** **L5 AWAITING HUMAN**. After all batch members pass corrections/L4, provide one combined integration preview and ask user to capture drafts, reorder both directions, reconnect after interruption, answer/complete Pending items, switch projects without accidental closure, and judge phone simplicity. No release/Done authority granted by this report.
