# Independent Hostile L4 Review — Discovery Failure Legibility (`210c010..e1f90aa`)

- **Date:** 2026-11-14
- **Branch / HEAD:** `feat/board-v3` @ `e1f90aa` (commits reviewed: `baba530` and `e1f90aa`; base `210c010`)
- **Mode:** Strictly read-only on `web/**`, `test/**`, and prior verification directories. All empirical probes used synthetic local fixtures (`startFakeGitHub`, `startBoard`, headless Chromium) with zero real tokens, zero `board.env` reads, and zero production traffic.
- **Verdicts:**
  - `SPEC_VERDICT`: **FAIL**
  - `QUALITY_VERDICT`: **CHANGES_REQUIRED**
  - `PUBLISH_VERDICT`: **NO**

---

## 1. Executive Summary

Commits `baba530` and `e1f90aa` add four discovery cause buckets (`auth`, `rate_limited`, `network`, `server`) to `/api/repos` and `/api/combined/board` `failures[]` without leaking tokens or raw upstream bodies, and maintain 250/250 EN/FR key parity on `I18N`.

However, independent code audit, visual inspection of the author's 32 PNGs, and live Chromium + HTTP adversarial probes (`probe.mjs`, `probe-results.json`) uncovered **four P1 defects and one P2 test-integrity gap** that violate `wave6d-discovery-legibility.md` and degrade desktop/Canvas UX:

1. **P1 — Incomplete credential/status classification (`web/server/repositories.ts:23-30`, `web/server/github.ts:131-142`):** HTTP `403` token scope, fine-grained PAT permission, or SAML SSO refusal (`GitHubError.kind === 'forbidden'`) is silently dropped into `'server'` ("Refresh to try again"), contradicting `web/server/app.ts:429`. Non-JSON `401`/`429` gateway responses also misclassify as `'server'`.
2. **P1 — Missing surfaces, Canvas stale cards, and contradictory drawer/mutation errors (`web/server/repositories.ts:50,83-91`, `web/server/app.ts:456,539-543,754,1610-1636,1734-1741,1823-1830`, `web/public/app.js:422-429,3805-3830,6364-6395,7498-7501,8688`, `web/public/theme.css:1645`):** In Canvas mode, discovery failure hides `#empty-state` (`display: none !important`) without clearing `#canvas-cards`, leaving stale cards interactive on screen (`screenshots/canvas-stale-cards-on-auth-failure-1280.png`). `DiscoveryUnavailableError` omits `errorKind`/`errorResetAt` (and returns `503` on repo routes vs `502` on combined archive/operations), causing the task drawer (`app.js:7500`) and drawer/composer writes (`app.js:427,8688`) to show hardcoded English `"Refresh to try again"` even during an `auth` refusal in French.
3. **P1 — Triple sentence repetition, 1280px `.status-strip` overflow clipping controls, contradictory CTA, and broken language switch (`web/public/app.js:1164-1215,6370-6373`, `web/public/theme.css:1297-1298,3379-3384`, `web/public/index.html:418-425`):** The full 83–153 character sentence is rendered 3 times visibly (`#notice`, `#scope-status`, `#empty-state p`). Inside `nowrap` `.status-strip`, `#scope-status` widens to `891px` at `1280x900` (`scrollWidth: 1240` vs `clientWidth: 1050`), pushing `#new-task-btn` (`right: 1346`) and `#freshness` (`right: 1450`) off-screen and clipping `Liste à plat` in the author's own `1280` screenshots. `#empty-state` keeps `"Capture your next step..."` and an enabled `Create a task` button, and switching EN/FR leaves all 3 visible error strings stuck in the previous language (`screenshots/lang-switch-stale-en-in-fr-1280.png`).
4. **P1 — Dishonest auto-refresh promise and unguarded stale/past/multi-day reset clock (`web/public/app.js:840,1079,6300-6323`, `web/server/repositories.ts:138-142`, `web/server/github.ts:211-226`):** `discovery_failed_rate_limited` tells the user `"Nothing is required of you; the board will refresh after {time}"`, but the client has zero board auto-refresh timer (`app.js:8952` only updates relative freshness text). Moreover, `recordRateLimitHeaders` leaks stale `sharedRateLimit.current.reset` onto headerless `403`/`429` secondary rate limits, and neither `rateLimitResetAt()` nor `discoveryResetClock()` rejects past timestamps (`reset <= now`) or disambiguates other-day resets.
5. **P2 — Test & browser-proof blind spots (`web/tests/discovery-legibility.test.mjs:11,128-178`, `web/tests/fake-github.mjs:239-247,858-860`, `verifications/discovery-legibility/verify.mjs:14,120-122`):** `verify.mjs` explicitly asserted 3x identical text across `#notice`, `#scope-status`, and `#empty-state p` while making zero `scrollWidth` or viewport bounding-box assertions; `fake-github.mjs` injects default `x-ratelimit-reset` headers on every response, masking stale-reset leakage.

