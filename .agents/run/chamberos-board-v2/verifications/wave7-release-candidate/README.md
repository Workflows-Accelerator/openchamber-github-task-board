# Wave 7 — release candidate receipt

Prepared 2026-11-14. **Nothing was pushed, deployed, or restarted.** The live
service still runs `/workspace/releases/board/b85676f-20261113`.

| Field | Value |
|---|---|
| Branch | `feat/wave7-overhaul` |
| Merge commit (HEAD at verification) | `422b3a0` — `merge: bring Wave 7 full L4 hardening into wave7-overhaul` |
| Parents | `1d11287` (wave7-overhaul) + `3c45474` (feat/wave7-full-l4) |
| Merge conflicts | none; `git merge --no-ff` completed without manual resolution |
| Artifact | `web/dist/server.mjs` — 300 895 bytes, sha256 `89d4b289f2555f9e1437f043ebf02d820b8817da0acf88d8903add4b27d604b7` |
| Client bundle (check only, not shipped) | `npx esbuild web/public/app.js …` → 462 067 bytes |

## Verification on the merged tree

| Command | Result |
|---|---|
| `node --test --test-timeout=60000 web/tests/*.test.mjs` | 859/859 pass, 0 fail, exit 0 (41.1 s) |
| `npm test` | 618/618 pass, 0 fail, exit 0 (16.3 s) |
| `npm run typecheck` | exit 0 |
| `npx tsc -p web/tsconfig.json --noEmit` | exit 0 |
| `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | exit 0, 293.8 kb |
| `npx esbuild web/public/app.js --bundle --format=iife --target=es2020 --outfile=/tmp/opencode/w7/app.bundle.js` | exit 0, 451.2 kb |

## Artifact smoke test (built bundle, throwaway config, local fake GitHub)

The board ignores `BOARD_GITHUB_API_BASE` from the environment by design
(`web/tests/hosting.test.mjs`), so the bundle's outgoing `fetch` was rewritten to
a local fake GitHub with `node --import fake-github-hook.mjs web/dist/server.mjs`.
No real token was read or used; the fake token was `fake-token-not-real-…`.

```
GET  /health                       200 {"status":"ok","version":"1.2.1","uptime":0}
POST /api/session                  200 authenticated
GET  /api/repos                    200 (0 repos, served from the fake)
GET  /app.js                       200, 462 366 bytes
fake GitHub saw                    GET /user
                                   GET /user/repos?per_page=100&page=1&…
SIGTERM                            child exit code 0, no orphan process
```

Reproduce: `node /tmp/opencode/w7/health-check.mjs "$PWD" /tmp/opencode/w7/health`
(harness lives outside the repo; the script is quoted in full in the session log).

## L4 fixes carried in (from `3c45474`)

1. **Canvas group "needs me" = sidebar count.** `web/public/app.js:3421`
   `function groupNeedsMeOf(groupKey, issues)` counts with `needsHumanAttention`;
   `:6269` `group.needsMe = groupNeedsMeOf(group.groupKey, issues)` overwrites the
   stage-only value the layout module computed.
2. **390 px dock label no longer spills into Decisions.** `web/public/index.html:631`
   the dock uses `data-i18n="nav_blocked_short"` ("Blocked" / "Bloquées",
   `app.js:834`, `app.js:1120`); `web/public/theme.css:3743`
   `#compact-nav-dock button > span:not(.badge) { min-width: 0; overflow: hidden; text-overflow: ellipsis; }`
   plus `min-width: 0; overflow: hidden` on the button itself.
3. **FR phase and attention labels localized.** `app.js:2188` `phaseText` and
   `:2197` `attentionText` look up `phase_*` / `attention_*` in the active
   dictionary (e.g. `phase_human_verification: 'Phase : vérification humaine'`
   `:1127`, `attention_decision: 'Décision attendue'` `:1131`).

## Browser proof

`wave7-full-L4/` holds the L4 report and its 13 Chromium screenshots, copied
byte-for-byte (sha256 verified) from
`.worktrees/workflows-accelerator-agent-dev-wave7-full-l4/.agents/run/chamberos-board-v2/verifications/wave7-full-L4/`.
The screenshots are synthetic captures against the fake GitHub fixture, not the
live board.

## Deploy (NOT run — requires owner approval)

The live layout is `package.json` + `web/dist/server.mjs` + `web/public/*` +
`checksums.sha256`, started by `node web/dist/server.mjs` from the release
directory through the board supervisor. Replace `422b3a0-20261114` with the
final published commit if it differs.

```bash
set -euo pipefail
REPO=/workspace/code/openchamber-github-task-board
REL=/workspace/releases/board/422b3a0-20261114
mkdir -p "$REL/web/dist" "$REL/web/public"
git -C "$REPO" archive 422b3a0 package.json | tar -x -C "$REL"
git -C "$REPO" archive 422b3a0 web/public   | tar -x -C "$REL"
cd "$REPO"
npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 \
  --packages=external --outfile="$REL/web/dist/server.mjs"
cd "$REL"
sha256sum package.json web/dist/server.mjs web/public/* > checksums.sha256
sha256sum -c --strict checksums.sha256
# pre-cutover rollback target (must be the live release before the swap)
readlink -f /workspace/releases/board/current
# cutover
ln -sfn "$REL" /workspace/releases/board/current.tmp
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current
kill -TERM "$(cat /tmp/opencode/board-supervisor/supervisor.pid)"
while kill -0 "$(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0)" 2>/dev/null; do sleep 0.2; done
/workspace/code/openchamber-config/tools/board/start.sh
# prove
curl -fsS http://127.0.0.1:8787/health
curl -fsS https://board.workflows.ac/health
```

## Rollback

Previous release, valid today: `/workspace/releases/board/b85676f-20261113`.

```bash
set -euo pipefail
PREV=/workspace/releases/board/b85676f-20261113
cd "$PREV" && sha256sum -c --strict checksums.sha256
ln -sfn "$PREV" /workspace/releases/board/current.tmp
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current
kill -TERM "$(cat /tmp/opencode/board-supervisor/supervisor.pid)"
while kill -0 "$(cat /tmp/opencode/board-supervisor/supervisor.pid 2>/dev/null || echo 0)" 2>/dev/null; do sleep 0.2; done
/workspace/code/openchamber-config/tools/board/start.sh
curl -fsS http://127.0.0.1:8787/health
```

Rollback is a symlink swap plus supervisor restart; the release directory is not
deleted, so no work is lost if the new build misbehaves.

## Not verified

- No push, no deploy, no supervisor restart, no `board.env`/`jwt-secret` access.
- The deploy and rollback command paths (`supervisor.pid`, `start.sh`) are taken
  from the previous release receipt
  (`.agents/run/chamberos-board-v2/verifications/26fbc00-20261112/release-receipt.md`);
  `/workspace/code/openchamber-config/**` was not read or touched.
- Authenticated behaviour against the live board and real GitHub payloads.
- `npm test` has one unreproduced historical flake (L4 report §8); both suites
  were green on this tree.
