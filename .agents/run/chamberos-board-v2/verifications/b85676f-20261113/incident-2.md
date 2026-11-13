# Incident 2 — second loss of the board supervisor (b85676f-20261113)

Status: service restored. Cause class proven; the killing actor is not.
Date: 2026-11-13, all times UTC. Release unchanged: `current -> /workspace/releases/board/b85676f-20261113`.

## 1. Timeline

| Time | Event |
|---|---|
| 10:55:02 | Container boot: PID 1 `tini -- openchamber serve` starts. No restart since. |
| 13:44 | Release `b85676f-20261113` staged, `current` symlink repointed. |
| 13:54:06.075 | `supervisor.pid`, `supervisor.lock`, `child.pid` written — recovery start after incident 1. Supervisor `629540`, child `629586`. |
| 13:54:07.349 | `board.log` last write: `board: listening on http://0.0.0.0:8787 ...` (child 629586). |
| 13:54:36.210 | `supervisor.log` last write: `[board-supervisor] Child healthy for sustained period (30s >= 30s). Restart allowance and backoff reset.` |
| 13:54:36 → 14:35 | Silence. No shutdown line in either log. Both processes gone. Site 502. |
| 14:35 (observed) | `629540` and `629586` absent from the process table; nothing on 8787; loopback refused; public `/health` 502. |
| 14:36 (restore) | `start.sh`: `Stale supervisor PID 629540 detected and cleared.` New supervisor `703108`, child `703153`. |
| 14:36:3x | Loopback `/health` 200 on first poll; `https://board.workflows.ac/health` 200. |
| 14:37:31 | Supervisor and child alive; sustained-health reset logged for `703153`. |

## 2. Observed state before any change

```
readlink -f /workspace/releases/board/current   -> /workspace/releases/board/b85676f-20261113
/tmp/opencode/board-supervisor/supervisor.pid   -> 629540      (not in process table)
/tmp/opencode/board-supervisor/child.pid        -> 629586      (not in process table)
/tmp/opencode/board-supervisor/supervisor.lock  -> 629540      (file present, kernel flock free)
port 8787                                       -> no socket (/proc/net/tcp :2253 absent)
http://127.0.0.1:8787/health                    -> curl exit 7, 000 (connection refused)
https://board.workflows.ac/health               -> 502
```

`ss`, `netstat`, `lsof`, `journalctl` and `dmesg` are unavailable in this image (`ss: command not found`, `dmesg: read kernel buffer failed: Operation not permitted`), so the port and OOM checks used `/proc/net/tcp` and cgroup counters.

## 3. What I did

```
cd /tmp && env -u BOARD_ENABLED -u BOARD_RELEASE_DIR -u BOARD_STATE_DIR \
  -u BOARD_GITHUB_LOGIN -u BOARD_REPO -u BOARD_PASSWORD -u BOARD_PASSWORD_HASH \
  -u BOARD_SESSION_SECRET -u BOARD_GITHUB_TOKEN \
  /bin/sh /workspace/code/openchamber-config/tools/board/start.sh
```

`start.sh` cleared the stale PID itself (`Stale supervisor PID 629540 detected and cleared.`); no state file was removed by hand. `board.env` and `jwt-secret` were read only by `start.sh`, never by this session. Nothing under `/workspace/code/openchamber-config` was modified. No release was deleted or changed.

## 4. Health proof (public origin, not loopback)

| URL | Code | Bytes | sha256 vs staged release |
|---|---|---|---|
| `https://board.workflows.ac/health` | 200 | 45 | — |
| `https://board.workflows.ac/app.js` | 200 | 417824 | `31c04a4f1c47a6d7265fb5984adaa07e5578d233d300dc2ed2bcbe2a17db3a8d` — **match** (`cmp` identical) |
| `https://board.workflows.ac/index.html` | 200 | 45130 | `bd42fc35ce3e46ad725ed74c23d7705fce3a34d92d52fb9a0457a66fe1446bb2` — **match** (`cmp` identical) |

