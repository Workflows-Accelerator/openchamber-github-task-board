<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_BASE_SHA] (clean; live V3 already deployed as 5bf1c62-20261111; the sign-in hotfix V3-5 is committed on top)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Test commands (RUN SEQUENTIALLY, never in parallel — parallel CPU contention flakes test/stage1-dual-mode-and-scoping.test.js):
  npm test
  node --test --test-timeout=30000 web/tests/*.test.mjs
  npm run typecheck
  npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/opencode/v3-server-check.mjs
  source .agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh && node scripts/generate-delivery-smoke.mjs
Do not touch: panel/**, web/public/app.js:2268 dot-grid formula, /workspace/code/openchamber-config/** (READ/EXECUTE only), /workspace/.openchamber-data/** (never read or print secrets), GitHub issue closures, git push, git reset, git rebase, /workspace/releases/**
Do not mutate the user's real GitHub repositories. Reproduce against the synthetic fake-GitHub fixtures (`web/tests/fake-github.mjs`) or a local fake server. If a real-repo reproduction is genuinely unavoidable, STOP and return a BLOCKED verdict explaining exactly what mutation you would need and why.
Preflight facts are true and authoritative at dispatch: do not run initial discovery commands (git status, pwd, ls) to re-ground on startup. Re-inspect targeted state only for mutations/pre-commit verification, compaction/resume with stale facts, branch/location changes, or action failure.
</env_preflight>

<goal>
Find and fix, at root cause, the live P0 defect the user reported on the deployed board: dragging an issue card on the Canvas does not persist its position and surfaces an "unknown error" message. No fix may be a label change or an error-message rewording: the drag must save and survive a reload.
</goal>

<user_report>
"C'est beaucoup mieux. ... quand je déplace une issue dans le canvas, ça ne bouge pas et ça met unknown error. Donc je ne sais pas pourquoi ça ne marche pas de déplacer des canvas. Mais en tout cas, ça ne fonctionne pas."
Reported on the live deployment (`https://board.workflows.ac`, release `5bf1c62-20261111`, app commit `5bf1c62`), on a phone, against the real GitHub-backed board. The board is password-protected; the exact repo/issue is unknown.
</user_report>

<starting_evidence>
- Client: `web/public/app.js` throws `ApiError('write_outcome_unknown', ...)` for network failures (`:349`), non-OK writes with unusable bodies (`:385`, `:419`, `:426`), non-JSON 200s (`:1526`, `:1571`, `:6039`, `:6095`), and rewrites generic 5xx text to "Outcome unknown — refresh to check GitHub state" (`:415-417`). Any of these paths produces exactly the wording the user saw.
- Server: `PATCH /api/issues/:n/canvas` (`web/server/app.ts:903`), op `kind: 'canvas'` validation (`:2081-2106`), body patch via `setCanvasMarker` (`:2592-2594`), and a post-write cache invalidation in V3-3 (`invalidateRepositoryCaches()` in `finally`).
- V3-3 changed the write/read interaction: weak ETags scoped per session (`app.ts:162,666,709,762`), `Cache-Control: private, no-cache`, conditional `If-None-Match` `304` on GETs, singleflight coalescing, and cache generation invalidation after mutations.
- Runner may have logs for the live process; read-only log inspection is allowed and is the fastest way to learn the real HTTP status of the failing canvas write.
</starting_evidence>

<steps>
1. Reproduce first, with evidence, before changing any code:
   - Stand up the local synthetic stack (fake GitHub + the real bundled server) with a board containing several issues, one of them with a large body, and drive a real Chromium drag of a `.canvas-card` via `.agents/run/chamberos-board-v2/verifications/A-delivery/hostile2/scripts/chromium-env.sh`.
   - Capture the exact request/response: method, URL, request body, status, response headers (`ETag`, `Cache-Control`), and response body of the canvas PATCH, plus the client-side `ApiError` code and message.
   - Repeat the drag for: a second drag of the same card, a drag after an automatic refresh, a drag after a status change, and a drag of a card whose issue body contains a canvas marker with notes. Also test the very first drag right after a page load that used a conditional `304` GET.
   - If the local stack does not reproduce, inspect the live process logs (read-only) for `/canvas` request statuses, and reconstruct the failing path from them. Then reproduce that exact path locally.
2. Diagnose the root cause and state it explicitly in the proof: one sentence naming the failing stage (client request construction, server validation, GitHub write, post-write response, or client response parsing) plus the file:line that is wrong. Do not guess; if two causes are possible, say which you proved.
3. Fix at root cause with the smallest correct diff. Expected candidate areas (verify, do not assume): the canvas op response body/shape the client parses, the fingerprint/stale-write path, the interaction between the new cache invalidation / singleflight / conditional ETag handling and write responses, or the client's `If-None-Match`/`?refresh=1` handling on writes. Never silently discard a user's move: if the write genuinely fails, the card must snap back with a precise, actionable message, not a generic "unknown error".
4. Harden the failure reporting: for the canvas path specifically, replace the generic wording with a message that names what failed (for example "Canvas position not saved: GitHub rejected the write (409)") in both EN and FR, while keeping the existing i18n pattern and the existing `write_outcome_unknown` code for genuinely unknown outcomes.
5. Add regression tests in `web/tests/` that would fail on the pre-fix code: a canvas write round-trip through the real server against the fake GitHub (position saved, re-read returns the new x/y), a reload after drag returning the persisted position, a stale-fingerprint canvas write returning a precise error, and a canvas write issued right after a conditional `304` GET.
6. Prove it in real Chromium: drag a card, reload the page, assert the card is at the dropped coordinates both in the DOM and in the persisted issue body marker; assert zero console errors; capture before/after PNGs under `.agents/run/chamberos-board-v2/verifications/V3-6/screenshots/`.
7. Run every suite sequentially and record counts in `.agents/run/chamberos-board-v2/verifications/V3-6/proof.md`. Commit on `feat/board-v3`. Do not push and do not touch `/workspace/releases/**`; deployment is a separate reviewed step.
</steps>

<criteria>
1. A real Chromium drag of a canvas card persists: after a full page reload, the card is rendered at the dropped position, and the issue body marker contains the new coordinates. Proven with screenshots plus the persisted marker bytes.
2. The exact root cause is named with file:line and the specific failing condition, and the regression tests fail on `[FILL_BASE_SHA]` and pass on the fix.
3. No generic "Outcome unknown" remains on the canvas path for known failure causes; EN and FR both give a precise message.
4. Zero regression: `npm test` 618/618, all `web/tests/*.test.mjs` pass, `npm run typecheck` exit 0, esbuild bundle exit 0, `scripts/generate-delivery-smoke.mjs` all sections pass — all sequential.
5. `git diff [FILL_BASE_SHA]..HEAD -- panel service` is empty; dot-grid formula at `web/public/app.js:2268` unchanged; no real GitHub repository mutated; no secret printed.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: FIXED | NOT_REPRODUCIBLE | BLOCKED
- ROOT_CAUSE: one sentence plus file:line and the failing condition
- EVIDENCE_BEFORE: the exact failing request/response (status, headers, body) that produced "unknown error"
- FIX: what changed and why, with file:line
- COMMITS: exact SHAs on feat/board-v3
- PROOF: persisted marker bytes before/after drag, reload assertion, screenshot paths
- TEST_COUNTS: legacy, web, typecheck, bundle, smoke — sequential
- NOT_VERIFIED: honest blind spots
</output>
