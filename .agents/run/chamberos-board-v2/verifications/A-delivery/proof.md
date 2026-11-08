# A1–A5 Foundation Delivery Proof

## 1. Verified Release Identity & Scope

- **Worktree:** `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`
- **Branch:** `feat/chamberos-board-v2`
- **Packaged Code Commit SHA:** `59e5d05` (`59e5d05ec97ad506a3c48f36a212382ca599e3e2`)
- **Staged Release Artifact:** `/tmp/opencode/board-v2-staging/59e5d05-foundation/`
- **Isolated Preview State Directory:** `/tmp/opencode/board-v2-staging/59e5d05-state/`
- **Included Scope (per D30 & D31):**
  - **A1:** V1 Warm-Paper & Dark Design Tokens, Typography, Collapsible Sidebar Navigation, Bilingual EN/FR Shell (`06c75bf`)
  - **A2:** Interactive Infinite Canvas Core (Pan, Zoom, Persistence, List/Canvas Switcher) (`62f3e8c`..`3034e32`)
  - **A3:** Dependency Wires, Interactive Wire Creation/Deletion, Drawer Dependency Chips (`3685c24`..`39e38a5`)
  - **A4:** Sticky Notes, Safe Markdown Rendering, Topological Auto-Arrange & Undo (`d0d5b72`..`d2bd9dc`, `b7f1517`, `ddfaa2c`, `c1f1807`, `de726e4`, `59e5d05`)
  - **A5:** Decisions, Blocked, Operations, Archive & Backburner Sections, and Global Client Presentation Mode (`341ff45`..`c1f1807`, `de726e4`, `59e5d05`)
- **Deferred Scope (per D30 & D31):** Track B (`B1`–`B4`), Track C (`C1`–`C3`), and Track D (`D1`–`D3`) are intentionally excluded from this foundation preview.

---

## 2. Packaging & SHA-256 Checksum Verification

The foundation release artifact was built using the supervisor-compatible layout (`package.json`, `web/public/**`, `web/dist/server.mjs`, `checksums.sha256`):

```bash
npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external \
  --outfile=/tmp/opencode/board-v2-staging/59e5d05-foundation/web/dist/server.mjs
```

Strict checksum verification (`(cd /tmp/opencode/board-v2-staging/59e5d05-foundation && sha256sum -c --strict checksums.sha256)`):

```text
package.json: OK
web/dist/server.mjs: OK
web/public/app.js: OK
web/public/apple-touch-icon.png: OK
web/public/arrange.js: OK
web/public/icon-192.png: OK
web/public/icon-512.png: OK
web/public/icon.svg: OK
web/public/index.html: OK
web/public/manifest.json: OK
web/public/markdown.js: OK
web/public/sw.js: OK
web/public/theme.css: OK
UNLISTED_COUNT=0
```

---

## 3. Automated Test, Typecheck, and Independent Audit Summary

