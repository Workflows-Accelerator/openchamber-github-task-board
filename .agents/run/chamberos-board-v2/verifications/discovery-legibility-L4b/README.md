# Independent Delta Hostile L4b Review — Discovery Failure Legibility (`07b8435..9732699`)

- **Date:** 2026-11-14
- **Branch / HEAD:** `feat/board-v3` @ `9732699` (code reviewed `07b8435..9f4ed2a`; proof refresh `9732699`)
- **Base reviewed:** `07b8435` (prior `discovery-legibility-L4` FAIL report)
- **Mode:** Read-only on `web/**`, `test/**`, and all prior verification directories. Every probe used synthetic local fixtures (`startFakeGitHub`, `startBoard`, a `vm` DOM stub). Zero real tokens, zero `board.env` reads, zero production traffic, zero pushes.
- **Verdicts:**
  - `SPEC_VERDICT`: **PASS**
  - `QUALITY_VERDICT`: **PASS_WITH_NOTES** (P2 only)
  - `PUBLISH_VERDICT`: **YES**, provided the deployment rebuilds `web/dist/server.mjs` (see §7)

---

## 1. Scope

`git diff --stat 07b8435..9f4ed2a` = 10 files, +509 / −84:

| File | Lines |
|---|---|
| `web/server/github.ts` | +25 −11 |
| `web/server/repositories.ts` | +28 −10 |
| `web/server/app.ts` | +26 −14 |
| `web/public/app.js` | +172 −22 |
| `web/public/theme.css` | +23 |
| `web/public/index.html` | +1 −1 |
| `web/tests/discovery-legibility.test.mjs` | +210 −? |
| `web/tests/fake-github.mjs` | +27 −8 |
| `web/tests/a5-sections.test.mjs` | +6 −6 |
| `web/tests/multi-repo-client.test.mjs` | +2 −1 |

`9732699` touches only `verifications/discovery-legibility/{README.md,report.json,verify.mjs}` plus 33 screenshots; no `web/**` code changed after `9f4ed2a`.

---

## 2. Finding-by-finding closure

### P1-1 — Credential / status classification — **CLOSED**

- `web/server/repositories.ts:24-29` now maps `unauthorized` **and** `forbidden` to `auth`, with the reason string `"GitHub refused the board token or its permissions"` (51 chars, no token/body leak).
- `web/server/github.ts:133-152` decides by status **before** the non-JSON bail-out:
  - `401 → unauthorized`, `429 → rate_limited`, `403 → rate_limited` when `x-ratelimit-remaining: 0` or message contains `rate limit`, else `forbidden`; only then `!jsonParsed → server`.
  - `remaining`/`message` are computed defensively for non-object bodies.
- Empirical: `403 {"message":"Resource not accessible by personal access token"}` → `errorKind: "auth"`; non-JSON `401 text/plain` → `auth`; non-JSON `429 text/plain` with `x-ratelimit-remaining: 0` → `rate_limited` (tests + my runs below).

### P1-2 — Cause propagation, 503 consistency, Canvas, drawer/mutation copy — **CLOSED**

- `DiscoveryUnavailableError` (`repositories.ts:53-62`) carries `errorKind` + `errorResetAt`; every throw site passes the view (`app.ts:1748,1752,1837,1841`, `repositories.ts:104`). No zero-argument construction remains.
- All discovery refusals are **503**: `resolveRepository` (`app.ts:461-466`) forwards `errorKind`/`errorResetAt` through `HttpError.extra`; `archiveData`/`operationsData` (`app.ts:547-556`) changed `502 → 503` with the same fields; tests `a5-sections.test.mjs` updated accordingly (only 502 references for discovery are gone).
- `?refresh=1` is parsed once (`app.ts:683`) and passed to `resolveRepository(..., { forceRefresh })` on both `/api/repos/:owner/:name/...` and `/api/board`; `RepositoryRegistry.resolve` (`repositories.ts:96-107`) refreshes before the allow-list check when forced. Test: latched 503 → `?refresh=1` → 200.
- Client:
  - `api()` localizes `503 discovery_unavailable` for both writes (`app.js:425-437`) and reads (`app.js:488-499`) via `discoveryFailureMessage`, EN/FR.
  - `openIssue` (`app.js:7640-7644`), quick-add (`app.js:8832-8836`), `save-status`/`setNotice` paths use the localized message and avoid a doubled period.
  - `canvasMoveFailureMessage` (`app.js:3851-3853`) routes `discovery_unavailable` through the same helper.
