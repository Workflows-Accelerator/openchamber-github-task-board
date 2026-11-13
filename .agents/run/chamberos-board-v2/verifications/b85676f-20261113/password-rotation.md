# Board password rotation — b85676f-20261113

Owner requested a new board password. Rotation performed on the live release.
No secret material is recorded in this note.

## Timestamps (UTC)

| Event | Time |
|---|---|
| Env backed up / rewritten | 2026-11-13T18:16:38Z |
| Supervisor stopped | 2026-11-13T18:17Z |
| Supervisor restarted | 2026-11-13T18:17Z |
| Verification pass | 2026-11-13T18:18Z |
| Stability re-check (+20s) | 2026-11-13T18:19Z |

## Why the hash line had to go

`web/server/config.ts` reads `BOARD_PASSWORD_HASH` first and only falls back to
`BOARD_PASSWORD` when the hash is absent or empty. Leaving the old hash in place
would have silently kept the old password working. The rewrite therefore removed
`BOARD_PASSWORD_HASH` and appended a single `BOARD_PASSWORD` line.

## Files

| Path | Mode | Note |
|---|---|---|
| `/workspace/.openchamber-data/board/password-latest.txt` | 600 | New password, owner-readable, 24 characters |
| `/workspace/.openchamber-data/board/board.env` | 600 | Rewritten in place; inode preserved |
| `/workspace/.openchamber-data/board/board.env.bak-20261113T181638Z` | 600 | Pre-rotation backup, mode preserved by `cp -p` |

`board.env` inode before and after: `1962963` (truncate-in-place, not a replace).
Mode unchanged at `600`.

Password alphabet is alphanumeric only, which is required because `start.sh`
loads the env file with an unquoted `eval`, so shell metacharacters would be
mangled.

## Env state after rewrite

| Check | Count |
|---|---|
| `BOARD_PASSWORD=` lines | 1 |
| `BOARD_PASSWORD_HASH=` lines | 0 |
| Total lines | 19 (was 19: one hash line replaced by one password line) |

## Verification

| Check | Result |
|---|---|
| `http://127.0.0.1:8787/health` | 200 |
| `https://board.workflows.ac/health` | 200 |
| Served `app.js` vs release `web/public/app.js` (`cmp`) | byte-identical, 417824 bytes |
| `POST /api/session` with new password | 200, `authenticated: true` |
| `POST /api/session` with wrong password | 401, `invalid_credentials` |

The 401 proves the check is live rather than bypassed.

## Processes

| Role | PID |
|---|---|
| Supervisor | 1382624 |
| Server child | 1382667 |

Exactly one supervisor and one server child. The pre-rotation supervisor (823254)
and child (823297) exited within 1s of `SIGTERM`. The watchdog was allowed to fire
during the gap; `start.sh`'s `flock` single-owner lock kept the count at one.

## Leak audit

The new password was compared against the supervisor, board and watchdog logs and
every tracked file in the worktree: 0 occurrences. The secret never appeared in a
command line, a log line, or this note.

## Follow-up

The backup `board.env.bak-20261113T181638Z` is retained until the owner confirms a
successful login, then may be deleted.
