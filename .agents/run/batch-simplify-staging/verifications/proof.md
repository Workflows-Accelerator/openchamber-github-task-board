# Deep Verification Result: Combined Staging Integration (#47 + #48)

**Task:** Combined staging integration of accepted Issue #47 (Fresh App & Stay Signed In) and Issue #48 (Simplified Views & Draft List on Extension Panel and Standalone Web Board).
**Status:** PASS (L0–L4 PASS; L5 AWAITING HUMAN)
**Timestamp:** 2026-10-29T17:21:00Z
**Branch:** `feat/batch-simplify-staging`
**Base:** `master` (`cc083796c4bf62b57aaa76e2908f8b5cd47347dd`)
**Integrated Candidates:**
- Panel (#48): `c9fb61b8f4d7fa2178481abaff588b2e23b8380e` (L4 ACCEPTED)
- Web (#48 + #47): `d5a205da26827d0555824339fcb14c9a39d7af7f` (L4 ACCEPTED; contains #47 `268bd28738443863d6a58b5e4500ad20b6aaa05f`)

### Executed Levels
- **L0 Static:** PASS
  - `git merge-base --is-ancestor cc08379 HEAD`: exit 0
  - `git merge-base --is-ancestor 268bd28738443863d6a58b5e4500ad20b6aaa05f HEAD`: exit 0
  - `git merge-base --is-ancestor c9fb61b8f4d7fa2178481abaff588b2e23b8380e HEAD`: exit 0
  - `git merge-base --is-ancestor d5a205da26827d0555824339fcb14c9a39d7af7f HEAD`: exit 0
  - `git diff --exit-code 268bd28738443863d6a58b5e4500ad20b6aaa05f HEAD -- web/server/auth.ts web/server/config.ts web/public/sw.js`: exit 0 (0 byte diff)
  - `npm run build:panel -- --outfile=/tmp/antigravity/panel-staging-check.js && cmp -s panel/main.js /tmp/antigravity/panel-staging-check.js`: exit 0 (0 byte diff, deterministic bundle parity)
  - `npm run typecheck`: exit 0, 0 errors
  - `npx tsc -p web/tsconfig.json`: exit 0, 0 errors
- **L1 Unit:** PASS
  - `node --test test/shipped-parity.test.js`: exit 0 (18 pass, 0 fail)
  - `node --test --test-concurrency=1 test/*.test.js`: exit 0 (595 pass, 0 fail)
  - `node --test web/tests/*.test.mjs`: exit 0 (449 pass, 0 fail)
- **L2 Integration:** PASS
  - Server build: `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs`: exit 0 (`163.4kb`)
  - Standalone multi-repo fake GitHub integration and session persistence verified with private test directories.
- **L3 The User's Way (Browser & HTTP):** PASS
  - `node web/tests/issue-48-browser-verify.mjs`: exit 0 (14/14 checks pass, 0 page errors)
  - `node web/tests/browser-verify.mjs`: exit 0 (33/33 checks pass, 0 page errors, 10 screenshots)
  - Running preview server live HTTP probe:
    - `GET http://127.0.0.1:4040/health`: HTTP 200 OK (`{"status":"ok","version":"1.2.1","uptime":2}`)
    - `GET http://127.0.0.1:4040/api/session`: HTTP 200 OK (`{"authenticated":false}`)
    - `POST http://127.0.0.1:4040/api/session` with `{"password":"correct horse battery staple"}`: HTTP 200 OK, sets `board_session` cookie (`Max-Age=2592000`, 30-day session)
  - Running preview headless browser probe:
    - Login page loaded, readonly username `board` present for desktop Chrome/mobile password manager auto-offer (D49)
    - Successful sign-in, board rendered with multi-project items, 0 page errors
    - Screenshots captured at desktop and mobile viewports (`preview-login.png`, `preview-board.png`, `preview-mobile.png`)
- **L4 Hostile Review (AI per-issue):** PASS
  - All hostile reviews (`#47` isolation review, `#48` panel hostile/correction/recheck, `#48` web hostile/recheck) accepted with all findings closed.
  - Secret-free untracked proofs preserved in `.agents/run/batch-simplify-staging/preserved-proofs/`.
- **L5 Human Validation:** AWAITING HUMAN (running preview live on port 4040 with synthetic data)

---

### Empirical Evidence ("The User's Way")
1. **Ancestry & Test Suite Executions:**
   - Command: `git merge-base --is-ancestor cc08379 HEAD && git merge-base --is-ancestor 268bd28 HEAD && git merge-base --is-ancestor c9fb61b HEAD && git merge-base --is-ancestor d5a205d HEAD`
   - Exit Code: `0`
   - Command: `node --test --test-concurrency=1 test/*.test.js`
   - Exit Code: `0` (595 passed, 0 failed, duration ~32.8s)
   - Command: `node --test web/tests/*.test.mjs`
   - Exit Code: `0` (449 passed, 0 failed, duration ~25.4s)
2. **Browser Verification Suite:**
   - Command: `node web/tests/issue-48-browser-verify.mjs`
   - Output: 14 checks passed, 0 page errors
   - Command: `node web/tests/browser-verify.mjs`
   - Output: 33 checks passed, 0 page errors, 10 screenshots
3. **Live Nonproduction Preview Server:**
   - Process PID: 1690522
   - URL: `http://127.0.0.1:4040` (and `http://0.0.0.0:4040`)
   - Fake GitHub URL: `http://127.0.0.1:46645`
   - Credentials: Username `board` / `preview-user`, Password `correct horse battery staple`
   - Repositories: `Workflows-Accelerator/openchamber-github-task-board`, `Workflows-Accelerator/workflows-mobile-pwa`
   - Browser Verification Probe: `node .agents/run/batch-simplify-staging/preview/verify-running-preview.mjs` -> 0 page errors
   - Screenshot Artifacts:
     - `.agents/run/batch-simplify-staging/verifications/screenshots/preview-login.png`
     - `.agents/run/batch-simplify-staging/verifications/screenshots/preview-board.png`
     - `.agents/run/batch-simplify-staging/verifications/screenshots/preview-mobile.png`

---

### Preserved Untracked Feature Proofs
- `.agents/run/batch-simplify-staging/preserved-proofs/issue-47-isolation-review/proof.md`
- `.agents/run/batch-simplify-staging/preserved-proofs/issue-48-panel-hostile/proof.md`
- `.agents/run/batch-simplify-staging/preserved-proofs/issue-48-panel-correction/proof.md`
- `.agents/run/batch-simplify-staging/preserved-proofs/issue-48-panel-recheck/proof.md`
- `.agents/run/batch-simplify-staging/preserved-proofs/issue-48-web-hostile/proof.md`
- `.agents/run/batch-simplify-staging/preserved-proofs/issue-48-web-recheck/proof.md`

---

### Human Review Brief (L5)
**Batch:** Simplified Views, Draft List, Short Names, Stay Signed In (#47, #48)
**Branch:** `feat/batch-simplify-staging`
**Preview URL:** `http://127.0.0.1:4040` (or host forwarded port 4040)
**Preview Credentials:** Password `correct horse battery staple` (Username autocomplete: `board`)
**Preview Process PID:** `1690522` (Shutdown: `kill 1690522`)

| # | What to click | What should happen |
|---|---|---|
| 1 | Open `http://127.0.0.1:4040` | Login page loads; Chrome desktop / mobile offers saved password under user `board` |
| 2 | Enter `correct horse battery staple` and click Sign In | Board loads immediately with 30-day session cookie |
| 3 | Click View selector and switch among Simple list, Cards, Kanban, Graph, and Pending items | Each view displays tasks cleanly using the same active filters and sort order |
| 4 | In Pending items view, toggle a checklist subtask or answer the open question | Markdown updates conflict-safely without closing the issue or corrupting headers |
| 5 | Filter by "Draft" in Simple list view | Quick capture mode activates; capture input appears at the bottom |
| 6 | Type title and optional description in bottom capture row and press Enter | New draft appears at bottom without launching an OpenChamber session |
| 7 | Reorder drafts using Up/Down buttons or drag-and-drop | Marker `<!-- board-order: ... -->` updates on GitHub issue body without being visible in the UI |
| 8 | Open project switcher or settings and rename short project | Project label updates immediately and persists across reloads |
| 9 | Select "All Projects" | Tasks from both repositories appear with short repo badges; same-number tasks remain distinct |
| 10 | Reload page / open second tab | View, filter, and sort state are remembered; user stays signed in without password prompt |
| 11 | Click Sign Out | Session is revoked immediately; page redirects to login form |

**Known blind spots for the human reviewer:**
- Physical touch feel on real iOS/Android devices
- OS password manager autofill prompts on native mobile browsers
- Screen-reader voice announcements on dynamic view changes
- Real GitHub GraphQL `transferIssue` permission restrictions on third-party organizations
- Multi-issue GitHub reorder rebalance is sequential and conflict-checked per issue rather than an atomic GitHub transaction
- Project rename overrides remain local to each surface (extension storage vs web board storage)