- Canvas: `clearCanvasForDiscoveryFailure()` empties `#canvas-cards`, `#canvas-wires`, `#canvas-wire-labels`, `#canvas-overlay`, resets `canvasCardRectsCache`/`currentCanvasIssues`; `theme.css:1665-1672` hides `#canvas-viewport` and shows `#empty-state` while `is-discovery-failed`. Verified by unit test, `report.json.canvasFailure` (`cardCount 0`, `wireCount 0`, `viewportDisplay "none"`, `ctaHidden true`, `ctaDisabled true`) and `screenshots/canvas-discovery-failure-1280.png`.
- Mid-refresh: `loadBoard` checks `board.discoveryFailed` after `/api/combined/board` and calls `enterDiscoveryFailure` **without** `saveCachedBoard` (`app.js:6493-6496`). My independent harness confirmed `state.board === null`, no `tb_cached_board` write, and the failure sentence shown.

### P1-3 — Repetition, 1280 overflow, CTA, language switch — **CLOSED**

- Toolbar now shows only a short cause label: `discoveryStatusLabel()` (`app.js:6373-6383`) + new `discovery_short_*` keys (4 EN + 4 FR). Full sentence remains in `#notice` and `#empty-state` (2 visible occurrences, by design; the third, `#discovery-status`, is `hidden` in markup).
- `theme.css:1297-1312`: `.status-strip-scope { flex: 0 1 auto; min-width: 0; max-width: 34ch; overflow: hidden; text-overflow: ellipsis }` and buttons/count/freshness `flex: 0 0 auto`. `report.json` (committed, `9732699`): 16 layout rows, `scrollWidth - clientWidth = 0` everywhere; `#list-group-toggle` (419–488), `#new-task-btn` (500–588), `#freshness` (600–692) inside a 1280 viewport.
- `renderDiscoveryFailure()` (`app.js:6418-6438`) hides `#empty-hint` and sets `#empty-create` `hidden` + `disabled`; `clearDiscoveryFailure()` (`app.js:6407-6415`) restores both.
- `applyLanguage` (`app.js:1237-1239`) re-renders an active failure when `state.board === null`; EN↔FR switch verified by unit test, `report.json.languageSwitch` (8 rows) and `verify.mjs:207-224`.
- `clearDiscoveryFailure()` is present in the success path, the unavailable-repo branch (`app.js:6477-6481`) and the generic-error branch (`app.js:6528-6534`). I exercised all three independently (§4). One residual: the generic-error branch does not reset `#scope-status` (P2-1 below); `state.discoveryFailure` itself is cleared correctly.

### P1-4 — Reset-time honesty — **CLOSED**

- `GitHubError.rateLimitReset` (`github.ts:23-40`) is populated only from the **failing** response's own `x-ratelimit-reset` (`github.ts:322-341`), `null` otherwise. `RepositoryRegistry.rateLimitResetAt(error)` (`repositories.ts:152-159`) reads only that field — the stale `sharedRateLimit.current.reset` path is gone — and suppresses `reset * 1000 <= now`.
- Client `discoveryResetClock` (`app.js:6334-6352`) also suppresses a past ISO, keeps `HH:MM` same-day, and adds `weekday day month` context on another day; locale follows EN/FR.
- Copy is honest: `discovery_failed_rate_limited` = “GitHub is limiting the board temporarily. Refresh after {time}.” / “Actualisez après {time}.”; no “will refresh” promise remains (grep + `verify.mjs:157`).

### P2 — Test / browser-proof integrity — **CLOSED (with residual gaps)**

- `fake-github.mjs` now supports `null` header suppression, non-JSON string bodies, a `forbidden` 403 mode, a headerless `rate_limited_secondary` 403 mode, and `setDiscoveryResetAt(null)`; `setDiscoveryResponse` forwards headers.
- `discovery-legibility.test.mjs` reset time moved to `2030-01-15`, covers 403-forbidden, non-JSON 401/429, headerless secondary limit, past reset, 503 cause on repo/archive routes, `refresh=1` latch escape, Canvas clearing, and EN↔FR re-render.
- `verify.mjs` now asserts real geometry: `.status-strip` `scrollWidth <= clientWidth`, bounding boxes of `#list-group-toggle`/`#new-task-btn`/`#freshness` inside the viewport on both axes, short scope label, hidden+disabled CTA, language-switch re-render, and Canvas card/wire counts.
- Mutation testing (§5) proves the focused suite fails on every reverted fix (7/7 caught). Four required behaviours are still **not covered by the committed suite** (P2-2).

---

## 3. Independent command executions

