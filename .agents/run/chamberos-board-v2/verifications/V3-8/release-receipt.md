# ChamberOS Board V3 — Wave 3 V3-8 Write Fix Release Receipt

- **Release Date:** 2026-11-11
- **Status:** `LIVE`
- **Application Code Commit:** `8f7ebaa` (includes `7339629` hostile audit docs and `f4beb1c` error classification fix)
- **Release Directory:** `/workspace/releases/board/7339629-20261111`
- **Active Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/7339629-20261111`
- **Live HTTPS URL:** `https://board.workflows.ac` (internal loopback: `http://127.0.0.1:8787`)
- **Supervisor Process:** `/workspace/code/openchamber-config/tools/board/supervisor.sh` (PID `1873809`, child `node web/dist/server.mjs` PID `1873851`)

---

## 1. Summary of Shipped Defect Resolution

- **Root Cause of Failed Product Writes:** In previous releases (including `0e6d237-20261111`), `updateIssue()` sent `If-Match: <etag>` on unsafe requests (`PATCH`). Real GitHub unconditionally rejects unsafe requests carrying conditional headers with HTTP 400 (`"Conditional request headers are not allowed in unsafe requests unless supported by the endpoint"`), aborting 8 of 11 product writes before state changed. The server then collapsed this 400 into `502 write_outcome_unknown`, misleading users.
- **Server Bundle Rebuild:** Bundled `web/server.ts` directly from source with esbuild. The server bundle contains zero `if-match` occurrences on issue writes and includes the new `write_rejected` error path (`web/server/app.ts:2626`).
- **Client Error Precision:** `web/public/app.js` handles definite refusals (`400 write_rejected`, `401 github_unauthorized`, `429 github_rate_limited`) before collapsing into `write_outcome_unknown`, presenting descriptive bilingual notices on failed card moves instead of false outcome ambiguity.

---

## 2. Pre-Cutover & Cutover State

### Pre-Cutover
- Symlink: `/workspace/releases/board/current` -> `/workspace/releases/board/0e6d237-20261111`
- Supervisor PID: `1505400`
- Child PID: `1505446`
- Health: HTTP 200 OK (`uptime: 5608s`)
- Previous releases checksum verification: `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103` all passed `sha256sum -c --strict`.

### Post-Cutover
- Symlink: `/workspace/releases/board/current` -> `/workspace/releases/board/7339629-20261111`
- Supervisor PID: `1873809`
- Child PID: `1873851`
- Health Check:
  - `http://127.0.0.1:8787/health` -> HTTP 200 OK `{"status":"ok","version":"1.2.1","uptime":9}`
  - `https://board.workflows.ac/health` -> HTTP 200 OK `{"status":"ok","version":"1.2.1","uptime":9}`

---

## 3. Asset Hash Verification Table

All served assets over live HTTPS (`https://board.workflows.ac`) match the staged SHA-256 digests byte-for-byte. `sw.js` matches the runtime-stamped hash served on loopback `:8787` (`CACHE_VERSION` injected at startup).

| Asset | Staged SHA-256 (`7339629-20261111`) | Loopback SHA-256 (`:8787`) | Live HTTPS SHA-256 (`https://board.workflows.ac`) | Match Status |
|---|---|---|---|---|
| `index.html` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | **EXACT MATCH** |
| `app.js` | `150d32b2c3692b137736bc80ee2dfd0deb8f7ee04c01c1153acb49aa82ef52ad` | `150d32b2c3692b137736bc80ee2dfd0deb8f7ee04c01c1153acb49aa82ef52ad` | `150d32b2c3692b137736bc80ee2dfd0deb8f7ee04c01c1153acb49aa82ef52ad` | **EXACT MATCH** |
| `theme.css` | `4a90a669240ca48f9dba90eacb540ab33d4109d0d222365b6fc4b9e7c2d30379` | `4a90a669240ca48f9dba90eacb540ab33d4109d0d222365b6fc4b9e7c2d30379` | `4a90a669240ca48f9dba90eacb540ab33d4109d0d222365b6fc4b9e7c2d30379` | **EXACT MATCH** |
| `arrange.js` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | **EXACT MATCH** |
| `markdown.js` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | **EXACT MATCH** |
| `manifest.json` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | **EXACT MATCH** |
| `icon.svg` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | **EXACT MATCH** |
| `icon-192.png` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | **EXACT MATCH** |
| `icon-512.png` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | **EXACT MATCH** |
| `apple-touch-icon.png` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | **EXACT MATCH** |
| `sw.js` | *(disk)* `d7791b6fba0fdb948183cdc80ea2a22a574f4ede5f16b785cc603727d88204bb` | *(runtime)* `7609a8794e641dd909e766da2db8c89fb6d23d9540b0697a2eccedc255569f5d` | `7609a8794e641dd909e766da2db8c89fb6d23d9540b0697a2eccedc255569f5d` | **RUNTIME MATCH** |

