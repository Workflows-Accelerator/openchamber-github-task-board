# Hostile Review 2: de726e4 (code) / de3641a (evidence)

Reviewer: independent dynamic agent, read-only on application code. Date: 2026-11-06.
Worktree: `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`, branch `feat/chamberos-board-v2`, HEAD `de3641a`.
Changes under review: `a578ffd..de3641a`; code commit `de726e4`. Evidence written only under `A-delivery/hostile2/`.

## Verdicts

| Item | Verdict |
|---|---|
| Spec | **FAIL**: fix-brief item 2 (canvas proof captured in real Chromium) was not met, and its stated blocker was false. Item 5 (computed smoke verdict) is only partly met because the console-error and CSP checks can never fail. |
| Quality | **NEEDS-FIXES** |
| Overall | **HALT**: the application dot grid and HUD are correct, but the proof presented for human review is misleading (see H2-1, H2-4), and the new outage guard has one false positive (H2-3). All fixes are small and bounded. |
| Dot grid (criterion 1d) | **RASTERIZER ARTIFACT:** real Chromium 156 renders the de726e4 two-stop gradient as faint, crisp dots at 25/50/72/100/200 % in light and dark. Obscura 0.2.6 draws the same black/white checkerboard on a standalone page that contains no app code, so the checkerboard in delivery screenshots 02/03 is an Obscura defect, not an app defect. |

## Findings

### H2-1 (moderate, evidence): the canvas proof still uses Obscura, and proof.md wrongly says Chromium cannot run
- `A-delivery/screenshots/02-canvas-notes-wires-1280-light-en.png` and `03-…-dark-en.png` were captured with Obscura and show the heavy checkerboard. The real app does not render it. `proof.md:76` lists them as preview proof with no caveat.
- `proof.md:102` says that "real Chromium (`chrome-headless-shell`) cannot run … missing `libglib-2.0.so.0`". That is false. The same binary used for the A2 screenshots runs once its missing shared libraries are supplied in user space. No root install and no system change are needed (see "Chromium setup" below).
- Fix: regenerate canvas shots 02/03 with Playwright and this chrome-headless-shell, and correct proof.md:102. Real-Chromium replacements that show the same composition are already in `hostile2/screenshots/chromium-canvas-fit-1280-{light,dark}-en.png`.

### H2-2 (low, evidence): Obscura HUD measurements are internally inconsistent, and the check still records PASS
- `A-delivery/canvas-measurements.json` comes from Obscura. At 1280 FR, `canvas-arrange` spans x 1195–1258 at y 124–150, which overlaps `canvas-reset-view` (x 1145–1248), while the HUD height is reported as 37. 768 FR shows the same overlap (633–736 against 683–746).
- `scripts/generate-delivery-smoke.mjs:331` checks only whether buttons fall outside the viewport. It does not check overlap, row consistency, or clickability, so these contradictory rects still produce `pass: true`.
- The actual layout is fine in Chromium (see criterion 2). The problem is the measurement source.

### H2-3 (low–moderate, app): the outage guard returns a false 502 when every known repository is unavailable
- `web/server/app.ts:1332` (archiveData) and `:1421` (operationsData) check `discovery.repositories.length > 0 && repositoriesLoaded === 0`.
- `discovery.repositories` also contains previously known repositories marked `available: false` (`web/server/repositories.ts:73`). The aggregator records them as `Unavailable` without loading them (`app.ts:1227-1229`).
- Reproduction (probe case B): the only repository loses token access, then the discovery TTL expires. `/api/combined/operations` and `/api/combined/archive` return **502 `discovery_unavailable`** ("Repository discovery failed"), even though discovery succeeded. `/api/combined/board` still returns 200 for the same state. The UI shows "Could not load" instead of an empty or unavailable state.
- Proposed fix, tried only in a disposable copy (`/tmp/opencode/hostile2-mut`): change both guards to `discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0`. Result: case B returns 200, case H (true outage) still returns 502, all other cases are unchanged, and `a5-sections.test.mjs` passes 11/11.
- Also worth noting: the error body for a post-discovery outage reuses the message "Repository discovery failed; no operation was dispatched", which is inaccurate for this case. The fix brief allowed this shape.

