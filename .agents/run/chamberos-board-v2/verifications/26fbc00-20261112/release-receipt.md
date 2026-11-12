# ChamberOS Board V4 — Release Receipt (`26fbc00-20261112`)

- **Release Date:** 2026-11-12
- **Status:** `LIVE`
- **Base Commit:** `26fbc002bbd4b405ff6ea1c15bafe94a8bcf9a58` (`26fbc00`, application code at `a1225f0`, D39 bounded fix approved)
- **Release Directory:** `/workspace/releases/board/26fbc00-20261112`
- **Active Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/26fbc00-20261112`
- **Live HTTPS URL:** `https://board.workflows.ac` (loopback: `http://127.0.0.1:8787`)
- **Supervisor Process:** `/workspace/code/openchamber-config/tools/board/supervisor.sh` (PID `1334852`, child `node web/dist/server.mjs` PID `1334936`)

---

## 1. Server Bundle Build & Staging Verification

- **Source Build Command:**
  `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/26fbc00-20261112/web/dist/server.mjs`
- **Bundle Assertions:**
  - Case-insensitive `if-match` occurrences in `web/dist/server.mjs`: **0**
  - `write_rejected` error handling present at line 5525 (`throw new HttpError(400, "write_rejected", ...)`)
- **Manifest Verification:**
  - `sha256sum -c --strict checksums.sha256`: **13/13 OK** (`package.json`, `web/dist/server.mjs`, 11 files in `web/public/`)
  - Exact two-way coverage check: `files_not_in_manifest = 0`, `manifest_not_in_files = 0`

---

## 2. Pre-Cutover & Post-Cutover State

### Pre-Cutover
- **Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/7339629-20261111`
- **Supervisor PID:** `72`
- **Child PID:** `110`
- **Health Payloads:**
  - `http://127.0.0.1:8787/health` -> HTTP 200 `{"status":"ok","version":"1.2.1","uptime":26597}`
  - `https://board.workflows.ac/health` -> HTTP 200 `{"status":"ok","version":"1.2.1","uptime":26598}`
- **Previous Releases Checksum Verification (`sha256sum -c --strict checksums.sha256`):**
  - `7339629-20261111`: **PASS**
  - `0e6d237-20261111`: **PASS**
  - `5bf1c62-20261111`: **PASS**
  - `59e5d05-20261111`: **PASS**
  - `98261a8-20261103`: **PASS**

### Post-Cutover
- **Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/26fbc00-20261112`
- **Supervisor PID:** `1334852`
- **Child PID:** `1334936` (`cwd` verified: `/proc/1334936/cwd -> /workspace/releases/board/26fbc00-20261112`)
- **Health Checks:**
  - `http://127.0.0.1:8787/health` -> HTTP 200 `{"status":"ok","version":"1.2.1","uptime":642}`
  - `https://board.workflows.ac/health` -> HTTP 200 `{"status":"ok","version":"1.2.1","uptime":642}`
- **Sustained Supervision:** Confirmed in `/tmp/opencode/board-supervisor/supervisor.log` (`Child healthy for sustained period (30s >= 30s). Restart allowance and backoff reset.`).

---

## 3. Asset Hash Verification Table (Staged vs Loopback vs Live HTTPS)

| Asset | Staged SHA-256 (`26fbc00-20261112`) | Loopback SHA-256 (`http://127.0.0.1:8787`) | Live HTTPS SHA-256 (`https://board.workflows.ac`) | Match Status |
|---|---|---|---|---|
| `index.html` | `1b4ee3c37aa51b09824427e5d0fcdd85084da7f79e565588a4b9880694ecda6f` | `1b4ee3c37aa51b09824427e5d0fcdd85084da7f79e565588a4b9880694ecda6f` | `1b4ee3c37aa51b09824427e5d0fcdd85084da7f79e565588a4b9880694ecda6f` | **EXACT MATCH** |
| `app.js` | `7aa364f76e146a13102d4a47dda187a26b0febe20b99c58e5d7f9921dbe96ad4` | `7aa364f76e146a13102d4a47dda187a26b0febe20b99c58e5d7f9921dbe96ad4` | `7aa364f76e146a13102d4a47dda187a26b0febe20b99c58e5d7f9921dbe96ad4` | **EXACT MATCH** |
| `theme.css` | `2c53e3844ec8f9a3daf03b3fa2a132bcb37a00fb702066a29196c2e69cd11a55` | `2c53e3844ec8f9a3daf03b3fa2a132bcb37a00fb702066a29196c2e69cd11a55` | `2c53e3844ec8f9a3daf03b3fa2a132bcb37a00fb702066a29196c2e69cd11a55` | **EXACT MATCH** |
| `arrange.js` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | **EXACT MATCH** |
| `markdown.js` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | **EXACT MATCH** |
| `manifest.json` | `7856be7b675d4a0f129fc74ee61e3fc4297153f467991b651e143c598b1566c3` | `7856be7b675d4a0f129fc74ee61e3fc4297153f467991b651e143c598b1566c3` | `7856be7b675d4a0f129fc74ee61e3fc4297153f467991b651e143c598b1566c3` | **EXACT MATCH** |
| `icon.svg` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | **EXACT MATCH** |
| `icon-192.png` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | **EXACT MATCH** |
| `icon-512.png` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | **EXACT MATCH** |
| `apple-touch-icon.png` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | **EXACT MATCH** |
| `sw.js` | *(disk)* `8a6b880e30522069f2337e164339f6ec4f526ee49b62b66e959768994d580814` | *(runtime)* `60d7ba0c8a613b4b014c5610df5ac169ac5e622d1d776591f9599abee58b890d` | `60d7ba0c8a613b4b014c5610df5ac169ac5e622d1d776591f9599abee58b890d` | **RUNTIME MATCH** |