---

## 2. Attack Checklist Findings

### Checklist 1 — Error Classification Completeness

- **[P1] `GitHubError.kind === 'forbidden'` misclassified as `'server'` (`web/server/repositories.ts:23-30`):**
  - `kindForStatus()` (`web/server/github.ts:135-142`) classifies HTTP `403` without `x-ratelimit-remaining === '0'` or `"rate limit"` in `data.message` as `'forbidden'` (fine-grained PAT missing repository metadata/issues permission, classic PAT scope refusal, SAML SSO enforcement, org IP allowlist refusal).
  - Startup auth verification at `web/server/app.ts:429` explicitly treats `(error.kind === 'unauthorized' || error.kind === 'forbidden')` as credential rejection (`BOARD_GITHUB_TOKEN was rejected by GitHub`).
  - Yet `discoveryFailureKind()` (`web/server/repositories.ts:24-29`) checks only `error.kind === 'unauthorized'`, dropping `'forbidden'` into `'server'` (`errorReason: "GitHub returned an unexpected response"`), which tells the user `"Discovery failed — tasks are not refreshed. Refresh to try again."` when refreshing can never fix a scope/SSO refusal.
  - **Empirical proof (`probe-results.json` -> `forbidden403`):** Injecting `403 { "message": "Resource not accessible by personal access token" }` on `/user/repos` yielded `errorKind: "server"`.
- **[P1] Non-JSON `401` / `429` / `403` responses misclassified as `'server'` (`web/server/github.ts:131-133`):**
  - `kindForStatus()` immediately returns `'server'` whenever `!jsonParsed || !data || typeof data !== 'object'` *before* checking `status === 401`, `status === 429`, or `headers.get('x-ratelimit-remaining') === '0'`.
  - **Empirical proof (`probe-results.json` -> `nonJsonUpstream`):** Both `401 text/html` and `429 text/plain` (`x-ratelimit-remaining: 0`) yielded `errorKind: "server"`.
- **Verified OK:** Malformed JSON `200` / >2 MiB body / >10 pages / 3xx redirect map to `'server'`; `fetch` rejection and `AbortSignal.timeout` map to `'network'` (`web/server/github.ts:279-333,376-378`).

### Checklist 2 — Every Surface, Route, UI Repetition, and ETag/Cache Behavior

- **[P1] Canvas mode leaves stale task cards visible and interactive on discovery failure (`web/public/app.js:6364-6375`, `web/public/theme.css:1645`):**
  - In `loadBoard()`, the `view.discoveryFailed` branch sets `state.board = null`, empties `#task-list`, and sets `$('empty-state').hidden = false`, but never clears `#canvas-cards` or exits Canvas presentation.
  - Meanwhile `web/public/theme.css:1645` enforces `#board-view.mode-canvas #empty-state { display: none !important; }`.
  - **Empirical proof (`probe-results.json` -> `browser.canvasOnFailure`, `screenshots/canvas-stale-cards-on-auth-failure-1280.png`):** With `state.board === null` and `emptyComputedDisplay: "none"`, `staleCanvasCardCount` remained `1` (`Alpha #1` still rendered and clickable).