### H2-4 (moderate, tooling): the smoke script's console-error and CSP checks can never fail
- `scripts/generate-delivery-smoke.mjs:106-112` listens only to `Runtime.exceptionThrown` and `Log.entryAdded`. Obscura sends `console.error` as `Runtime.consoleAPICalled` and sends **zero** `Log.entryAdded` events (`raw/obscura-event-probe.log`: consoleAPICalled 4, Log.entryAdded 0). Exceptions thrown from timers also arrive as consoleAPICalled ("Timer error:").
- `cspViolations` (line 104) is declared but never written to, so it is always `[]`.
- Injection test: I added `console.error(...)` and an uncaught exception from an appended script to a disposable copy of the script. It **exited 0** with `browser diagnostics: PASS, exceptions [], consoleErrors []` (`raw/smoke-injection-consoleerr.log`, `raw/smoke-injection-probe.log`, `raw/smoke-injection-diagnostics.txt`).
- The wire-count check does work: changing the expected count to 5 made the script **exit 1** with "Smoke check failed with 1 failing check(s): Canvas view…" (`raw/smoke-injection-wires.log`).
- Five section checks still use the literal `verdict: 'PASS'` (lines 464, 472, 480, 488, 493). They have only the implicit `waitFor` throw as a guard. `proof.md:110` claims the static literals were replaced across all checks, which is inaccurate.
- Fix: subscribe to `Runtime.consoleAPICalled` (type `error`) as `scripts/audit-a5.mjs:206` already does, and either populate or remove `cspViolations`.

### H2-5 (low, test gap): the empty-account precondition is untested
- I removed the `discovery.repositories.length > 0 &&` precondition from both guards in the disposable copy. The full web suite still passed **575/575**.
- Probe case A shows the current code returns 200 for an empty account, but no test pins that behaviour.

### H2-6 (low, process): audit runs rewrite tracked files
- Running `scripts/audit-a5.mjs` and `scripts/audit-a5-packaged.mjs` rewrote the tracked files `A5/independent/browser.json` and `packaged-browser.json`.
- I saved copies to `raw/audit-a5-*.rerun.json` and restored both originals with `git checkout`. No change outside `hostile2/` is left.

## Criterion 1: dot grid

**a. How the A2 screenshots were made, and whether that still works.** `A2/generate-screenshots.mjs:6,102-106` used Playwright from `/workspace/personal/lucas/charme-social/node_modules/playwright` (1.63.0) with `executablePath: /workspace/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell` (Chrome for Testing 156.0.8078.4). The binary is still installed. The container has since lost its system libraries:
```
$ chrome-headless-shell --version
error while loading shared libraries: libglib-2.0.so.0: cannot open shared object file
$ ldd chrome-headless-shell | grep "not found"   # 20 libs: glib, gobject, nspr, nss, gio, atk, atk-bridge, dbus, X11, Xcomposite, Xdamage, Xext, Xfixes, Xrandr, gbm, xcb, xkbcommon, asound, atspi
```
A second launch then failed because fontconfig had no configuration:
```
FATAL:third_party/skia/src/ports/SkFontMgr_FontConfigInterface.cpp:163] Not implemented.  (page crashed at first text render)
```
I found no other usable engine: no system chromium/chrome/firefox, and no Firefox or WebKit builds in `ms-playwright`. The `/workspace/.npm/_npx/e41f203b7505f1fb` Playwright 1.65 expects headless_shell-1254, which is not installed.

**Chromium setup that worked.** Everything is user-space under `/tmp/opencode`; no root installs or system changes:
```
R=/tmp/opencode/hostile2-apt; O="-o Dir::State::Lists=$R/lists -o Dir::Cache=$R/cache -o Debug::NoLocking=1"
apt-get $O update
cd $R/debs && apt-get $O download libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libdbus-1-3 libx11-6 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libasound2 libatspi2.0-0 libxrender1 libdrm2 \
  libwayland-server0 libxau6 libxdmcp6 libxi6 libffi8 libpcre2-8-0 libexpat1 libbsd0 libmd0 libsystemd0 libxshmfence1 \
  fontconfig-config fonts-dejavu-core fonts-liberation libfontconfig1 libfreetype6 libpng16-16 libbrotli1
for d in *.deb; do dpkg-deb -x $d $R/root; done
# minimal fonts.conf pointing at $R/root/usr/share/fonts; env exported by hostile2/scripts/chromium-env.sh
. hostile2/scripts/chromium-env.sh && chrome-headless-shell --version   # Google Chrome for Testing 156.0.8078.4
```

**b. Captures.** Script: `hostile2/scripts/dot-grid-chromium.mjs`; data: `hostile2/dot-grid-chromium.json`; 0 page errors.
- App on preview :4041, panned to an empty region: `screenshots/chromium-app-grid-{light,dark}-{025,050,072,100,200}.png`
- App fit-all, same composition as delivery shot 02 (70 %): `screenshots/chromium-canvas-fit-1280-{light,dark}-en.png`. Both show faint dots, wires, notes and cards, with no checkerboard.
- Standalone HTML with identical gradient strings and no app code: `screenshots/chromium-standalone-{light,dark}-{025..200}.png`
- The same standalone page in Obscura (`scripts/dot-grid-obscura-standalone.mjs`): `screenshots/obscura-standalone-{light,dark}-{072,100}.png`. These show the full-surface checkerboard, which reproduces the artifact with no app involved.