Non-HTTP release artifacts in `/workspace/releases/board/26fbc00-20261112`:
- `package.json`: `e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee`
- `web/dist/server.mjs`: `083e009205805e998244347840e157fef28851accf85b1d0c1a85101d3a46189`

---

## 4. Live Origin V4 Proof & Service Worker Cache Invalidation

Fetched directly over HTTPS from `https://board.workflows.ac`:
- **`https://board.workflows.ac/app.js` V4 Markers:**
  - `frameDependencyFocus` — line `3037` (`function frameDependencyFocus(options)`)
  - `computeFitView` — line `2836` (`function computeFitView(bounds, viewport, options)`)
  - `applied-filter-btn` — line `1888` (`if ($('applied-filter-btn'))`)
  - `canvasZoomLimitText` — line `3009` (`function canvasZoomLimitText(linked)`)
  - `canvasFitContains` — line `2998` (`function canvasFitContains(rects, target, viewport, options)`)
  - `dependencyFocusLimited` — lines `52`, `3062`, `3069`
- **`https://board.workflows.ac/index.html` Branding:**
  - `"Workflows Board"` — line `8` (`<title>Workflows Board</title>`), line `39` (`.sidebar-brand-title`), line `357` (`.status-strip-brand`)
- **`https://board.workflows.ac/sw.js` Browser-Safe Cache Drop Proof:**
  - Previous live release (`7339629-20261111`) served: `var CACHE_VERSION = "1.2.1-7fcf74087e";` (`workflows-board-1.2.1-7fcf74087e`)
  - V4 release (`26fbc00-20261112`) staged source `web/public/sw.js` sets `var CACHE_VERSION = '2.1.0';` and runtime server stamps `var CACHE_VERSION = "1.2.1-2e7655bc77";` (`workflows-board-1.2.1-2e7655bc77`) derived from the shell asset SHA-256 (`index.html`, `app.js`, `theme.css`, `manifest.json`).
  - Because `"1.2.1-2e7655bc77"` differs from `"1.2.1-7fcf74087e"`, the `activate` listener (`if (key !== CACHE_NAME) { return caches.delete(key); }`) evicts the previous cache `workflows-board-1.2.1-7fcf74087e` on all returning clients.

---

## 5. Signed-Out Read-Only Chromium Smoke Test

Executed headless Chromium (`chrome-headless-shell`) against live `https://board.workflows.ac/` without authentication or writes:

| Viewport | HTTP Status | Console Errors | Page Errors | CSP Violations | Login View Box | Password Box | Submit Box | Input Type/Clear Check |
|---|---|---|---|---|---|---|---|---|
| `390x844` | 200 | 0 | 0 | 0 | `358x252` | `308x44` | `77x44` | Typed 16 chars, cleared to 0 (unsubmitted) |
| `1280x900` | 200 | 0 | 0 | 0 | `420x233` | `370x44` | `77x44` | Typed 16 chars, cleared to 0 (unsubmitted) |

Screenshots:
- `.agents/run/chamberos-board-v2/verifications/26fbc00-20261112/screenshots/live-signed-out-390x844.png`
- `.agents/run/chamberos-board-v2/verifications/26fbc00-20261112/screenshots/live-signed-out-1280x900.png`

---

## 6. Rollback Documentation

- **Immediate Rollback Target:** `/workspace/releases/board/7339629-20261111`
- **One-Command Rollback:**
  ```bash
  ln -s /workspace/releases/board/7339629-20261111 /workspace/releases/board/current.tmp && mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current && kill -TERM $(cat /tmp/opencode/board-supervisor/supervisor.pid) && while kill -0 $(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0) 2>/dev/null; do sleep 0.2; done && /workspace/code/openchamber-config/tools/board/start.sh
  ```
- **Valid Preserved Rollback Releases (`sha256sum -c --strict checksums.sha256` PASS):**
  - `/workspace/releases/board/7339629-20261111`
  - `/workspace/releases/board/0e6d237-20261111`
  - `/workspace/releases/board/5bf1c62-20261111`
  - `/workspace/releases/board/59e5d05-20261111`
  - `/workspace/releases/board/98261a8-20261103`

---

## 7. Not Verified / Blind Spots

- Authenticated session flows and live production GitHub mutations were not executed against production (read-only verification boundary; zero secrets accessed, zero GitHub writes).
