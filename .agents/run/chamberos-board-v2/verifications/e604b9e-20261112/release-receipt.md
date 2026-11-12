# ChamberOS Board V4-2 — Release Receipt (`e604b9e-20261112`)

- **Release date:** 2026-11-12
- **Status:** `LIVE`
- **Base commit:** `e604b9e3c4eff41371fec9f3c6a151a5da8ee61c` (`e604b9e`, `feat/board-v3`)
- **Reviewed increment:** `ab45c37`/`a7867e8` full V4-2 review (`../V4-2-L4/`), correction reviewed at `1d9f237` (`../V4-2-L4-delta/`), verdict `PUBLISH: YES`
- **Release directory:** `/workspace/releases/board/e604b9e-20261112`
- **Active symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/e604b9e-20261112`
- **Live HTTPS:** `https://board.workflows.ac` · loopback `http://127.0.0.1:8787`
- **Supervisor:** `/workspace/code/openchamber-config/tools/board/supervisor.sh` PID `1152566`, child `node web/dist/server.mjs` PID `1152623`

---

## 1. Build and staging

Server bundle rebuilt **from source at `e604b9e`**; `web/dist/server.mjs` was not copied from any earlier artifact.

```bash
npx esbuild web/server.ts --bundle --platform=node --format=esm \
  --target=node20 --packages=external \
  --outfile=/workspace/releases/board/e604b9e-20261112/web/dist/server.mjs
```

| Bundle assertion | Result |
|---|---|
| note route `/^\/api\/issues\/([^/]+)\/notes$/` | present (line 4081), handler `createIssueNote` |
| note marker `board-note` | present, 2 occurrences: `noteMarkerLinePattern` (line 2689), `buildNoteCommentBody` template (line 2698) |
| `write_rejected` | present, 1 occurrence (line 5853) |
| `if-match` (case-insensitive) | **0 occurrences** |
| bundle size | 244,643 bytes |

Manifest: `sha256sum -c --strict checksums.sha256` -> **13/13 OK, exit 0**.
Two-way coverage: `files_not_in_manifest = 0`, `manifest_not_in_files = 0` (13 files each; `checksums.sha256` excluded from itself as the supervisor requires).

---

## 2. Hash table — staged vs loopback vs live HTTPS

| Asset | Staged SHA-256 | Loopback `:8787` | Live HTTPS | Match |
|---|---|---|---|---|
| `package.json` | `e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee` | *(not served)* | *(not served)* | staged only |
| `web/dist/server.mjs` | `4779505d58c8184c2efc2e03ca325c29fc80b6f83c8b7d66feedb3e45fd74def` | *(not served)* | *(not served)* | staged only |
| `index.html` | `bca190ffc08134bceb70375e289ab301f8401ac29716f980f9914122cb81bafe` | same | same | **EXACT** |
| `app.js` | `9edca1db926e8ac1ea888404aab09e4777507cd8dd72806e5d703adf10235506` | same | same | **EXACT** |
| `theme.css` | `1a23505dc21db0b7900c41bdbd0cdf5ddf9c4ebeba648109dbd467d5dc5305bf` | same | same | **EXACT** |
| `arrange.js` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | same | same | **EXACT** |
| `markdown.js` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | same | same | **EXACT** |
| `manifest.json` | `7856be7b675d4a0f129fc74ee61e3fc4297153f467991b651e143c598b1566c3` | same | same | **EXACT** |
| `icon.svg` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | same | same | **EXACT** |
| `icon-192.png` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | same | same | **EXACT** |
| `icon-512.png` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | same | same | **EXACT** |
| `apple-touch-icon.png` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | same | same | **EXACT** |
| `sw.js` | *(disk)* `8a6b880e30522069f2337e164339f6ec4f526ee49b62b66e959768994d580814` | *(runtime)* `b52fc35462873b033d0f1048605667514fe46e006be8fa11ac845d913c9726e3` | same as loopback | **RUNTIME MATCH** |

`GET /` bytes equal `index.html` on both loopback and HTTPS.

---

## 3. Pre-cutover and post-cutover state