| Command | Result |
|---|---|
| `node --test --test-timeout=60000 web/tests/discovery-legibility.test.mjs` | **24 pass / 0 fail**, exit 0 |
| `node --test --test-timeout=60000 web/tests/*.test.mjs` | **737 pass / 0 fail**, exit 0 |
| `npm test` | **618 pass / 0 fail**, exit 0 |
| `npm run typecheck` | exit 0 |
| `npx tsc -p web/tsconfig.json --noEmit` | exit 0 |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave6f-l4b-server.mjs` | exit 0 (255,918 B) |
| `npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/antigravity/wave6f-l4b-app.js` | exit 0 (433,447 B) |
| `I18N` parity (vm evaluation of `app.js`) | EN 254 / FR 254, `onlyEn []`, `onlyFr []` |
| Forbidden tokens in all `discovery_*` EN/FR strings (`n8n`, `mobile`, emoji, `!`) | none |
| Diff scan for `console.log`, inline `style=`, emoji in `07b8435..9f4ed2a` | none |
| `git status --porcelain` before writing this report | only `?? …/V4-1-L4/` (not staged) |

No assertions were weakened; the only test edits are the `502 → 503` expectation change and the F3 message regex, which now matches the localized sentence and still asserts “no UNKNOWN / no double period”.

---

## 4. Independent recovery / mid-refresh probes (my own harness)

Scripts kept outside the repo (`/tmp/opencode/l4b-recovery.mjs`, `l4b-recovery2.mjs`), running the real `web/public/app.js` in a `vm` DOM stub:

| Scenario | Observed |
|---|---|
| discovery `auth` failure | `state.board null`, `state.discoveryFailure.errorKind "auth"`, `#empty-create hidden+disabled`, `#empty-hint hidden`, `is-discovery-failed` set, `#scope-status "GitHub token refused"`, notice = empty-card = full EN sentence, **no** `tb_cached_board` write |
| recovery (success) | failure `null`, class removed, CTA + hint restored, `#scope-status "All Projects"`, notice cleared/hidden, board cached (`tb_cached_board`) |
| mid-refresh `board.discoveryFailed` | `state.board null`, `errorKind "rate_limited"`, failure sentence + short label, CTA hidden, **no** cache write (cached board preserved) |
| failure → EN→FR switch | empty card, notice and scope label all in FR |
| failure → generic network error | `state.discoveryFailure null`, class removed, CTA/hint restored, empty card “The board could not be loaded: network down” — **`#scope-status` still “GitHub token refused”** (P2-1) |
| failure → unavailable selected repo | `state.discoveryFailure null`, class removed, CTA/hint restored, scope + card show the unavailable message |

---

## 5. Test-integrity mutation matrix

Applied to a throw-away copy (`/tmp/opencode/l4b-mut`, real `web/` + `panel/` + `service/`), each mutation reverted before the next:

| Mutation | Focused suite |
|---|---|
| M1 `forbidden` back to `server` | **FAIL** (1) — “403 permission refusal is an auth failure” |
| M2 non-JSON bail-out before status checks | **FAIL** (1) — “non-JSON 401 and 429” |
| M3 reset from `sharedRateLimit.current.reset` | **FAIL** (1) — “headerless secondary rate limit” |
| M4 drop past-reset suppression | **FAIL** (1) — “reset time already in the past” |
| M5 full sentence back into `#scope-status` | **FAIL** (9) — EN/FR client rows |
| M6 skip `clearCanvasForDiscoveryFailure` | **FAIL** (1) — “clears Canvas cards” |
| M7 skip `renderDiscoveryFailure` on language switch | **FAIL** (1) — “switching language re-renders” |
| M8 remove mid-refresh `board.discoveryFailed` guard | **PASS** (24) — **untested** (P2-2) |
| M9 drop `{ forceRefresh }` on repo route | **FAIL** (1) — “refresh=1 re-checks GitHub” |
| M10 drop `clearDiscoveryFailure()` in unavailable branch | **PASS** — **untested** (P2-2) |
| M11 drop `clearDiscoveryFailure()` in generic-error branch | **PASS** — **untested** (P2-2) |
| M12 hardcode English in the read 503 branch | **PASS** — **untested** (P2-2) |

---

## 6. Residual findings (all P2, none block the four P1 closures)

