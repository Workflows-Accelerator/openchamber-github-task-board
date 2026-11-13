# ChamberOS Board V4-3 — Release Receipt (`b85676f-20261113`)

- **Release date:** 2026-11-13
- **Status:** `LIVE`
- **Base commit:** `b85676f` (`feat/board-v3`), tracked tree clean at cutover
- **Reviewed increment:** `a6f61f3..b85676f`; independent verdicts `../V4-3-L4/` (SPEC PASS, F1 blocking) and `../V4-3-L4-delta/` (DELTA PASS, **PUBLISH: YES**); residuals closed at `fa15e35` / `20f4553` / `b85676f`
- **Release directory:** `/workspace/releases/board/b85676f-20261113`
- **Active symlink:** `/workspace/releases/board/current` -> `/workspace/releases/board/b85676f-20261113`
- **Live HTTPS:** `https://board.workflows.ac` · loopback `http://127.0.0.1:8787`
- **Supervisor:** PID `629540`, child `node web/dist/server.mjs` PID `629586`, cwd `/workspace/releases/board/b85676f-20261113`

What this release changes for the user: a task enters the column the board presents as "waiting for you" only when it carries a clickable artifact — a screenshot, a short video, a link, or a question with at least one preset answer. "An agent is reviewing" reads as exactly that.

---

## 1. Build and staging

Server bundle rebuilt **from source at `b85676f`**; `web/dist/server.mjs` was not copied from any earlier artifact or from `web/dist`.

```bash
npx --no-install esbuild web/server.ts --bundle --platform=node --format=esm \
  --target=node20 --packages=external \
  --outfile=/workspace/releases/board/b85676f-20261113/web/dist/server.mjs
```

Bundle size `253,113` bytes (`247.2 kb`), matching the delta review's esbuild log.

### Bundle assertions (on the built artifact)

| Assertion | Result |
|---|---|
| `human_review_required` | 3 occurrences (create, status route, body edit) |
| `missing_options` | 1 (reason table) |
| `conflicting_status_labels` | 1 |
| `invalid_url` | 1 |
| `insecure_url` | 1 |
| `write_rejected` | **1 — retained** |
| `if-match` (case-insensitive) | **0 — none** |
| `Human Review` section name | 5 |
| `Open Questions` section name | 2 |

Type-union members are erased by the TypeScript build, so one runtime occurrence per reason code is expected and correct.

Manifest: `sha256sum -c --strict checksums.sha256` -> **13/13 OK, exit 0**.
Two-way coverage: `files_not_in_manifest = 0`, `manifest_not_in_files = 0` (13 files each; `checksums.sha256` excluded from itself as the supervisor requires).

---

## 2. Hash table — staged vs live HTTPS

| Asset | Staged SHA-256 | Live HTTPS | Match |
|---|---|---|---|
| `package.json` | `e6e333e151fb5625be106476226666021fa8e0076fc072f68289842c07bfd7ee` | *(not served)* | staged only |
| `web/dist/server.mjs` | `9186e20d072df35e980c5cd74b4ade3d884daeb1a85af42926b0d2f97c2bc1e3` | *(not served)* | staged only |
| `index.html` | `bd42fc35ce3e46ad725ed74c23d7705fce3a34d92d52fb9a0457a66fe1446bb2` | same | **EXACT** |
| `app.js` | `31c04a4f1c47a6d7265fb5984adaa07e5578d233d300dc2ed2bcbe2a17db3a8d` | same | **EXACT** |
| `theme.css` | `6c224817cdd47537e84a48ca39780a811a14ade2b9ecd89bc1e2e064b2d2a9e7` | same | **EXACT** |
| `arrange.js` | `a51d2b63000fd7538fd84ff5f4bfc3a567215e26fe4f51060e7f9af9db66d1c9` | same | **EXACT** |
| `markdown.js` | `4800aa42460ded29e6e812b04fadb91075728722ea7c29e75a44c57a8b5aee86` | same | **EXACT** |
| `manifest.json` | `7856be7b675d4a0f129fc74ee61e3fc4297153f467991b651e143c598b1566c3` | same | **EXACT** |
| `icon.svg` | `b7799aad8afb8ad911dca6a7866bbe13e1fa79c1640f113892a7ea2ddc021082` | same | **EXACT** |
| `icon-192.png` | `00551232e29e958f33ef0c062175e8c027e213510091d22faf904b75c4fd816f` | same | **EXACT** |
| `icon-512.png` | `9fa990251b3fea9fef4abaa8435bbb83f571efc817de13e09103a752e3be8266` | same | **EXACT** |
| `apple-touch-icon.png` | `0803377e2900847d8b1dcadfd9f51de815e492d302954a4018b12965a49e976c` | same | **EXACT** |
| `sw.js` | *(disk)* `8a6b880e30522069f2337e164339f6ec4f526ee49b62b66e959768994d580814` | *(runtime)* `1f7217274d2bb4ed5da83f5144361261a5a5401b6e7c8586651c2fb5d35cf569` | **RUNTIME MATCH** |