- **[P1] Task drawer, mutations, and section views lose `errorKind` and contradict the board (`web/server/repositories.ts:50,83-91`, `web/server/app.ts:456,539-543,1734-1741,1823-1830`, `web/public/app.js:422-429,3805-3830,7498-7501,8239-8293,8688`):**
  - Scope item 4 of `wave6d-discovery-legibility.md` required consistency if the task drawer or other surfaces surface discovery failures.
  - `DiscoveryUnavailableError` carries no `errorKind` or `errorResetAt`. `resolveRepository` (`app.ts:456`) returns `503 { error: "discovery_unavailable", message: "Repository discovery failed; no operation was dispatched" }`, while `archiveData(null)` and `operationsData(null)` (`app.ts:1736,1825` caught at `app.ts:539-543`) return `502` with the same generic body.
  - Opening a task drawer (`openIssue`, `app.js:7498-7501`) displays hardcoded English `'Repository discovery failed; no operation was dispatched.'`.
  - Submitting a mutation (`app.js:422-429` + quick-add `app.js:8688`) displays hardcoded English `'Discovery failed; nothing was sent. Refresh to try again Your text is retained. Refresh before retrying an unknown outcome.'` — missing a period, untranslated in French, falsely calling a definite 503 refusal an "unknown outcome", and telling the user to refresh when `errorKind === 'auth'`.
  - Dragging a Canvas card (`canvasMoveFailureMessage`, `app.js:3805-3830`) falls through to generic `dict.canvas_save_failed` (`'Could not save card position.'`).
- **[P1] Mid-refresh failure between `/api/repos` and `/api/combined/board` (`web/public/app.js:6378-6395,6015,6028`):**
  - If `/api/repos` succeeds right before TTL expiry and `/api/combined/board` observes `discovery.discoveryFailed === true` inside `aggregate()` (`app.ts:1610-1636`), `loadBoard()` does not check `board.discoveryFailed`: it overwrites `localStorage` cache (`saveCachedBoard(board)` at `app.js:6381`) with `issues: []`, repeats the full 83–153 char sentence once per repository inside `#scope-status` (`app.js:6015`), sets `#notice` to `'Partial board: N of N repositories could not be reached...'` (`app.js:6390`), and shows `'No tasks yet in All Projects.'` on Canvas (`app.js:6028`).
- **[P1] Triple sentence repetition, 1280px `.status-strip` horizontal overflow, contradictory empty-state CTA, and stale language switch (`web/public/app.js:1164-1215,6370-6373`, `web/public/theme.css:1297-1298,3379-3384`, `web/public/index.html:418-425`):**
  - Visible in all 16 desktop screenshots under `verifications/discovery-legibility/screenshots/discovery-*-1280-*.png` and measured in `probe.mjs`:
    - The identical sentence appears simultaneously in `#notice` (top banner), `#scope-status` (toolbar strip), and `#empty-state p` (center card), plus `#discovery-status` in the project popover.
    - At `1280x900` (`auth`, EN), `.status-strip` has `clientWidth: 1050` and `scrollWidth: 1240` (`190px` horizontal overflow): `#new-task-btn` (`left: 1258, right: 1346`) and `#freshness` (`left: 1358, right: 1450`) are pushed outside the `1280px` viewport; in `discovery-rate_limited-1280-dark-fr.png`, even `#list-group-toggle` (`Liste à plat`) is clipped mid-word (`Liste à...`).
    - `#empty-state` retains `"Capture your next step or choose another project."` (`Notez votre prochaine étape...`) and an enabled `Create a task` button (`#empty-create`) that cannot succeed while discovery is unavailable.
    - Switching language via Settings (`setLanguage` -> `applyLanguage`, `app.js:1164-1215`) skips `renderBoard()` because `state.board === null` (`app.js:1207`) and never updates `#notice`, `#scope-status`, or `#empty-state p` (`screenshots/lang-switch-stale-en-in-fr-1280.png`).
- **ETag & Cache Audit:**
  - `computeWeakEtag()` (`web/server/app.ts:174-183`) strips only `rateLimit` and `fetchedAt`, so `discoveryFailed`, `errorKind`, `errorReason`, `errorResetAt`, and `failures` are included in the SHA-1 weak ETag on `/api/repos` and `/api/combined/board`. Verified in `probe.mjs` (`warmEtagStale304Prevented: true`, `staleErrorEtagPrevented: true`). Browser `api()` also uses `cache: 'no-store'` (`app.js:361`), and `sw.js:77` bypasses `/api/*`.
  - **Edge defect on single-repo refresh (`web/server/app.ts:453,754,766`, `web/server/repositories.ts:87`):** `resolveRepository()` calls `repositories.resolve()` -> `this.view()` *without* `{ forceRefresh }`. Direct `GET /api/repos/:owner/:name/board?refresh=1` (or `GET /api/board?refresh=1`) ignores `?refresh=1` at the discovery gate and keeps returning `503 discovery_unavailable` for up to 60s after GitHub recovers (`probe-results.json` -> `latchedRoutes.singleBoardRefreshWhileLatched`).