1. **P2-1 — stale `#scope-status` after failure → generic load error.** `loadBoard`’s generic-error branch (`app.js:6522-6536`) clears `state.discoveryFailure` and the class but never rewrites `#scope-status`, so the strip can keep “GitHub token refused” while the card says the board could not be loaded. One-line fix: set `#scope-status` to the scope name (or clear it) in that branch.
2. **P2-2 — four required behaviours are not covered by the committed tests:** mid-refresh `board.discoveryFailed` guard, `clearDiscoveryFailure()` in the unavailable/generic branches, and EN/FR localization of the read-503 path (M8, M10, M11, M12 stay green). I verified all four by inspection + the §4 harness; adding three small assertions would lock them.
3. **P2-3 — Archive/Operations views collapse a 503 to “Server error.”** Their catches (`app.js:8378-8384`, `8430-8437`) check `status >= 500` before `err.message`, so `discovery_unavailable` is shown as `dict.error_server` rather than the cause sentence. Outside the four cited surfaces, but it is the last surface that does not name the cause.
4. **P2-4 — `web/dist/server.mjs` on disk predates the fix.** It is gitignored, 14:26 (before `9f4ed2a`), and still contains the generic `503` message and the `502` archive body. A live deploy that runs `npm run start:web` without rebuilding would ship none of these fixes. `hosting.test.mjs` only builds when the file is missing.
5. **P2-5 — `showLogin()`/`clearRenderedData()` do not reset `state.discoveryFailure` or remove `is-discovery-failed`.** Harmless today (the next successful load clears both), but it is the one state field with no reset on sign-out.
6. **P2-6 — `#new-task-btn` stays enabled during a discovery failure.** `#empty-create` is correctly hidden/disabled; the toolbar capture button remains, and now fails with the honest localized sentence. Minor contradiction, not a data risk.
7. **P2-7 — non-JSON `403` has no dedicated test** (the `forbidden` JSON 403 and the non-JSON 401/429 are covered).

---

## 7. Visual / browser verification

- **Chromium cannot launch in this container.** `verify.mjs` fails at `browserType.launch`: `chrome-headless-shell: error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file`; `ldd` also lists `libnss3`, `libgio`, `libX11`, `libgbm`, … as missing, and no copy exists under `/workspace` or `/tmp`. The `chromium-env.sh` helper’s `/tmp/opencode/hostile2-apt/root/...` library tree no longer exists. I therefore could **not** re-measure `scrollWidth`/bounding boxes myself.
- I did run the real `verify.mjs` (from a copy under `/tmp/opencode/l4b-browser`, so the tracked verification directory stayed read-only) and it fails only at that launch step.
- I inspected the committed post-fix captures (33 files, committed in `9732699`): `discovery-auth-1280-dark-fr.png`, `discovery-rate_limited-1280-light-en.png`, `discovery-auth-390-light-fr.png`, `canvas-discovery-failure-1280.png`, `discovery-server-1280-dark-en.png`. They show: short scope label (`Jeton GitHub refusé` / `GitHub rate limit` / `Discovery failed`), `Flat list`/`New task`/`Loaded just now` fully inside 1280, create CTA absent, `Switch project` present, full sentence only in the notice + empty card, rate-limit reset with date context (`Refresh after Tue 15 Jan 10:30`), and Canvas with no cards, no floating controls, viewport hidden.
- `report.json` (committed) is internally consistent with those images: 32 rows, 16 layout rows, max overflow `0`, `pageErrors/consoleErrors/cspViolations` all `0`, 8 language-switch rows, Canvas `cardCount 0 / wireCount 0 / viewportDisplay "none" / emptyDisplay "block" / ctaHidden+Disabled`.
- Static check of the CSS supports the measurement: `.status-strip-scope` is the only shrinkable item and is capped at `34ch`; brand is hidden at desktop width (`theme.css:3404`); strip is hidden entirely on phones (`theme.css:3477`).

---

## 8. Publish conditions

`9f4ed2a` is source-ready: all four P1 findings and the P2 test-integrity finding are genuinely closed, with regression-sensitive tests and consistent EN/FR copy. Before publishing live:

1. Rebuild the bundle (`npx esbuild web/server.ts … --outfile=web/dist/server.mjs`) — the on-disk artifact is stale (P2-4).
2. Optionally land the three-line P2-1 scope-label reset and add the four missing assertions (P2-2) in a follow-up; neither is a blocker for this publish.

---

## 9. Artifacts

- `README.md` — this report. No other files were written in the repository.
- External scratch (not committed): `/tmp/opencode/l4b-mut/*` (mutation copy), `/tmp/opencode/l4b-recovery*.mjs` (vm harness), `/tmp/opencode/l4b-browser/*` (verify.mjs copy + failed launch log), `/tmp/antigravity/wave6f-l4b-{server,app}.*` (bundles).
