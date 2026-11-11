# ChamberOS Board V3 — Wave 2 V3-4 Live Release Receipt

- **Release Date:** 2026-11-11
- **Status:** `PASS`
- **Application Code Commit:** `5bf1c62` (`5bf1c627568babb338c28f87e76195e883a1dd7a`)
- **L4 Hostile & Design Audit Approved Commit:** `8860cc2` (`8860cc216ebd55158c04cfe8b9c4bcf45ded2002`)
- **Release Directory:** `/workspace/releases/board/5bf1c62-20261111`
- **Active Symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/5bf1c62-20261111`
- **Live HTTPS URL:** `https://board.workflows.ac` (internal loopback: `http://127.0.0.1:8787`)
- **Supervisor Script:** `/workspace/code/openchamber-config/tools/board/supervisor.sh` (PID `1275522`, child PID `1275564`)

---

## 1. Git Ancestry, Cleanliness & Secret Scan

| Check | Expected | Actual Result | Status |
|---|---|---|---|
| Master fast-forward ancestry (`git merge-base --is-ancestor master HEAD`) | Ancestor is `master` (`4e92c01`) | Confirmed (`ANCESTRY_OK`) | `PASS` |
| Untouched legacy paths (`git diff --stat 98261a8..HEAD -- panel service`) | `0` lines | `0` lines (empty diff) | `PASS` |
| Working tree cleanliness (`git status --porcelain`) | Clean | Clean (before V3-4 receipt) | `PASS` |
| Secret scan (`git log -p 4e92c01..HEAD -- web scripts`) | `0` pattern hits | `0` pattern hits across 7,074 diff lines | `PASS` |
| Remote push (`origin/master`) | Fast-forward to V3 commit | Fast-forwarded `4e92c01..8860cc2` | `PASS` |

---

## 2. Staged Release & Rollback Preservation

The release bundle was compiled using:
```bash
npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/workspace/releases/board/5bf1c62-20261111/web/dist/server.mjs
```

Manifest verification (`sha256sum -c --strict checksums.sha256` and exact bidirectional directory coverage `comm -3`) passed with 13/13 files covered and zero unlisted entries.

### Rollback Preservations
- `/workspace/releases/board/59e5d05-20261111`: Preserved intact; `sha256sum -c --strict checksums.sha256` passes.
- `/workspace/releases/board/98261a8-20261103`: Preserved intact; `sha256sum -c --strict checksums.sha256` passes.

---

## 3. Live Service Cutover & Health

1. **Atomic Switch:**
   - Temporary symlink created and swapped with `mv -Tf`:
   - `/workspace/releases/board/current` -> `/workspace/releases/board/5bf1c62-20261111`
2. **Graceful Supervisor Stop & Start:**
   - Previous supervisor PID `538270` was sent `SIGTERM`, exited cleanly, reaped its child, and released `supervisor.lock`.
   - `/workspace/code/openchamber-config/tools/board/start.sh` launched supervisor PID `1275522` and child `node web/dist/server.mjs` PID `1275564`.
3. **Endpoint Health Checks:**
   - `http://127.0.0.1:8787/health`: HTTP 200 OK (`{"status":"ok","version":"1.2.1","uptime":...}`)
   - `https://board.workflows.ac/health`: HTTP 200 OK (`{"status":"ok","version":"1.2.1","uptime":...}`)

---

## 4. Live HTTPS Asset SHA-256 Hash Verification

| Asset | Staged SHA-256 (`5bf1c62-20261111`) | Loopback SHA-256 (`:8787`) | Live HTTPS SHA-256 (`https://board.workflows.ac`) | Match Status |
|---|---|---|---|---|
| `index.html` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | `3b9a1d4fb2f58fcbffe09ad006fdf9f1fb10d1f5548abb95b8014fd24c6a5862` | **EXACT MATCH** |
| `app.js` | `a0c2c1151499bccfd9a47de617dbc2105c17c6b54c55f52bc03df6ac9601be77` | `a0c2c1151499bccfd9a47de617dbc2105c17c6b54c55f52bc03df6ac9601be77` | `a0c2c1151499bccfd9a47de617dbc2105c17c6b54c55f52bc03df6ac9601be77` | **EXACT MATCH** |
| `theme.css` | `0f6ffc71cd43b63605479e52bb3ba7e5dd0c3c192dc3677e18ae8966328cacf5` | `0f6ffc71cd43b63605479e52bb3ba7e5dd0c3c192dc3677e18ae8966328cacf5` | `0f6ffc71cd43b63605479e52bb3ba7e5dd0c3c192dc3677e18ae8966328cacf5` | **EXACT MATCH** |
| `arrange.js` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | **EXACT MATCH** |
| `markdown.js` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | **EXACT MATCH** |
| `manifest.json` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | `493a698ed99c7b6fab1902ab791b4cb77b3ba3376a83b4e1a7323c20945c19be` | **EXACT MATCH** |
| `icon.svg` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | **EXACT MATCH** |
| `icon-192.png` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | **EXACT MATCH** |
| `icon-512.png` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | **EXACT MATCH** |
| `apple-touch-icon.png` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | **EXACT MATCH** |
| `sw.js` | *(static source)* `d7791b6fba0fdb948183cdc80ea2a22a574f4ede5f16b785cc603727d88204bb` | *(runtime stamped)* `3c457c21f0d4570e3f034ff32ec9aa1b3c55748c706e9c289e21e5c760015cc7` | `3c457c21f0d4570e3f034ff32ec9aa1b3c55748c706e9c289e21e5c760015cc7` | **RUNTIME MATCH** |

---

## 5. Signed-Out Live Screenshots

Captured against live `https://board.workflows.ac/` using headless Chromium:
- `.agents/run/chamberos-board-v2/verifications/V3-4/screenshots/live-signed-out-390x844.png` (Mobile viewport, dark theme)
- `.agents/run/chamberos-board-v2/verifications/V3-4/screenshots/live-signed-out-1280x900.png` (Desktop viewport, dark theme)
- `.agents/run/chamberos-board-v2/verifications/V3-4/screenshots/live-signed-out-390x844-light.png` (Mobile viewport, light theme)
- `.agents/run/chamberos-board-v2/verifications/V3-4/screenshots/live-signed-out-1280x900-light.png` (Desktop viewport, light theme)

---

## 6. Blind Spots & Not Verified

- **Authenticated production user session flow on live `board.workflows.ac`:** Production password and session secrets were strictly protected (not read, not printed, not used in automated browser sessions); live verification confirmed signed-out production rendering and byte-for-byte SHA-256 asset delivery.
- **Physical iOS Safari / Android Chrome hardware touch:** Tested via real headless Chromium (`chrome-headless-shell-linux64`) across mobile (`390x844`) and desktop (`1280x900`) viewports.
