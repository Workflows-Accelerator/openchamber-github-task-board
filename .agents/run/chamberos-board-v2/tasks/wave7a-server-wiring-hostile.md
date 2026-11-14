<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-server-wiring-l4
Branch: feat/wave7a-server-wiring-l4
HEAD: b3baeba (base 5edb450)
Mode: Read-only audit + adversarial tests if defects are found. Do NOT edit `web/public/*`, config dirs, `board.env`, `jwt-secret`, or real GitHub.
Test commands:
- node --test --test-timeout=60000 web/tests/wave7a-server-wiring.test.mjs
- node --test --test-timeout=60000 web/tests/*.test.mjs
- npm run typecheck && npx tsc -p web/tsconfig.json --noEmit
- npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=/tmp/antigravity/wave7a-l4-server.mjs
</env_preflight>

<goal>
Conduct an independent hostile L4 review of `5edb450..b3baeba` (Wave 7a server wiring: Option A caches, native `parent` read, `/api/layout` API, `order: null`, `SessionActivityTracker` wiring) to figure out what might have been missed or broken. Do not assume what was done is right.
</goal>

<attack_checklist>
1. Inspect `git show b3baeba` completely (`web/server/github.ts`, `web/server/app.ts`, `web/server/board.ts`, `web/server/config.ts`, `web/tests/fake-github.mjs`, `web/tests/wave7a-server-wiring.test.mjs`).
2. Attack **Option A caches** (`github.ts` + `app.ts`):
   - Multi-page `listIssues`: what if page count shrinks (3 pages -> 2 pages) or grows (2 -> 3)? Does stale page 3 linger? What if page 1 is 304 and page 2 is 200 (or page 2 is 304 and page 1 is 200)? What if an issue moves between pages (duplicate or missing issue across cached+fresh pages)?
   - `getIssue` detail ETag: does `304 Not Modified` leak stale body/comments/labels after a local mutation (comment, note, answer, edit, transfer, lock) or `?refresh=1`? Does cache grow unboundedly (`Map` size cap)?
   - `getIssueDependencies` 60s TTL: does link/unlink/transfer/close/edit invalidate BOTH ends of a dependency (`from` and `to`)? Is cache bounded?
3. Attack **native `parent` read**:
   - Does GraphQL `parent` fallback handle partial errors or `parent: null` vs missing `parent` field cleanly? Does REST `GET .../issues/:n/parent` handle 404/410/403 gracefully without failing board/drawer loads?
   - Does `board.ts` / `app.ts` populate `parentKey` & `parentTitle` on `/api/board` and `/api/combined/board` (`IssueSummary`) so Wave 7b Canvas grouping has real parent data without extra per-issue requests? Check this carefully!
4. Attack **`/api/layout`**:
   - Auth + CSRF protection on `PATCH /api/layout` (cross-origin or missing CSRF header rejected)?
   - Scope validation (`'all'` vs `'owner/repo'` vs arbitrary huge/weird scope strings)?
   - Does `GET /api/board` / `/api/combined/board` return `layout` cleanly, and does `PATCH /api/layout` update the board ETag (no stale 304 after layout change)?
5. Attack **`order: null` & `SessionActivityTracker`**:
   - Does `PATCH` `order: null` preserve `<!-- board-canvas -->` and other issue body content intact, and reject invalid non-null `order` cleanly before hitting GitHub?
   - Does `SessionActivityTracker` failure/timeout degrade silently without slowing or failing `/api/board`, and does `activeSession` match `owner/repo#number` case-insensitively?
6. Fix any genuine defect you find with a failing test first in `web/tests/wave7a-server-wiring.test.mjs`, re-run all tests + typecheck + esbuild, and commit cleanly as `fix(board): harden Wave 7a server wiring after hostile review` (or report clean APPROVED if zero defects found).
</attack_checklist>

<output>
At most 10 lines: VERDICT (APPROVED or FIXED_AND_APPROVED), FINDINGS, TEST_COUNTS (focused, web, typecheck, esbuild exit codes), COMMIT, NOT_VERIFIED.
</output>