### Checklist 3 — Reset Time Honesty

- **[P1] False auto-refresh promise (`web/public/app.js:840,1079,8951-8953`):**
  - `discovery_failed_rate_limited` states: `"GitHub is limiting the board temporarily. Nothing is required of you; the board will refresh after {time}."` / `"le tableau s’actualisera après {time}."`
  - Searching `web/public/app.js` confirms there is **no** background polling or scheduled `loadBoard()` timer anywhere in the client (`window.setInterval` at `app.js:8952` only updates `#freshness` text; `app.js:6181` explicitly states `"Manual refresh only"`). If a user follows `"Nothing is required of you"`, the board never refreshes after `{time}`.
- **[P1] Stale `sharedRateLimit.current.reset` leaked onto headerless `403`/`429` secondary rate limits (`web/server/github.ts:211-226`, `web/server/repositories.ts:138-142`):**
  - `recordRateLimitHeaders()` (`github.ts:218-224`) preserves `this.rateLimitRef.current.reset` whenever a response omits `x-ratelimit-reset` (or leaves `rateLimitRef.current` untouched when no `x-ratelimit-*` headers are present, such as GitHub secondary rate-limit `403` responses with `Retry-After`).
  - `rateLimitResetAt()` (`repositories.ts:139`) reads `this.client.getRateLimitInfo().reset` instead of the failing discovery response's own headers.
  - **Empirical proof (`probe-results.json` -> `secondaryRateLimitStaleReset`):** After a normal response recorded a past GraphQL reset (`2026-11-14T01:05:00.000Z`), a subsequent headerless `403` secondary rate limit emitted `errorKind: "rate_limited"` with `errorResetAt: "2026-11-14T01:05:00.000Z"`.
- **[P1] Past and multi-day `reset` values rendered as bare `HH:MM` (`web/server/repositories.ts:138-142`, `web/public/app.js:6300-6309`):**
  - `rateLimitResetAt()` rejects only `reset <= 0`; `discoveryResetClock(iso)` checks only `!isNaN(date.getTime())`.
  - Any positive past timestamp (`reset = 1` -> `1970-01-01T00:00:01.000Z` -> `"00:00"`, clock skew, or a reset timestamp that passes during the 60s latch) still renders `"after 00:00"`.
  - Timestamps on another calendar day (`+30h` -> `2026-11-15T20:46:04.000Z`) drop the date completely (`toLocaleTimeString(..., { hour: '2-digit', minute: '2-digit' })`), and EN hardcodes `'en-GB'` locale.

### Checklist 4 — Invariants & I18N

- **Key-for-key parity (`web/public/app.js`):** Verified programmatically (`250` keys in `I18N.en`, `250` keys in `I18N.fr`, `onlyEn: []`, `onlyFr: []`, including all 5 `discovery_failed_*` keys).
- **Copy & markup invariants on new code:** Zero `"n8n"`, zero `"mobile"`, zero emojis, zero `!` in all 10 EN/FR `discovery_failed_*` strings; zero inline styles in `210c010..e1f90aa`; zero new dependencies.
- **Secret & upstream body wall (`web/server/repositories.ts:16-21,125-127`):** `errorReason` is selected strictly from the constant `DISCOVERY_FAILURE_REASONS` map; neither `BOARD_GITHUB_TOKEN` nor raw GitHub response bodies can enter `RepositoryView` or `failures[]`.
- **I18N runtime & fallback gaps (covered in F2/F3):** Switching language while `state.board === null` leaves `#notice`, `#scope-status`, and `#empty-state p` in the prior language (`app.js:1207`), and `discovery_unavailable` errors in `openIssue` (`app.js:7500`) and `api()` (`app.js:427`) remain hardcoded English.

### Checklist 5 — Tests, Build & Browser Proof Integrity