`GET /` bytes equal `index.html` (`bd42fc35…`) on HTTPS. The 10 served assets were re-fetched and re-hashed **after** the restart in §6 and remained EXACT.

---

## 3. Pre-cutover and post-cutover state

### Pre-cutover (recorded before any change)
- Symlink: `current` -> `/workspace/releases/board/e604b9e-20261112`
- Supervisor PID `73`, child PID `111`, child cwd `/workspace/releases/board/e604b9e-20261112`
- `http://127.0.0.1:8787/health` -> 200 `{"status":"ok","version":"1.2.1","uptime":10133}`
- `https://board.workflows.ac/health` -> 200 (same payload)
- Served `sw.js` CACHE_VERSION `1.2.1-d32d4abee5`
- **All 12 previous release directories passed `sha256sum -c --strict`** before the cutover.

### Cutover sequence (executed)
1. `ln -s /workspace/releases/board/b85676f-20261113 current.tmp && mv -Tf current.tmp current` (atomic `rename`)
2. `kill -TERM 73`; supervisor logged `Received signal TERM`, forwarded TERM to child `111`, reaped it, exited in ~400 ms; pid file removed
3. `env -i PATH=… HOME=/workspace GITHUB_TOKEN=… /bin/sh /workspace/code/openchamber-config/tools/board/start.sh`
   Clean environment; deployment settings loaded from `/workspace/.openchamber-data/board/board.env`; token and session secret derived by `start.sh`; no secret printed.

### Post-cutover
- `http://127.0.0.1:8787/health` -> **200** `{"status":"ok","version":"1.2.1","uptime":7}`
- `https://board.workflows.ac/health` -> **200**
- `board.log`: `board: listening on http://0.0.0.0:8787 for Workflows-Accelerator/openchamber-github-task-board as workflows-accelerator-agent (password source: BOARD_PASSWORD_HASH)`

---

## 4. Live-origin marker proof (fetched over HTTPS, not from disk)

`https://board.workflows.ac/app.js` (SHA-256 `31c04a4f…`, byte-identical to staged):

| Marker (V4-3) | Count | Meaning |
|---|---|---|
| `human-review` | 20 | human-review panel, class and element IDs |
| `human_review_settled_title` | 5 | settled title (`Answer received` / `Réponse reçue`) |
| `human_review_missing` | 8 | `Waiting for an artifact` |
| `human-review-image-error` | 1 | inline image fallback element |
| `human_review_image_failed` | 3 | inline image fallback copy (EN/FR/usage) |
| `Answer received` | 1 | settled state |
| `Waiting for an artifact` | 1 | missing-artifact state |

| Marker (V4-2 non-regression) | Count |
|---|---|
| `agent-note-composer` | 2 |
| `question-option-card` | 1 |
| `canvasZoomLimitText` | 3 |

`https://board.workflows.ac/index.html`: `Workflows Board` ×3 (title, sidebar brand, status strip).

---

## 5. Service worker cache invalidation

| | CACHE_VERSION |
|---|---|
| Previous live release (`e604b9e`) | `1.2.1-d32d4abee5` |
| New live release (`b85676f`) | **`1.2.1-d0c3700d96`** |

