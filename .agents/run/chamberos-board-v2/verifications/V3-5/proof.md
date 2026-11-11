# ChamberOS Board V3 — Wave 2 V3-5 Verification Proof & Live Release Receipt

- **Release Date:** 2026-11-11
- **Status:** `PASS`
- **Application Code Commit:** `0e6d237` (`0e6d2376ebff55f3c651d98e526e42010af4b9d5`)
- **Release Directory:** `/workspace/releases/board/0e6d237-20261111`
- **Active Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/0e6d237-20261111`
- **Live HTTPS URL:** `https://board.workflows.ac` (internal loopback: `http://127.0.0.1:8787`)
- **Supervisor Process:** `/workspace/code/openchamber-config/tools/board/supervisor.sh` (PID `1505400`, child `node web/dist/server.mjs` PID `1505446`)

---

## 1. Defect Resolution Summary

### A. Signed-Out Compact Dock & Header Suppression
- **Root Cause:** In narrow viewports (`<=768px`), `#compact-nav-dock` rendered unconditionally because `#compact-nav-dock` lived outside `<main>` while `#board-view[hidden]` only hid the board container, leaving the bottom dock and top `.compact-header` visible to unauthenticated visitors.
- **Pure-CSS Solution:** Added `:has()` suppression rules in `web/public/theme.css`:
  ```css
  @media (max-width: 768px) {
    ...
    body:has(#login-view:not([hidden])) #compact-nav-dock { display: none; }
    body:has(#login-view:not([hidden])) .compact-header { display: none; }
    body:has(#login-view:not([hidden])) #app-sidebar { display: none; }
    body:has(#login-view:not([hidden])) .sidebar-backdrop { display: none !important; }
  }
  ```
  And globally:
  ```css
  body:has(#login-view:not([hidden])) #app-sidebar { display: none; }
  body:has(#login-view:not([hidden])) main { overflow-y: auto; }
  ```
- **Zero Server Changes:** No server files, authentication endpoints, or session APIs were touched.

### B. Sign-In Card Layout Polish
- Vertically and horizontally centered on all viewports via `margin: auto; width: min(420px, calc(100vw - 32px)); max-width: 420px;`.
- Password input and sign-in button touch targets enforced to `>=44x44px`:
  ```css
  .login-form input[type="password"] {
    width: 100%;
    min-height: 44px;
    min-width: 44px;
    padding: 10px 12px;
    font-size: 14px;
  }

  .login-form .button {
    justify-self: start;
    min-height: 44px;
    min-width: 44px;
    padding: 0 16px;
    font-size: 13px;
  }
  ```
- Preserved existing branding, styling tokens, palette accents, and bilingual copy without adding new footer or icons.

---

## 2. Test Verification Evidence

All test suites were executed sequentially with zero test weakening:

| Command | Exit Code | Result Summary | Status |
|---|---|---|---|
| `npm test` | `0` | 618 tests passed, 0 failures, 0 skipped | `PASS` |
| `node --test --test-timeout=30000 web/tests/*.test.mjs` | `0` | 601 tests passed, 0 failures, 0 skipped | `PASS` |
| `node --test web/tests/signin-dock-guard.test.mjs` | `0` | 3 tests passed (pure-CSS guard, DOM structure, layout polish) | `PASS` |
| `npm run typecheck` (`tsc --noEmit`) | `0` | 0 TypeScript errors | `PASS` |
| `esbuild web/server.ts --bundle` | `0` | 224.2kb bundle compiled cleanly | `PASS` |
| `node scripts/generate-delivery-smoke.mjs` | `0` | All 9 delivery smoke sections passed | `PASS` |

---

## 3. Synthetic Verification Matrix (16 Cases + Signed-In Dock)

Automated Chromium matrix verification testing viewports (`360x800`, `390x844`, `768x900`, `1280x900`), themes (`dark`, `light`), and languages (`en`, `fr`):

- **Signed-Out Dock Visibility:** `display: none`, `height: 0` across all 16 configurations.
- **Header & Sidebar Suppression:** `compact-header` and `app-sidebar` `display: none` across all 16 configurations.
- **Horizontal Centering:** Absolute `|left - right|` diff is `0.00px` across all configurations.
- **Vertical Centering:** Absolute `|top - bottom|` diff is `0.00px` across all configurations.
- **Touch Targets:** Password input and sign-in button `>=44x44px` in all viewports.
- **Signed-In Dock Parity:** When signed in on mobile (`390x844`), `#compact-nav-dock` rendered with `display: grid; height: 57px;`, and clicking all 4 navigation destinations (`canvas`, `decisions`, `blocked`, `list`) switched views cleanly (`navResults: all true`).

---

## 4. Staged Release & Rollback Preservations

Staged directory: `/workspace/releases/board/0e6d237-20261111`
- Built bundle: `web/dist/server.mjs` via esbuild.
- Copied assets: `package.json`, `web/public/`.
- Strict manifest verification (`sha256sum -c --strict checksums.sha256` and bidirectional file coverage `comm -3`) passed with 13/13 files covered and zero unlisted entries.

### Rollback Releases Preserved Intact:
- `/workspace/releases/board/5bf1c62-20261111`: `sha256sum -c --strict` passed.
- `/workspace/releases/board/59e5d05-20261111`: `sha256sum -c --strict` passed.
- `/workspace/releases/board/98261a8-20261103`: `sha256sum -c --strict` passed.