Pixel statistics from Chromium, sampled over a 300×300 px empty region:

| zoom | light: min..max lum (bg 244) | dark: min..max lum (bg 20) | non-background pixels |
|---|---|---|---|
| 25 % | 218..244 | 20..46 | 0.72 % |
| 50 % | 214..244 | 20..49 | 0.72 % |
| 72 % | 212..244 | 20..52 | 2.35 % |
| 100 % | 208..244 | 20..56 | 0.72 % |
| 200 % | 203..244 | 20..60 | 0.52 % |

The standalone page gives the same numbers to within 0.05 %. The maximum deviation from the background is 26–41 luminance levels, which means faint dots. Obscura renders the same CSS as alternating near-black and near-white across the whole surface.

**c. Values from `web/public/app.js:2258-2269`.**

| zoom | worldStep | gridStep (px) | dotRadius (px) | alpha | dotRadius ÷ (gridStep/2) | dot area share |
|---|---|---|---|---|---|---|
| 25 % | 96 | 24.00 | 0.95 | 0.1150 | 0.08 | 0.5 % |
| 50 % | 48 | 24.00 | 1.05 | 0.1300 | 0.09 | 0.6 % |
| 72 % | 24 | 17.28 | 1.14 | 0.1432 | 0.13 | 1.4 % |
| 100 % | 24 | 24.00 | 1.25 | 0.1600 | 0.10 | 0.9 % |
| 200 % | 24 | 48.00 | 1.65 | 0.1800 | 0.07 | 0.4 % |

With `radial-gradient(C r, transparent r)` and the default `ellipse farthest-corner` shape, the colour stop is an absolute length along the gradient ray. A spec-compliant renderer paints a disc of radius r (at most 1.65 px) inside each tile and leaves the rest of the tile transparent. The dot radius is never more than 13 % of the half-tile and alpha is at most 0.18, so no combination can cover the tile. The fractional tile size of 17.28 px at 72 % produces sub-pixel phase variation only, and the measured effect is a 2.35 % pixel share because the tiles are denser. Obscura behaves as though it ignores or rescales absolute-px stops.

**d.** RASTERIZER ARTIFACT (see the verdict table). `app.js:2268` needs no change.

## Criterion 2: Canvas HUD

Script: `hostile2/scripts/hud-matrix-chromium.mjs`. Data: `hostile2/hud-matrix-chromium.json`. Log: `raw/hud-matrix-chromium.log`. Real Chromium, 12 cases (360/768/1280 × EN/FR × light/dark), each run once in the default state and once with the hidden "Undo arrange" button shown, giving 24 checks. Every button rect is checked for: inside 0..W, `elementFromPoint` at its centre lands on the button, the label is on one line, no overlap with a visible sidebar toggle, and no document overflow.

- **24/24 PASS. 0 page or console errors.**
- 360 FR: the HUD spans x 14..346 in two rows (66 px), or three rows (94 px) with "Annuler l'organisation" shown.
- 768 FR: one row, x 327..754. 1280 FR: one row, x 839..1266.
- I inspected `chromium-hud-360-en-dark.png`, `chromium-hud-360-fr-light-undo-visible.png`, `chromium-hud-768-fr-light-undo-visible.png` and `chromium-hud-1280-fr-dark.png` myself. All controls are fully visible, labels are on one line, and the HUD does not cover the 360 px hamburger toggle.
- Cosmetic only: at 360 px the first row holds just the zoom group, aligned right, which leaves an empty band on the left of the panel. Cards can sit under the floating HUD after a pan; this is normal floating-toolbar behaviour and does not block anything.
- All 24 screenshots are under `hostile2/screenshots/chromium-hud-*.png`.

## Criterion 3: total-outage guard

Probe: `hostile2/scripts/outage-guard-probe.mjs`. Data: `hostile2/outage-guard-probe.json`. Each case runs against an in-process board and synthetic GitHub.

| Case | ops / archive | Assessment |
|---|---|---|
| A empty account (0 discovered) | 200 / 200 | correct |
| B only repo lost access (known, `available:false`) | **502 / 502** | **false positive (H2-3)**; combined/board returns 200 |
| C only repo has issues disabled | 200 / 200 | correct |
| D only repo archived | 200 / 200 | correct |
| E page-bound truncation (perPage 1, 12 issues) | 200 / 200 | correct |
| F good + unavailable + failing | 200 partial / 200 | correct |
| G single-repo route, repo failing | 502 `github_unavailable` / 502 | path not affected by the guard |
| H all repos failing, no cache | 502 `discovery_unavailable` / 502 | correct |

