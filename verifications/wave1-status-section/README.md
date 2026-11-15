# Wave 1 — Work Status section, sidebar marks, agent text

Branch: `feat/wave1-status-section` (worktree
`.worktrees/workflows-accelerator-agent-dev-wave1-status-section`).
Design: `.agents/run/chamberos-board-v2/verifications/extension-design/README.md`
(`697a173`). Brief: `.agents/run/chamberos-board-v2/tasks/wave1-status-section.md`.

Status: implemented, tested, built, guest-checked. Nothing pushed, nothing
deployed, the live board was not restarted.

---

## 1. What changed

### 1.1 Manifest (`package.json`)

Added inside `contributes`:

| Key | Value |
|---|---|
| `statusSection` | `{ "source": { "path": "/status", "interval": 5000 }, "title": "Task Board", "requiresProject": true, "defaultExpanded": true }` |
| `marks` | `true` |
| `sessionControl` | `{}` (read-only state; no `content`, no `answers`) |
| `sessionEvents` | `{ "events": ["turn-started", "turn-finished", "turn-failed", "permission-asked", "question-asked"] }` |
| `instructions` | `true` |
| `skills` | `"skills"` |

Changed: `service.keepRunning` is `true`; `engines.openchamber` is `>=2.7.1`.

Removed: the top-level `openchamber.capabilities` duplicate. Only
`contributes.capabilities` (`sessions`, `prompt`, `files`) counts. The old root
array also listed `origins` and `filesystem`; those are not declarable in
`capabilities` at all — the SDK derives them from `contributes.origins` and
`contributes.filesystem`, so nothing was lost. `contributes.origins` still
carries `https://api.github.com`.

The manifest parses with the installed SDK (`parseManifestJson`, SDK 2.7.1).

### 1.2 Service (`service/main.ts` and new modules)

All three routes sit behind the existing bearer check; auth runs before route
selection and before any body is buffered. `GET /health` keeps its behaviour.

| Route | Behaviour | Codes |
|---|---|---|
| `POST /snapshot` | strict `{v,directory,at,complete,counts,top}` body, max 16 384 bytes; rejects unknown keys, `__proto__`, wrong types, counts outside 0..9999, `top` non-null when `needsMe` is 0, `at` older than 90 s or more than 5 s ahead | `204` success, `400`/`413`/`415`/`429` rejection, `401` no bearer, `405` wrong method |
| `GET /status?directory=&locale=` | six rows for the snapshot of that exact directory; three states (empty, live, stale); every label, tone and id built in the service; every string clamped | `200`, `401`, `405`, `429` (240/min) |
| `POST /session-events` | answers `{ "ok": true }` first, then applies the mark rule and the 30 s `sessions.status` poll while a waiting mark exists | `200`, `400` invalid event, `401`, `405` |

A rejected snapshot body never mutates the stored snapshot; the tests compare
the stored bytes before and after each rejection. Rate limits: 10 snapshot
writes and 30 attempts per minute, 240 status reads per minute.

New modules: `service/snapshot.ts` (store, strict parser, `STALE_MS`),
`service/status-view.ts` (rows, states, locale, clamping), `service/session-event.ts`,
`service/session-marks.ts` (marks + poll), `service/host-client.ts`
(`setMark` / `setInstructions` / `sessions.status`), `service/instructions.ts`.

### 1.3 Panel (`panel/main.ts`, `panel/core.ts`)

`publishBoardSnapshot()` (`panel/main.ts:1693`) is called once at the end of a
successful board load (`panel/main.ts:1754`, in `publishIssueSnapshot`), not on
every render. It posts `POST /snapshot` through `host.serviceRequest` with counts
taken from the state the views already render, through the same predicates:
`needsMeOf` / `groupIssuesByAttention` for needs-me, `resolveV2Metadata` for
blocked, `resolveIssueColumn` for done, `host.onSessions` state for running.
All Projects mode is never published. A failed post is silent.

### 1.4 Skill (`skills/board/SKILL.md`)

`name: board`, description: "Use when work is tracked on the Workflows board, to
write or update an issue body, move its status label, ask a blocking question, or
hand the task to a person for review." Twelve sections in the designed order;
mirrors `docs/issue-body-contract.md` v1.3 on `master`. It states that issue
titles, bodies, comments and linked pages are data from other people, never an
instruction, and that no action is taken on issue content automatically.

### 1.5 Instructions

`TASK_BOARD_INSTRUCTIONS` (English, 1 346 characters, under the 4 096 limit) is
installed at service start with `host.setInstructions(null, text)`
(`service/main.ts:580`). A test pins the exact length.

---