---

## 4. Live Bundle & Origin Verification Proof

- **Live Server Bundle (`/workspace/releases/board/7339629-20261111/web/dist/server.mjs`):**
  - Case-insensitive `if-match` occurrences: **0**
  - Line 5525: `throw new HttpError(400, "write_rejected", `GitHub rejected the write; nothing was saved (${upstream})`);`
  - Child process verification: PID `1873851` cwd confirmed as `/workspace/releases/board/7339629-20261111`.
- **Live Client `app.js` (fetched over HTTPS from `https://board.workflows.ac/app.js`):**
  - Line 418: `if (payload && (payload.error === 'github_unauthorized' || payload.error === 'github_rate_limited'))`
  - Line 693: `canvas_save_rejected: 'Canvas position not saved: GitHub rejected the write ({status}). The card stayed where it was.'`
  - Line 876: `canvas_save_rejected: 'Position non enregistrée : GitHub a refusé l’écriture ({status}). La carte est restée à sa place.'`
  - Line 2775: `function canvasMoveFailureMessage(err, dict)`
  - Line 2880: `msg = canvasMoveFailureMessage(err, dict);`

---

## 5. Read-Only Chromium Smoke Test Results

Executed with headless Chromium against live production `https://board.workflows.ac`:

| Viewport | Status | Console Errors | Login Card Visible | Password Input Size | Button Size | Dock Display | Header Display | Sidebar Display |
|---|---|---|---|---|---|---|---|---|
| `390x844` | 200 | 0 | Yes (358x252) | 308x44px | 83x44px | `none` | `none` | `none` |
| `1280x900` | 200 | 0 | Yes (420x252) | 370x44px | 83x44px | `none` | `none` | `none` |

- Form input interaction tested: typed 17 characters in password field and cleared without submitting.
- Zero login submission attempted; zero GitHub writes executed.

Screenshots captured:
- `.agents/run/chamberos-board-v2/verifications/V3-8/screenshots/live-signed-out-390x844.png`
- `.agents/run/chamberos-board-v2/verifications/V3-8/screenshots/live-signed-out-1280x900.png`

---

## 6. Rollback Documentation

### Preserved Rollback Releases:
- `/workspace/releases/board/0e6d237-20261111` (`sha256sum -c --strict` PASS)
- `/workspace/releases/board/5bf1c62-20261111` (`sha256sum -c --strict` PASS)
- `/workspace/releases/board/59e5d05-20261111` (`sha256sum -c --strict` PASS)
- `/workspace/releases/board/98261a8-20261103` (`sha256sum -c --strict` PASS)

### One-Command Rollback:
```bash
ln -s /workspace/releases/board/0e6d237-20261111 /workspace/releases/board/current.tmp && mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current && kill -TERM $(cat /tmp/opencode/board-supervisor/supervisor.pid) && while kill -0 $(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0) 2>/dev/null; do sleep 0.2; done && /workspace/code/openchamber-config/tools/board/start.sh
```

---

## 7. Blind Spots & Not Verified

- Production sign-in session flow not executed against live production (production secrets remained sealed and protected; read-only verification only).
- Hardware touch digitizers not tested physically; verified in Chromium emulation.