UI for case H in Chromium, EN and FR. Operations shows "Could not load operations data: Server error. Please try again later.", the grid is hidden, and no zero counts are visible (`screenshots/chromium-total-outage-operations-1280-en.png`). Archive shows "Could not load archive: …". The FR strings are equivalent (`chromium-total-outage-*-1280-fr.png`).

Mutation checks, all in the disposable copy `/tmp/opencode/hostile2-mut` (the worktree's `app.ts` was never modified, verified with `git diff --quiet`):
- Both guards removed: the new test fails (expected 502, actual 200).
- Archive guard only removed: the test fails.
- Operations guard only removed: the test fails.
- `length > 0` precondition removed: the full web suite still passes 575/575 (H2-5).
- Proposed `some(r => r.available)` fix: a5-sections passes 11/11, and the probe gives B 200 with H still 502.

## Criterion 4: smoke verdict and proof.md counts

The smoke injection results are covered under H2-4. The injected variants ran from `/tmp/opencode/hostile2-mut` with `DELIVERY_DIR` redirected to `/tmp/opencode/hostile2-smoke`, so the A-delivery evidence was not touched. The unmodified baseline variant exited 0.

Reruns at de3641a. Exit codes are in `raw/exits.txt`:

| Command | Result | proof.md | Match |
|---|---|---|---|
| `timeout 900 npm test` | 618/618, 0 fail, 0 skip, exit 0 | 618/618 | yes |
| `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs` | 575/575, 0 fail, 0 skip, exit 0 | 575/575 | yes |
| `timeout 600 npm run typecheck` | exit 0 | PASS | yes |
| `timeout 120 node scripts/audit-a5-data.mjs` | 14 × PASS, exit 0 | 14/14 | yes |
| `timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs` | exit 0, `leaked: []`, exceptions/console `[]` | ALL PASS | yes |
| `timeout 240 env PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/de726e4-foundation node scripts/audit-a5-packaged.mjs` | 13 × PASS, exit 0 | 13/13 | yes |

The counts match. The proof.md prose that does not match is at lines 76, 102 and 110 (H2-1, H2-4).

## Criterion 5: staging and production isolation

- `(cd /tmp/opencode/board-v2-staging/de726e4-foundation && sha256sum -c --strict checksums.sha256)`: 13/13 OK, exit 0. Unlisted files 0, missing 0, symlinks 0.
- Every `web/public/*` file and `package.json` is byte-identical to `git show de726e4:…`.
- A fresh `npx esbuild web/server.ts … --outfile=/tmp/opencode/h2-server.mjs` produces the same SHA-256 as the staged `web/dist/server.mjs`. `git diff --quiet de726e4 HEAD -- web package.json` exits 0.
- `/workspace/releases/board/current` points to `/workspace/releases/board/98261a8-20261103`. The symlink mtime is still 2026-11-03 18:18.
- The production release checksum, `sha256sum -c --strict`, gives 11/11 OK, exit 0.
- `/workspace/.openchamber-data/board/` has 3 files: `initial-password` and `board.env` from 2026-10-27 12:03, and `sessions.json` from 2026-11-06 09:52 (650 bytes). The first hostile review recorded the same sessions.json time. No file is newer than 2026-11-06 17:00. I compared mtimes and file count only; I did not hash the contents because they are secrets.
- Production `:8787/health` returns 200, read-only.
- Preview `:4041/health` returns ok; PIDs 367095/367113 are alive and were not touched.

## NOT RUN

- Live GitHub writes (only synthetic GitHub was used).
- External preview access (the preview is bound to 127.0.0.1).
- Live cutover; no production restart.
- Human acceptance of canvas feel and aesthetics.
- Content hashes of the production state files; only mtimes were compared.
- Firefox and WebKit rendering (not installed).
- Touch or gesture interaction on the HUD; clickability was checked with `elementFromPoint`, not with real taps.

## Bounded fix list for the next builder

1. `web/server/app.ts:1332` and `:1421`: use `discovery.repositories.some((r) => r.available)`. Add a test for "the only known repo has become unavailable → 200" and one for "empty account → 200".
2. `scripts/generate-delivery-smoke.mjs:106-112`: capture `Runtime.consoleAPICalled` errors, and populate or remove `cspViolations`. Replace or justify the five literal `'PASS'` verdicts. Optionally add overlap and `elementFromPoint` checks to the HUD measurements.
3. Recapture A-delivery canvas shots 02/03, and preferably all 12, with Playwright and chrome-headless-shell using `hostile2/scripts/chromium-env.sh`. Correct proof.md lines 76, 102 and 110.