### Pre-cutover (recorded 2026-11-12T22:36:48Z)
- Symlink: `current` -> `/workspace/releases/board/26fbc00-20261112`
- Supervisor PID `73`, child PID `111`, child cwd `/workspace/releases/board/26fbc00-20261112`
- `http://127.0.0.1:8787/health` -> 200 `{"status":"ok","version":"1.2.1","uptime":10095}`
- `https://board.workflows.ac/health` -> 200 (same payload)

### Cutover sequence (executed)
1. `ln -s /workspace/releases/board/e604b9e-20261112 current.tmp && mv -Tf current.tmp current` (atomic `rename`)
2. `kill -TERM 73`; supervisor exited in ~400 ms, forwarding TERM to child; both gone; pid file removed
3. `env -i PATH=… HOME=/workspace GITHUB_TOKEN=… /bin/sh /workspace/code/openchamber-config/tools/board/start.sh`
   Clean environment; deployment settings loaded from `/workspace/.openchamber-data/board/board.env`; token and session secret derived by `start.sh`; no secret printed.
4. New supervisor `1152566`, child `1152623`, both cwd `/workspace/releases/board/e604b9e-20261112`

### Post-cutover
- `http://127.0.0.1:8787/health` -> **200** `{"status":"ok","version":"1.2.1","uptime":240}`
- `https://board.workflows.ac/health` -> **200**
- `supervisor.log`: `Child healthy for sustained period (30s >= 30s). Restart allowance and backoff reset.`
- `board.log`: `board: listening on http://0.0.0.0:8787 for Workflows-Accelerator/openchamber-github-task-board as workflows-accelerator-agent (password source: BOARD_PASSWORD_HASH)`

---

## 4. Live-origin proof (fetched over HTTPS, not from disk)

`https://board.workflows.ac/app.js` (SHA-256 `9edca1db…`):

| Marker | Count | First line |
|---|---|---|
| `agent-note-composer` | 2 | 6409 |
| `question-option-card` | 1 | 6546 |
| `canvasZoomLimitText` (V4 non-regression) | 3 | 3076 |
| `frameDependencyFocus` (V4 non-regression) | 4 | 3104 |

`https://board.workflows.ac/index.html`: `Workflows Board` at lines 8 (`<title>`), 39 (sidebar brand), 357 (status strip brand).

### Correction: `board-note:` is server-side, not in `app.js`

The task expected `board-note:` in the served `app.js`. It is **not there, and never was**: the client never composes GitHub comment bodies. `grep -c` returns 0 in `web/public/app.js`, in the staged release file, and in the served HTTPS file. The marker is created by the server only:

- `web/server/board.ts:288` comment, `:302` `noteMarkerLinePattern`, `:312` `buildNoteCommentBody`
- deployed bundle `web/dist/server.mjs` lines 2689 and 2698
- deployed note route, bundle line 4081

The running child PID `1152623` executes that exact bundle (`cwd=/workspace/releases/board/e604b9e-20261112`), so the marker is live without being part of the client. No fabricated string was added to satisfy the brief.

---

## 5. Service worker cache invalidation

| | CACHE_VERSION |
|---|---|
| Previous live release (`26fbc00`) | `1.2.1-2e7655bc77` |
| New live release (`e604b9e`) | **`1.2.1-d32d4abee5`** |

- Served `sw.js` header: `var CACHE_VERSION = "1.2.1-d32d4abee5";`
- Differs from `1.2.1-2e7655bc77`: **YES**
- Independently recomputed from `package.json` version plus SHA-256 of `index.html`, `app.js`, `theme.css`, `manifest.json` (first 10 hex): `1.2.1-d32d4abee5`
- Live HTTPS `sw.js` bytes equal loopback `sw.js` bytes; both differ from the disk file because the stamp is applied at runtime. `activate` therefore deletes the old `workflows-board-1.2.1-2e7655bc77` cache.

---

## 6. Chromium smoke

### 6.1 Signed-out production (read-only, no sign-in)
Both viewports loaded `https://board.workflows.ac/` (HTTP 200), login gate visible, `#board-view` hidden, `GET /api/board` -> 401 `unauthenticated`. No session created, no credential entered, no write.