Staged side compared against `/workspace/releases/board/b85676f-20261113/web/public/{app.js,index.html}`.

## 5. Root cause evidence

Proven:

1. **No graceful shutdown path ran.** `supervisor.sh` installs TERM/INT/HUP traps before publishing its PID and logs `Received signal <SIG>. Shutting down supervisor...`; its other exit paths log `Child process exited with status ...` or `Giving up after ...` and then `rm -f "$PID_FILE" "$CHILD_PID_FILE"`. None of those lines exist, and `supervisor.pid`, `child.pid` and `supervisor.lock` were all still present with `629540`. The supervisor therefore did not execute any of its own exit code.
2. **The child was not stopped gracefully either.** `board.log` ends with child 629586's `listening` line; the earlier graceful stop of child 111 is recorded there as `board: SIGTERM received, closing`. No such line exists for 629586.
3. **Both died together.** Supervisor and child vanished in the same window with no interleaved restart attempt, consistent with one signal delivered to the process group (the supervisor spawns the child into its own group).
4. **Not OOM.** `/sys/fs/cgroup/memory.events`: `oom 0`, `oom_kill 0`; `memory.max` is `max` (no cgroup limit); 5.2 GB resident at inspection. `dmesg` is unreadable in this container, so kernel-side confirmation is unavailable — the cgroup counters are the strongest available evidence.
5. **Not a container restart.** PID 1 started 10:55:02 and is the same process; boot-time `entrypoint.sh` would have relaunched `start.sh` and there would be a supervisor.

Unproven: **who sent the kill.** A signal that cannot be trapped (SIGKILL) is the only mechanism consistent with 1–3, but there is no audit log, no readable `dmesg`, no journald and no shell history showing a `kill`. No `pkill`/`killall` invocation targeting the board was found in `/tmp/opencode`. The killing actor cannot be named from available evidence.

## 6. Same failure as incident 1?

Yes — same signature, second occurrence.

Incident 1 (release receipt §7): "the post-cutover supervisor `607172` and child `607214` **disappeared without a shutdown log entry** (`supervisor.log` ends at `Child process started with PID 607214`; no `Received signal TERM`, no crash line)."

This incident, quoting the final line of `supervisor.log`:

```
[board-supervisor] Child healthy for sustained period (30s >= 30s). Restart allowance and backoff reset.
```

with no shutdown line after it, the same stale `supervisor.pid`/`child.pid`, the same empty port 8787, the same 502, and the same `oom_kill 0`. The only difference is how far the log got: incident 1 died within the new child's first 30 s, incident 2 died after that sustained-health line (between 13:54:36 and the 14:35 report). Same mechanism class, not a release regression — `start.sh`/`supervisor.sh` are unmodified and manage every earlier release identically.

## 7. No automatic restart exists

`entrypoint.sh` calls `tools/board/start.sh` exactly once, before `exec tini`, at container boot. No other file references `start.sh`. `supervisor.sh` restarts only its child. Therefore the death of the supervisor is a permanent outage until someone runs `start.sh` by hand — which is what happened twice today.

## 8. What remains unknown

- The exact time of death between 13:54:36 and 14:35; no request log for the public origin is available here.
- The signal sender and its reason. Candidate classes (unproven): an external `SIGKILL` to the process group by a session/PTY teardown, or a host-level reaper. Neither is demonstrated.
- Whether the supervisor's process group was shared with an agent shell. Its original parent was already gone at inspection, so the ancestry cannot be reconstructed.

## 9. What would prevent recurrence (not attempted here)

Run `supervisor.sh` under a restarter that lives outside the killable process group — a systemd unit with `Restart=always`, or a systemd timer/cron watchdog that re-runs `start.sh` when `supervisor.pid` is dead — instead of a single boot-time `nohup`.