---

## 5. Live Service Cutover & Health

1. **Atomic Symlink Cutover:**
   ```bash
   ln -s /workspace/releases/board/0e6d237-20261111 /workspace/releases/board/current.tmp
   mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current
   ```
2. **Supervisor Graceful Restart:**
   - Previous supervisor PID `1275522` terminated via `SIGTERM`, waited cleanly, reaped child PID `1275564`, and released lock.
   - Launched `/workspace/code/openchamber-config/tools/board/start.sh`, spawning supervisor PID `1505400` and child PID `1505446`.
3. **Endpoint Health Checks:**
   - `http://127.0.0.1:8787/health`: HTTP 200 OK (`{"status":"ok","version":"1.2.1","uptime":4}`)
   - `https://board.workflows.ac/health`: HTTP 200 OK (`{"status":"ok","version":"1.2.1","uptime":5}`)

---

## 6. Live HTTPS Asset SHA-256 Hash Verification

| Asset | Staged SHA-256 (`0e6d237-20261111`) | Loopback SHA-256 (`:8787`) | Live HTTPS SHA-256 (`https://board.workflows.ac`) | Match Status |
|---|---|---|---|---|
| `index.html` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | **EXACT MATCH** |
| `app.js` | `a0c2c1151499bccfd9a47de617dbc2105c17c6b54c55f52bc03df6ac9601be77` | `a0c2c1151499bccfd9a47de617dbc2105c17c6b54c55f52bc03df6ac9601be77` | `a0c2c1151499bccfd9a47de617dbc2105c17c6b54c55f52bc03df6ac9601be77` | **EXACT MATCH** |
| `theme.css` | `4a90a669240ca48f9dba90eacb540ab33d4109d0d222365b6fc4b9e7c2d30379` | `4a90a669240ca48f9dba90eacb540ab33d4109d0d222365b6fc4b9e7c2d30379` | `4a90a669240ca48f9dba90eacb540ab33d4109d0d222365b6fc4b9e7c2d30379` | **EXACT MATCH** |
| `arrange.js` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | **EXACT MATCH** |
| `markdown.js` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | **EXACT MATCH** |
| `manifest.json` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | **EXACT MATCH** |
| `icon.svg` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | **EXACT MATCH** |
| `icon-192.png` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | **EXACT MATCH** |
| `icon-512.png` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | **EXACT MATCH** |
| `apple-touch-icon.png` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | **EXACT MATCH** |
| `sw.js` | *(static source)* `d7791b6fba0fdb948183cdc80ea2a22a574f4ede5f16b785cc603727d88204bb` | *(runtime stamped)* `a2d999ff4f655cf85661ff42e6a0ffd45435461955df3e66c4e5e006c30f358f` | `a2d999ff4f655cf85661ff42e6a0ffd45435461955df3e66c4e5e006c30f358f` | **RUNTIME MATCH** |

---

## 7. Live Production Measurements (`https://board.workflows.ac`)

Direct measurements evaluated against live HTTPS production using headless Chromium:

| Viewport | Theme | Lang | Dock Display | Dock Height | Header Display | Sidebar Display | Horiz Diff | Vert Diff | Card Size | Password Size | Button Size | Errors |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `360x800` | dark | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 328x252 | 278x44 | 83x44 | 0 |
| `360x800` | light | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 328x252 | 278x44 | 83x44 | 0 |
| `390x844` | dark | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 358x252 | 308x44 | 83x44 | 0 |
| `390x844` | light | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 358x252 | 308x44 | 83x44 | 0 |
| `768x900` | dark | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 420x252 | 370x44 | 83x44 | 0 |
| `768x900` | light | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 420x252 | 370x44 | 83x44 | 0 |
| `1280x900` | dark | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 420x252 | 370x44 | 83x44 | 0 |
| `1280x900` | light | en | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 420x252 | 370x44 | 83x44 | 0 |
| `390x844` | dark | fr | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 358x252 | 308x44 | 130x44 | 0 |
| `1280x900` | dark | fr | `none` | 0px | `none` | `none` | 0.00px | 0.00px | 420x252 | 370x44 | 130x44 | 0 |

---

## 8. Live Screenshots Captured

Saved under `.agents/run/chamberos-board-v2/verifications/V3-5/screenshots/`:
- `live-signed-out-360x800.png`
- `live-signed-out-360x800-light.png`
- `live-signed-out-390x844.png`
- `live-signed-out-390x844-light.png`
- `live-signed-out-768x900.png`
- `live-signed-out-768x900-light.png`
- `live-signed-out-1280x900.png`
- `live-signed-out-1280x900-light.png`
- `live-signed-out-390x844-fr.png`
- `live-signed-out-1280x900-fr.png`

---

## 9. Blind Spots & Not Verified

- **Authenticated production user session flow on live `board.workflows.ac`:** Production password and session secrets were strictly protected (not read, not printed, not used in automated browser sessions); live verification confirmed signed-out production rendering and byte-for-byte SHA-256 asset delivery.
- **Physical mobile hardware touch digitizers:** Tested via real headless Chromium (`chrome-headless-shell-linux64`) across mobile (`360x800`, `390x844`), tablet (`768x900`), and desktop (`1280x900`) viewports.