| Viewport | Status | Page errors | Console errors | CSP violations | Login form box |
|---|---|---|---|---|---|
| 390x844 | 200 | 0 | 1 — expected `401` resource error from the auth gate | 0 | 308x122 |
| 1280x900 | 200 | 0 | 1 — same expected `401` | 0 | 370x122 |

The single console error per viewport is the browser reporting the correct signed-out `401` for `/api/board`; there were zero unexpected errors. Claiming zero console errors would be false.

Screenshots: `screenshots/live-signed-out-390x844.png`, `screenshots/live-signed-out-1280x900.png`.

### 6.2 Four views from the live client bundle
Production is private, so list/canvas/drawer/Decisions cannot be opened on real data without signing in, which the brief forbids. To still prove the deployed bundle renders the V4-2 surfaces, `render.mjs` loads the **live production assets** and intercepts only `/api/**`, answering reads from a throwaway local board on the synthetic GitHub fake. Non-GET API calls are refused (0 mutations attempted). No production session, no GitHub request, no write.

| Viewport | View | Evidence |
|---|---|---|
| 390x844, 1280x900 | List | 3 synthetic issues, grouped, note count and `4 questions` badges |
| 390x844, 1280x900 | Canvas | cards, dependency arrow, sticky note, zoom readout 55% |
| 390x844, 1280x900 | Drawer | title, `agent-note-composer` present, 4 `question-option-card` elements |
| 390x844, 1280x900 | Decisions | 1 grouped decision, 2 preset options with gist + `Details`, 4 unanswered questions |

Console errors 0, page errors 0, CSP violations 0 in all 8 renders (`browser-render.json`). Screenshots `screenshots/rendered-synthetic-{list,canvas,drawer,decisions}-{390x844,1280x900}.png`.

---

## 7. Rollback

- **Rollback target:** `/workspace/releases/board/26fbc00-20261112` (last live release; checksums PASS)
- **One-command rollback** (`rollback.sh`, `sh -n` and `bash -n` clean):

```bash
ln -s /workspace/releases/board/26fbc00-20261112 /workspace/releases/board/current.tmp && \
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current && \
kill -TERM "$(cat /tmp/opencode/board-supervisor/supervisor.pid)" && \
while kill -0 "$(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0)" 2>/dev/null; do sleep 0.2; done && \
/workspace/code/openchamber-config/tools/board/start.sh
```

- The forward direction of this exact sequence (atomic repoint, TERM, wait, clean-env `start.sh`) was executed for this release; the reverse uses the same steps with the previous target.
- **Valid preserved rollbacks, all `sha256sum -c --strict` PASS before and after cutover:**
  `26fbc00-20261112`, `7339629-20261111`, `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103`, `ab7516c-20261030`, `cc08379-20261029`, `8b7e059-20261102`, `8df6d7b-20261028`, `07d8511-20261027`.
- No previous release was modified, renamed or deleted.

---

## 8. Compliance

- No secret printed or read: only `/health` payloads, PIDs, checksums and public assets were captured. `board.env` was enumerated by key name only; token and session secret were never displayed.
- Zero edits under `/workspace/code/openchamber-config`; `tools/board` is clean and file mtimes are unchanged (Oct 26/28). `start.sh` was read and executed only.
- Zero GitHub writes, zero issue/label changes, zero comments posted, zero real-repository writes. All fixture traffic went to the local synthetic fake.
- Nothing pushed. No `git remote -v`; no credential printed.
- `.agents/run/chamberos-board-v2/verifications/V4-1-L4/` left untouched (still untracked).

---

## 9. Not verified / blind spots

- Authenticated production flows (real board data, real GitHub reads through the production token) were not exercised; the brief forbids signing in and writing.
- The four authenticated views were rendered from live assets with synthetic API data, not with production data.
- Browser-side service-worker installation/eviction was not observed in a persistent profile; only the served `CACHE_VERSION` change was proven.
- Rollback was not executed backwards (would take the live board down twice); its target checksums and the identical forward sequence were verified.