- **Independent command executions (all exit `0`):**
  - `node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs` -> **16/16 pass**, exit `0`
  - `node --test --test-timeout=60000 web/tests/*.test.mjs` -> **729/729 pass**, exit `0`
  - `npm test` -> **618/618 pass**, exit `0`
  - `npm run typecheck` -> exit `0`
  - `npx tsc -p web/tsconfig.json --noEmit` -> exit `0`
  - `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/discovery-legibility-L4/server.mjs` -> exit `0` (248.9kb)
  - `npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/discovery-legibility-L4/app.js` -> exit `0` (417.8kb)
- **[P2] Why `discovery-legibility.test.mjs` and `verify.mjs` missed F1–F4:**
  - `discovery-legibility.test.mjs:128-178` runs `app.js` in a minimal `vm` stub without CSS layout, Canvas mode, language switching, drawer/mutation calls, HTTP `403 forbidden`, or past/headerless rate-limit resets (and hardcodes `2026-11-14T14:32:00Z` at `line 11`, which is already in the past).
  - `web/tests/fake-github.mjs:239-247` attaches default `x-ratelimit-reset: now + 3600` headers to every response, hiding headerless secondary rate limits; `setDiscoveryResetAt` (`line 859`) coerces `null` to `0` via `Number(seconds)`.
  - `.agents/run/chamberos-board-v2/verifications/discovery-legibility/verify.mjs:120-122` explicitly asserted `notice === empty` and `scope === empty` (enforcing the 3x duplication) without checking `scrollWidth <= clientWidth` or button visibility inside the `1280x900` viewport, even though the resulting PNGs visibly show clipped/off-screen toolbar controls.

---

## 3. Required Fixes Before Publish

1. **Map `'forbidden'` and status-first `401`/`429` (`web/server/repositories.ts:24-29`, `web/server/github.ts:131-142`):** Map `error.kind === 'forbidden'` to `'auth'` (or a dedicated permission/SSO auth message if desired, never `'server'`), and classify `401` / `429` / `x-ratelimit-remaining: 0` before bailing out on non-JSON bodies.
2. **Propagate cause through `DiscoveryUnavailableError` and clear Canvas (`web/server/repositories.ts:50,83-91`, `web/server/app.ts:452-458,539-543,754`, `web/public/app.js:422-429,3805-3830,6364-6395,7498-7501`):** Attach `errorKind` and `errorResetAt` to `DiscoveryUnavailableError` (using consistent `503` status), route `discovery_unavailable` client errors through `discoveryFailureMessage` in both EN and FR, pass `forceRefresh` through single-repo board refresh, handle `board.discoveryFailed` after `/api/combined/board`, and clear/hide `#canvas-cards` (or show the failure state in Canvas mode) when `state.board === null`.
3. **Eliminate 3x duplication, toolbar overflow, contradictory CTA, and stale i18n (`web/public/app.js:1164-1215,6370-6373`, `web/public/theme.css:1297-1298`):** Keep `#scope-status` concise so `.status-strip` never pushes `#list-group-toggle`, `#new-task-btn`, or `#freshness` off-screen; hide `.empty-hint` and `#empty-create` while `discoveryFailed` is true; re-render the active discovery failure text inside `applyLanguage()`.
4. **Make rate-limit reset honest (`web/server/github.ts:211-226`, `web/server/repositories.ts:138-142`, `web/public/app.js:840,1079,6300-6323`):** Capture reset timestamp only from the failing response (not stale `sharedRateLimit.current.reset`), suppress `errorResetAt` when `reset * 1000 <= now`, include date/day context when reset falls on another day, and change `"the board will refresh after {time}"` to honest manual-refresh wording (`"refresh after {time}"` / `"actualisez après {time}"`) unless an actual post-reset timer is added.

---

## 4. Artifacts in This Directory

- `README.md` — This independent L4 adversarial review report.
- `probe.mjs` — Synthetic HTTP + headless Chromium reproduction script (read-only on repo source).
- `probe-results.json` — Captured JSON evidence from `probe.mjs`.
- `screenshots/lang-switch-stale-en-in-fr-1280.png` — Proof of 3x sentence duplication, off-screen `#new-task-btn`/`#freshness`, contradictory `Créer une tâche` CTA, and stale English failure strings after switching UI to French.
- `screenshots/canvas-stale-cards-on-auth-failure-1280.png` — Proof of stale interactive Canvas task card remaining visible when `state.board === null` during an `auth` discovery failure.
