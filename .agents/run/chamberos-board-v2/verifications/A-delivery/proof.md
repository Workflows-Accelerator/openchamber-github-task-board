# A1–A5 Foundation Delivery Proof

## 1. Verified Release Identity & Scope

- **Worktree:** `/workspace/code/openchamber-github-task-board/.worktrees/team-dev-chamberos-board-v2`
- **Branch:** `feat/chamberos-board-v2`
- **Packaged Code Commit SHA:** `de726e4` (`de726e4ad3ffb168f645f573fa5a80a4dd05dc10`)
- **Staged Release Artifact:** `/tmp/opencode/board-v2-staging/de726e4-foundation/`
- **Isolated Preview State Directory:** `/tmp/opencode/board-v2-staging/de726e4-state/`
- **Included Scope (per D30 & D31):**
  - **A1:** V1 Warm-Paper & Dark Design Tokens, Typography, Collapsible Sidebar Navigation, Bilingual EN/FR Shell (`06c75bf`)
  - **A2:** Interactive Infinite Canvas Core (Pan, Zoom, Persistence, List/Canvas Switcher) (`62f3e8c`..`3034e32`)
  - **A3:** Dependency Wires, Interactive Wire Creation/Deletion, Drawer Dependency Chips (`3685c24`..`39e38a5`)
  - **A4:** Sticky Notes, Safe Markdown Rendering, Topological Auto-Arrange & Undo (`d0d5b72`..`d2bd9dc`, `b7f1517`, `ddfaa2c`, `c1f1807`, `de726e4`)
  - **A5:** Decisions, Blocked, Operations, Archive & Backburner Sections, and Global Client Presentation Mode (`341ff45`..`c1f1807`, `de726e4`)
- **Deferred Scope (per D30 & D31):** Track B (`B1`–`B4`), Track C (`C1`–`C3`), and Track D (`D1`–`D3`) are intentionally excluded from this foundation preview.

---

## 2. Packaging & SHA-256 Checksum Verification

The foundation release artifact was built using the supervisor-compatible layout (`package.json`, `web/public/**`, `web/dist/server.mjs`, `checksums.sha256`):

```bash
npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external \
  --outfile=/tmp/opencode/board-v2-staging/de726e4-foundation/web/dist/server.mjs
```

Strict checksum verification (`(cd /tmp/opencode/board-v2-staging/de726e4-foundation && sha256sum -c --strict checksums.sha256)`):

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
| Independent browser probe | `timeout 240 env AUDIT_NO_SHOTS=1 node scripts/audit-a5.mjs` | **ALL PASS** (`leaked: []`, 0 exceptions, 0 console/CSP errors) | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/browser-repair-final.log` |
| Packaged release browser probe | `timeout 180 env PACKAGED_RELEASE_DIR=/tmp/opencode/board-v2-staging/de726e4-foundation node scripts/audit-a5-packaged.mjs` | **13 / 13 PASS** (0 exceptions, 0 console/CSP errors) | `.agents/run/chamberos-board-v2/verifications/A5/independent/raw/packaged-browser-final.log` |

---

## 4. Persistent Foundation Preview Server & Smoke Verification

- **Preview URL:** `http://127.0.0.1:4041`
- **Health Endpoint:** `GET http://127.0.0.1:4041/health` -> `200 OK` `{"status":"ok","version":"1.2.1"}`
- **Process Metadata (`/tmp/opencode/board-v2-staging/de726e4-state/preview-meta.json`):**
  - Supervisor wrapper PID: `367095`
  - Packaged `node web/dist/server.mjs` PID: `367113`
  - Synthetic GitHub API base: `http://127.0.0.1:36273` (bridged via `--import /tmp/opencode/board-v2-staging/de726e4-state/preload.mjs` so the packaged bundle runs unmodified without live GitHub traffic or production credentials)
  - Session storage: `/tmp/opencode/board-v2-staging/de726e4-state/sessions.json`
- **Access Limit:** `http://127.0.0.1:4041` is bound to container loopback (`127.0.0.1`) so it does not conflict with the live production board on `127.0.0.1:8787` (`https://board.workflows.ac`). Remote browser access requires local port forwarding (`ssh -L 4041:127.0.0.1:4041 ...`) or an approved preview ingress route.

### Preview Smoke Check Screenshots (`.agents/run/chamberos-board-v2/verifications/A-delivery/smoke.json`)

All 12 preview screenshots were captured from `http://127.0.0.1:4041` via Obscura CDP (`ws://127.0.0.1:9222/devtools/browser`) with `exceptions: []`, `consoleErrors: []`, and `cspViolations: []`:

- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/01-list-1280-light-en.png` — 1280 × 900; 108482 bytes; SHA-256 `9041c2d36a2a9898e691881f0e9aa45a6e1463de86d402bdde11a642861cba47`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/02-canvas-notes-wires-1280-light-en.png` — 1280 × 900; 146100 bytes; SHA-256 `c3f3b964ff17d77ba57909cdf98b96579fcfe121e3c3b9eb15ee093712d4b2a8`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/03-canvas-notes-wires-1280-dark-en.png` — 1280 × 900; 146161 bytes; SHA-256 `47a6fb414726ee267cdc3346bc49ee90e22ba4723f8545e0611b703279b82974`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/04-decisions-1280-dark-en.png` — 1280 × 900; 50117 bytes; SHA-256 `80e8c7987756a50cf10aae55b044f30ffe530c9e92279dc9f978e3fc9ea100c3`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/05-decisions-768-light-fr.png` — 768 × 900; 30188 bytes; SHA-256 `d3548f6455149ca32bdb1d7605f9f9ee94746475b226406cee09e48c5b48b212`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/06-blocked-1280-dark-en.png` — 1280 × 900; 93171 bytes; SHA-256 `26b7eacca03b6fe1e9e488a69b23da24d419e475d68bc35d439b524b0357aded`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/07-blocked-360-dark-en.png` — 360 × 800; 59952 bytes; SHA-256 `994ae03cce691888543145f67bb5c6630e1c402096d79ee1864059be96348ffb`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/08-operations-1280-dark-en.png` — 1280 × 900; 62554 bytes; SHA-256 `a9b821c2f7b00712ee7c66814c14cfa67f42ffed6b69f5fd1433058d677fdba7`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/09-operations-1280-light-fr.png` — 1280 × 900; 62844 bytes; SHA-256 `b151896ffc0f3f808b3df66cc5f8d2ca54bfb3288b7c20d477d32127ed36b3b9`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/10-archive-1280-dark-en.png` — 1280 × 900; 44308 bytes; SHA-256 `8bee637a8b894fc98b91c184b9fd2dfecbd8219070401a0b6af49fe42f10d594`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/11-client-1280-dark-en.png` — 1280 × 900; 105633 bytes; SHA-256 `c497a6dd1e4108bf1e2fb56ac6d507197169a2222efde26acf6105f047c4783f`.
- `.agents/run/chamberos-board-v2/verifications/A-delivery/screenshots/12-client-360-dark-en.png` — 360 × 800; 59198 bytes; SHA-256 `df8b51521971a45304616f63ead8ca8e6f9380cdae2cae82a96989a84085ecab`.

---

## 5. Hostile Review Finding Resolutions (c1f1807 -> de726e4)

1. **Finding 1 — 360px Mobile HUD Horizontal Containment (`web/public/theme.css:1594, 3208`):**
   - Added `max-width: calc(100% - 28px); box-sizing: border-box; flex-wrap: wrap; justify-content: flex-end;` on `.canvas-floating-controls`.
   - On `@media (max-width: 640px)`, added `row-gap: 4px;` and made the first separator a zero-height `flex-basis: 100%` wrap breakpoint, cleanly splitting zoom controls and action buttons into two fully contained rows on narrow screens.
   - Verified across the full matrix in `canvas-measurements.json`: on 360px French light/dark, `hudRect.left = 28px`, `hudRect.right = 346px`; all buttons stay strictly within `[88..339]px` horizontally with 0 clipping.
2. **Finding 2 — Canvas Dot Grid Radial Stop (`web/public/app.js:2268`):**
   - Reverted the extraneous `0px` radial gradient stop back to the two-stop gradient `radial-gradient(rgba(var(--canvas-dot-rgb, 24, 22, 19), ${alpha}) ${dotRadius.toFixed(2)}px, transparent ${dotRadius.toFixed(2)}px)`.
   - Preserved `dotRadius` and `alpha` dynamic scaling expressions intact.
   - Note on browser rasterizer: real Chromium (`chrome-headless-shell`) cannot run in the headless container environment due to missing system GLib/X11 libraries (`libglib-2.0.so.0`); Obscura 0.2.6 CDP was used for screenshots.
3. **Finding 3 — Total Post-Discovery Outage Guard (`web/server/app.ts:1332, 1421`):**
   - In `archiveData` and `operationsData`, added guard: if `discovery.repositories.length > 0 && (board.repositoriesLoaded ?? 0) === 0`, throw `DiscoveryUnavailableError()` (HTTP 502 `discovery_unavailable`).
   - Covered by 3 comprehensive tests in `web/tests/a5-sections.test.mjs`: total outage with zero cache returns 502 error; partial 1-repo failure returns 200 `partial: true`; all-repo failure with cache returns 200 `partial: true` with cached fallback.
4. **Finding 4 — Truthful Packaged Audit Test Count (`proof.md:59`):**
   - Updated test count from 12 to 13 / 13 PASS, matching actual script assertions.
5. **Finding 5 — Dynamic Smoke Check Verdict (`scripts/generate-delivery-smoke.mjs:435-515`):**
   - Replaced static `verdict: 'PASS'` literals with dynamic Boolean checks evaluating HTTP health, card counts, wire counts (exactly 4), exceptions (0), console errors (0), CSP violations (0), and canvas containment metrics across all 9 test cases. Script throws an exit error on any failing assertion.

---

## 6. Verification Blind Spots & Explicit NOT RUN Declarations

1. **Live GitHub Mutations:** Zero live GitHub issues, comments, labels, or dependencies were mutated. All checks ran against synthetic test fixtures.
2. **External Browser Preview Access:** The preview server is bound to container loopback (`127.0.0.1:4041`). Remote access requires SSH port forwarding (`ssh -L 4041:127.0.0.1:4041 ...`) or ingress configuration.
3. **Live Production Cutover:** Production symlink `/workspace/releases/board/current` remains pointing to `98261a8-20261103`, and production port `:8787` remains untouched.
4. **Human Acceptance:** Human tactile verification of canvas panning feel, wire ergonomics, and overall aesthetic polish remains pending.