- Served `sw.js` header: `var CACHE_VERSION = "1.2.1-d0c3700d96";`
- Differs from `1.2.1-d32d4abee5`: **YES**
- Independently recomputed from `package.json` version plus SHA-256 of `index.html`, `app.js`, `theme.css`, `manifest.json` (first 10 hex): `1.2.1-d0c3700d96` — matches the served value.
- Live HTTPS `sw.js` bytes equal loopback `sw.js` bytes; both differ from the disk file because the stamp is applied at runtime. `activate` therefore deletes the old `workflows-board-1.2.1-d32d4abee5` cache.

---

## 6. Chromium smoke (signed out, read-only)

### 6.1 Signed-out production (no sign-in)
Both viewports loaded `https://board.workflows.ac/` (HTTP 200), login gate visible, `#board-view` hidden, `GET /api/board` -> 401 `unauthenticated`. No session created, no credential entered, no write.

| Viewport | Status | Page errors | Console errors | CSP violations | Login form box |
|---|---|---|---|---|---|
| 390x844 | 200 | 0 | 1 — expected `401` resource error from the auth gate | 0 | 308x122 |
| 1280x900 | 200 | 0 | 1 — same expected `401` | 0 | 370x122 |

The single console error per viewport is the browser reporting the correct signed-out `401` for `/api/board`. Claiming zero console errors would be false.

Screenshots: `screenshots/live-signed-out-390x844.png`, `screenshots/live-signed-out-1280x900.png`.

### 6.2 Four views from the live client bundle
Production is private, so list/canvas/drawer/Decisions cannot be opened on real data without signing in, which the brief forbids. `render.mjs` loads the **live production assets** and intercepts only `/api/**`, answering reads from a throwaway local board on the synthetic GitHub fake. Non-GET API calls are refused (0 mutations attempted). No production session, no GitHub request, no write.

The fixture carries a real `### Human Review:` **question** gate (ready, with presets) and a **settled** gate, so the render proves the V4-3 surfaces exist in the deployed bundle.

| Viewport | View | Evidence |
|---|---|---|
| 390x844, 1280x900 | List | 3 cards, 1 `Answer received` badge |
| 390x844, 1280x900 | Canvas | cards, dependency arrows, zoom surface |
| 390x844, 1280x900 | Drawer | title, `agent-note-composer` present, human-review panel `data-review-state=ready`, title **"Waiting for you"**, radio presets `PostgreSQL` / `SQLite`, gate form present |
| 390x844, 1280x900 | Drawer (settled) | panel `data-review-state=settled`, title **"Answer received"** |
| 390x844, 1280x900 | Decisions | 1 grouped decision |

Console errors 0, page errors 0, CSP violations 0 in all renders (`browser-render.json`). Screenshots `screenshots/rendered-synthetic-{list,canvas,drawer,drawer-settled,decisions}-{390x844,1280x900}.png`.

---

## 7. Incident during verification (disclosed)

Between the first successful smoke render and the next probe, the post-cutover supervisor `607172` and child `607214` **disappeared without a shutdown log entry** (`supervisor.log` ends at `Child process started with PID 607214`; no `Received signal TERM`, no crash line). Loopback returned connection refused and `https://board.workflows.ac/` returned **502** for at least 10 s while both pids were gone and nothing listened on 8787.

- Not an OOM: `memory.events` `oom_kill 0`, `dmesg` empty, 4 GB available.
- Not a release fault: the process was gone, not erroring; the same bundle had served correctly minutes earlier.
- Recovery: `start.sh` reported `Stale supervisor PID 607172 detected and cleared` and started supervisor `629540` / child `629586`; health returned 200 immediately.
- Every proof in §2, §4, §5, §6 was **re-run after the restart** and passes.
- The supervisor was then observed alive and healthy for the remainder of the release work.

Root cause was not determined. If the pattern recurs, treat it as a supervisor/host lifecycle issue, not a regression of this bundle: the same `start.sh`/`supervisor.sh` pair (unmodified) manages every prior release.