| Check | Command | Result | Raw Log Path |
|---|---|---|---|
| Legacy & unit suite | `timeout 900 npm test` | **618 / 618 PASS** (0 fail, 0 skipped) | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/npm-test-repair-final.log` |
| Web integration & audit suite | `timeout 900 node --test --test-timeout=30000 web/tests/*.test.mjs` | **575 / 575 PASS** (0 fail, 0 skipped) | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/web-test-repair-final.log` |
| TypeScript typecheck | `timeout 600 npm run typecheck` | **PASS** (exit 0, 0 errors) | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/typecheck-repair-final.log` |
| Independent data probe | `timeout 120 node scripts/audit-a5-data.mjs` | **14 / 14 PASS** | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/data-repair-final.log` |
| Observational browser trace probe (not an asserted suite) | `timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs` | **Exit 0; 58 observational trace records, no assertions, no verdict fields.** Recorded observations: `leaked: []`, empty exceptions/console/CSP arrays (Obscura renderer). Wrong recorded values would not fail this command; only a thrown JavaScript error would. | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/browser-repair-final.log` |
| Packaged release browser probe | `timeout 180 env PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/59e5d05-foundation node scripts/audit-a5-packaged.mjs` | **13 / 13 PASS** (0 exceptions, 0 console/CSP errors) | `/tmp/opencode/packaged-browser.json` |
| Asserted real-Chromium delivery smoke (fix4) | `source .../hostile2/scripts/chromium-env.sh; DELIVERY_DIR=/tmp/opencode/fix4-baseline-rLN3 timeout 200 node scripts/generate-delivery-smoke.mjs` | **Exit 0; 10 / 10 computed PASS verdicts**, including two-axis HUD containment against `#canvas-viewport` in all 9 matrix cases and browser diagnostics (0 exceptions, 0 console errors, 0 CSP violations). This, not the observational probe above, is the asserting browser evidence. | `.agents/run/chamberos-board-v2/verifications/A-delivery/fix4/raw/smoke-baseline-direct.log` |

---

## 4. Persistent Foundation Preview Server & Smoke Verification

- **Preview URL:** `http://127.0.0.1:4041`
- **Health Endpoint:** `GET http://127.0.0.1:4041/health` -> `200 OK` `{"status":"ok","version":"1.2.1"}`
- **Process Metadata (`/tmp/opencode/board-v2-staging/59e5d05-state/preview-meta.json`):**
  - Supervisor wrapper PID: `486338`
  - Packaged `node web/dist/server.mjs` PID: `486368`
  - Synthetic GitHub API base: `http://127.0.0.1:44821` (bridged via `--import /tmp/opencode/board-v2-staging/59e5d05-state/preload.mjs` so the packaged bundle runs unmodified without live GitHub traffic or production credentials)
  - Session storage: `/tmp/opencode/board-v2-staging/59e5d05-state/sessions.json`
- **Access Limit (not verified):** `http://127.0.0.1:4041` binds only to container loopback. External access needs SSH forwarding to a host sharing (or reaching) the container network namespace, or a user-approved preview ingress; neither has been set up or verified. `https://board.workflows.ac` is production (`127.0.0.1:8787`), not this preview.

### Preview Smoke Check Screenshots (`.agents/run/chamberos-board-v2/verifications/A-delivery/smoke.json`)

All 12 delivery screenshots were captured from `http://127.0.0.1:4041` in real Chromium (`chrome-headless-shell 156.0.8078.4` via `hostile2/scripts/chromium-env.sh`) through Playwright CDP, recording `exceptions: []`, `consoleErrors: []`, and `cspViolations: []`:

- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/01-list-1280-light-en.png` — 1280 × 900; 87693 bytes; SHA-256 `34fff70fe5b719ede177ae1f82ac8e53bda116ff47b47e56a4bbc2cbb564f7d3`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/02-canvas-notes-wires-1280-light-en.png` — 1280 × 900; 143448 bytes; SHA-256 `80c7290328ba73d6bfcf0a87967daeb4e87dbba3e25b1768ff171a32d7d4f48d`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/03-canvas-notes-wires-1280-dark-en.png` — 1280 × 900; 143966 bytes; SHA-256 `e80f5a3c2e1a718954c8f40cebc216d91f863f58573c691ffd8471fdb361cf59`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/04-decisions-1280-dark-en.png` — 1280 × 900; 40723 bytes; SHA-256 `91e66c386ff9c5470fb8e32069d2c681872ffc071c80a7f6dd2aeca7e80945a0`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/05-decisions-768-light-fr.png` — 768 × 900; 23106 bytes; SHA-256 `001a755a7f90e32ab38f7b97a569af57a30ac1dbda0cb30a1cbec28975a99245`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/06-blocked-1280-dark-en.png` — 1280 × 900; 77392 bytes; SHA-256 `3a87a210df8c139386eb3f139d6fba0fdd9bdd91d6201ffb811036722ee498e6`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/07-blocked-360-dark-en.png` — 360 × 800; 45667 bytes; SHA-256 `639cbd76912606d9d468bedcb809c2879f3ad926a7f1150315197b03a1bd4ea7`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/08-operations-1280-dark-en.png` — 1280 × 900; 49444 bytes; SHA-256 `0857d372ee24641a0873c6a641126e6395e385da62f4129c4c2ad5d3dd1a8e7d`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/09-operations-1280-light-fr.png` — 1280 × 900; 49631 bytes; SHA-256 `a4e7292e888df7d7479f6d7ce31163f63fa5ee00cdb1c5ada665e0d020d4f955`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/10-archive-1280-dark-en.png` — 1280 × 900; 37869 bytes; SHA-256 `4fdd73c03be5ec60ef90d812b934c43f481de29b113ad6af617d319bc17e8c70`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/11-client-1280-dark-en.png` — 1280 × 900; 86372 bytes; SHA-256 `93faab0e1c5de01dd6519fc57f2ffd88d8a28d4c9ebe6d1fed3e0e57167e0891`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/12-client-360-dark-en.png` — 360 × 800; 48233 bytes; SHA-256 `afbbe5d6cf53022598f6b388de4ede3fc58360e960c0e7f7890109b8d9f716f0`.

---

## 5. Hostile Review Finding Resolutions (de726e4 -> 59e5d05)

1. **Finding H2-1 — Real Chromium Canvas Delivery Proof:**
   - Corrected false statement that real Chromium cannot run in the container. Installed user-space shared libraries and fontconfig under `/tmp/opencode/hostile2-apt` via `chromium-env.sh`, launching `chrome-headless-shell 156.0.8078.4` cleanly without root permissions.
   - Recaptured all 12 delivery screenshots (including canvas shots 02 and 03) using Playwright over real Chromium. Shots 02 and 03 render crisp, faint dots with no checkerboard rasterizer defect.
2. **Finding H2-2 — Real Chromium Canvas HUD Measurements & Overlap Detection:**
   - Re-measured the 9-case matrix (`canvas-measurements.json`) in real Chromium. At 1280 FR, `canvas-reset-view` (x: 1050..1173) and `canvas-arrange` (x: 1185..1259) have a 12px horizontal separation with zero overlap. At 768 FR and 360 mobile, all buttons remain fully contained with zero overlap.
   - The previously reported overlap in `canvas-measurements.json` was an Obscura measurement artifact.
3. **Finding H2-3 — False 502 on Unavailable Repositories (`web/server/app.ts:1332, 1421`):**
   - Repaired both outage guards: `discovery.repositories.some((r) => r.available) && (board.repositoriesLoaded ?? 0) === 0`.
   - When a known repository loses token access after initial discovery, `/api/combined/operations` and `/api/combined/archive` return HTTP 200 with `partial: true` (matching `/api/combined/board`), while true total outages (zero accessible repositories or discovery failure) still return HTTP 502 `discovery_unavailable`.
4. **Finding H2-4 — Dynamic Smoke Script Assertions & Fault Injections:**
   - Replaced Obscura CDP client in `scripts/generate-delivery-smoke.mjs` with Playwright over real Chromium, adding active listeners for `Runtime.consoleAPICalled` (type `error`), `Runtime.exceptionThrown`, `Log.entryAdded`, and in-page `securitypolicyviolation`.
   - Replaced all 5 static `verdict: 'PASS'` literals with dynamic Boolean checks across HTTP health, card counts, wire counts (exactly 4), exceptions (0), console errors (0), CSP violations (0), and canvas containment metrics. Added rectangular bounding-box overlap detection across all HUD buttons.
   - Injected faults into console errors, uncaught exceptions, and button overlaps; confirmed non-zero exits on each failure type and documented results in `.agents/run/chamberos-board-v2/verifications/A-delivery/smoke-negative.md`.
5. **Finding H2-5 — Unit Tests for Outage Guard Edge Cases (`web/tests/a5-sections.test.mjs`):**
   - Added unit test cases for "sole known repository becomes unavailable -> 200 partial" and "empty account with zero discovered repos -> 200 empty".
   - Mutation-verified independently in fix4 (`fix4/mutation.md`): dropping either clause or inverting `=== 0` at either guard (6 mutants) fails at least one named `a5-sections.test.mjs` test; unmutated `59e5d05` copy passes 11/11.
6. **Finding H2-6 — Audit Scripts Non-Destructive Outputs (`scripts/audit-a5.mjs`, `scripts/audit-a5-packaged.mjs`):**
   - Redirected output paths in both audit scripts to env-configurable variables defaulting to `/tmp/opencode/`, ensuring test reruns do not rewrite tracked git evidence.

7. **Hostile Review 3 (fix4, tooling/docs only; application `59e5d05` unchanged):**
   - **H3-1:** `scripts/generate-delivery-smoke.mjs` now asserts both axes of every visible HUD control against `#canvas-viewport` and names offending controls with rects. Above (`translateY(-2000px)`) and below (`translateY(2000px)`) injections each exit 1 naming `canvas-arrange`; the seven earlier hostile3 injections still exit 1; baseline exits 0 with 10/10 computed PASS (`smoke-negative.md` fix4 section, `fix4/smoke-challenges.json`, `fix4/raw/`).
   - **H3-2:** `human-review.md` password corrected to `correct horse battery staple` (spaces); access limit stated as unverified.
   - **H3-3:** `scripts/audit-a5.mjs` relabelled above as an observational trace probe; the asserted Chromium smoke is cited as a separate row.
   - **Unfinished hostile3 checks:** guard mutations (`fix4/mutation.md`) and Undo-arrange-visible HUD recheck at 360/1280 FR light/dark in real Chromium against the staged bundle: both axes contained, zero overlap (`fix4/undo-visible.md`, `fix4/undo-visible.json`, `fix4/screenshots/`).

---

## 6. Verification Blind Spots & Explicit NOT RUN Declarations

1. **Live GitHub Mutations:** Zero live GitHub issues, comments, labels, or dependencies were mutated. All checks ran against synthetic test fixtures.
2. **External Browser Preview Access:** NOT VERIFIED. The preview server is bound to container loopback (`127.0.0.1:4041`). Remote access requires SSH forwarding to a host sharing the container network namespace, or a user-approved ingress; no such endpoint has been supplied or tested.
3. **Live Production Cutover:** Production symlink `/workspace/releases/board/current` remains pointing to `98261a8-20261103`, and production port `:8787` remains untouched.
4. **Human Acceptance:** Human tactile verification of canvas panning feel, wire ergonomics, and overall aesthetic polish remains pending.