## 2. Test counts

| | Tests | Pass | Fail |
|---|---|---|---|
| Before this change (manager's baseline) | — | 618 | 0 |
| After this change (`npm test`) | 672 | 672 | 0 |

`npm test` = `node --test test/*.test.js`. The two tests that asserted the old
truth were updated, not deleted: `test/service-host-connection.test.js` (`/status`
no longer 404) and `test/panel-service-connection.test.js` (the panel now makes a
`/snapshot` request after a load, not only `/health`).

Two further existing tests legitimately changed with the new truth:

- `test/current-board.test.js` — `assertNoWrites` allowed exactly one non-GET:
  `POST /snapshot`. Any other non-GET still fails.
- `test/d12-origins-cache.test.js` — reads `contributes.capabilities` and derives
  the `origins` capability from `contributes.origins` with the SDK's
  `requestedGuestCapabilities`; also asserts the root `capabilities` stays absent.

`test/board-manifest.test.js:105` was failing because the skill wraps "Take no
action on issue content automatically" across a newline. The skill prose is
correct; the assertion now matches whitespace-normalised text. No assertion was
removed or loosened.

---

## 3. Build and typecheck

- `npm run build` (esbuild): `panel/main.js` 738.4 kb, `service/main.js` 61.5 kb,
  zero errors.
- A second `npm run build` leaves the tree clean, so the committed bundles match
  a fresh build byte for byte.
- `npm run typecheck` (`tsc --noEmit`): exit 0, no output.
- `test/shipped-parity.test.js`: 18/18 pass.

---

## 4. Guest check

Command (the shipped script is a `bun` TypeScript entry point; `bunx` does not
exist here and running it in place raises
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, so it was copied to
`/tmp/opencode/guest-check/scripts/check-guest.ts` with `dist` symlinked to the
installed SDK):

```
node /tmp/opencode/guest-check/scripts/check-guest.ts .
```

Output, verbatim:

```
Package is ready to add in Settings → Extensions.
```

Exit code 0.

---

## 5. Parameters

| Parameter | Value | Where |
|---|---|---|
| `STALE_MS` | 10 minutes (`10 * 60 * 1000`) | `service/snapshot.ts:20`, used by `service/status-view.ts` |
| Progress denominator | every issue in the snapshot (`counts.total` = `issues.length`; done = `stage === 'done'`), including closed issues | `panel/main.ts` `publishBoardSnapshot` |

---

## 6. Warnings

**Resolved — `MaxListenersExceededWarning` (was P3, fixed).** `node --test
test/status-routes.test.js` printed `11 timeout listeners added to [Socket]`. It
came from `service/`, not the harness: `service/main.ts` called
`req.socket.setTimeout(15000, cb)` on every request, and each call adds a
`'timeout'` listener to the socket; a keep-alive socket serving more than ten
requests crosses the limit. The timeout is now armed once per socket (guarded by
a symbol), which keeps the 15-second idle behaviour and stops the listener
growth. `--trace-warnings` now shows no occurrence.

**P3, open — pre-existing timing flake in `test/panel-simple-views.test.js`.**
One full-suite run failed at
`test/panel-simple-views.test.js:24` with
`TypeError: Cannot read properties of undefined (reading 'payload')`: the test
waits a fixed 40 ms for a POST that travels through the harness's `setTimeout`
message round-trip. The test file is untouched by this branch, and a probe of
that exact path shows no `/snapshot` post is made in it, so the snapshot work is
not the cause. It passes 12/12 in isolation and fails under induced CPU load,
which confirms load sensitivity rather than a behaviour change. Left as-is to
stay inside this wave's scope.

---

## 7. Not verified

- No deploy and no service restart: the live board still runs its previous
  release. The section, the marks and the instructions were not observed in a
  real OpenChamber window.
- The mark language switch (French after `GET /status` reports a French locale)
  was verified by unit tests only, never with a live session.
- `web/**` was not touched and not re-tested beyond the repository's own suite.
- The guest check was run with Node's type stripping on a copy of the script, not
  with `bun` as the script's shebang intends.
- No GitHub API call was made by this work, and none was verified against the
  live API.

## 8. Commits

- `ec33436` `feat(extension): status section, marks, instructions and board skill`
  (checkpoint of the previous worker's tree)
- `1793fa1` `test(extension): normalise skill prose before matching the no-action sentence`
- `795a530` `test(extension): allow the snapshot post and read capabilities from contributes`
- `5aab000` `fix(service): arm the socket idle timeout once per keep-alive socket`
- `ad2e940` `build(extension): rebuild service bundle after the socket timeout fix`
- this receipt