---

## 8. Rollback

- **Rollback target:** `/workspace/releases/board/e604b9e-20261112` (last live release; `sha256sum -c --strict` PASS)
- **One-command rollback** (`rollback.sh`, `sh -n` and `bash -n` clean):

```bash
sh .agents/run/chamberos-board-v2/verifications/b85676f-20261113/rollback.sh
```

which performs:

```bash
ln -s /workspace/releases/board/e604b9e-20261112 /workspace/releases/board/current.tmp && \
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current && \
kill -TERM "$(cat /tmp/opencode/board-supervisor/supervisor.pid)" && \
while [ -f /tmp/opencode/board-supervisor/supervisor.pid ] && \
      kill -0 "$(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0)" 2>/dev/null; do sleep 0.2; done && \
env -i PATH=/workspace/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
  HOME=/workspace GITHUB_TOKEN="${GITHUB_TOKEN:-}" \
  /bin/sh /workspace/code/openchamber-config/tools/board/start.sh
```

- The forward direction of this exact sequence (atomic repoint, TERM, wait, clean-env `start.sh`) was executed for this release; the reverse uses the same steps with the previous target.
- **Valid preserved rollbacks, all `sha256sum -c --strict` PASS before the cutover:**
  `e604b9e-20261112`, `26fbc00-20261112`, `7339629-20261111`, `0e6d237-20261111`, `5bf1c62-20261111`, `59e5d05-20261111`, `98261a8-20261103`, `8b7e059-20261102`, `ab7516c-20261030`, `cc08379-20261029`, `8df6d7b-20261028`, `07d8511-20261027`.
- No previous release was modified, renamed or deleted. The release directory count went 12 -> 13.

---

## 9. Caveats the user must know

- A task now waits for you only with a screenshot, short video, link, or a question that offers **at least one preset answer**. Anything else is refused by the board.
- A question gate with **no preset answer** is refused. If such a task is already waiting, the card says "Waiting for an artifact" and you can still type an answer; after answering, the task **stays** in `status:needs-human` with an "Answer received" card — use the status control to send it back to the agent.
- A task marked waiting **from outside the board** (a `status:needs-human` label applied on GitHub) still shows "Waiting for an artifact"; the status control sends it back.
- A **saved custom AI issue prompt** replaces the new default. Reset it so agents attach an artifact with at least one preset when they ask a question.
- Review **images load from their https host** when you open the task, so that host sees your IP.
- The **Operations view and the OpenChamber panel** still say "Needs human" / "In review" (F5, carried).
- A create carrying **two status labels** now gets `400 conflicting_status_labels`. No board surface can send it; the message is precise.
- Documentation follow-up (Low): `docs/issue-body-contract.md` §2.5 and the Open Questions prompt bullet still call presets optional, while §2.9 requires one for a gate. The code is right; the sentence is stale.

---

## 10. Compliance

- No secret printed or read: only `/health` payloads, PIDs, checksums and public assets were captured. `board.env` was enumerated by key name only; token and session secret were never displayed.
- Zero edits under `/workspace/code/openchamber-config`; `tools/board` was read and executed only.
- Zero GitHub writes, zero issue/label changes, zero comments posted, zero real-repository writes. All fixture traffic went to the local synthetic fake.
- Nothing pushed. No `git remote -v`; no credential printed.
- `.agents/run/chamberos-board-v2/verifications/V4-1-L4/` left untouched (still untracked).
- Signed out of production throughout; the only session created was against the throwaway local board.

---

## 11. Not verified / blind spots

- Authenticated production flows (real board data, real GitHub reads through the production token) were not exercised; the brief forbids signing in and writing.
- The four authenticated views were rendered from live assets with synthetic API data, not with production data.
- Browser-side service-worker installation/eviction was not observed in a persistent profile; only the served `CACHE_VERSION` change was proven.
- Rollback was not executed backwards (would take the live board down twice); its target checksums and the identical forward sequence were verified.
- Long-term stability of the supervisor process after the incident in §7 was not proven beyond the observation window of this release.
