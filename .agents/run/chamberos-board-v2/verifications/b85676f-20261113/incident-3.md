# Incident 3 — third loss of the board supervisor (b85676f-20261113)

Status: service restored; supervisor relaunched outside the killable session; watchdog installed.
Date: 2026-11-13, all times UTC. Release unchanged: `current -> /workspace/releases/board/b85676f-20261113`.
Nothing under `/workspace/code/openchamber-config` was modified. No release was deleted or changed.
`board.env` and `jwt-secret` were read only by `start.sh`, never by this session.

## 1. Timeline

| Time | Event |
|---|---|
| 10:55:02 | Container boot: PID 1 `tini -- openchamber serve`. Host uptime 35 days; PID 1 elapsed 4h44m at inspection, so no container restart. |
| 14:36:33 | Incident-2 restore: `supervisor.pid`/`supervisor.lock`/`child.pid` written. Supervisor `703108`, child `703153`. |
| 14:36:34 | `board.log`: `board: listening on http://0.0.0.0:8787 ...` (child 703153). |
| 14:37:03 | `supervisor.log` last write: `[board-supervisor] Child healthy for sustained period (30s >= 30s). Restart allowance and backoff reset.` **Last line ever written by 703108.** |
| 14:37:03 → 15:39 | Silence. No `Received signal`, no `Child process exited`, no `Giving up`. Both PIDs gone. Site 502. |
| 15:39 (observed) | `703108` and `703153` absent from the process table; no socket on 8787; loopback refused (`000`); public `/health` `502`. |
| 15:40:0x (restore) | `start.sh`: `Stale supervisor PID 703108 detected and cleared.` New supervisor `819664`, child `819719` — still inside the agent session (`SID 3934`). |
| 15:40:4x | Loopback `200`, public `200`. |
| 15:40:5x (harden) | In-session supervisor `819664` stopped with TERM (graceful, trap line present), then `start.sh` relaunched under `setsid`. New supervisor `823254`, child `823297`, `SID 823223`. |
| 15:41:34 | Watchdog started under `setsid`: PID `825993`, `SID 825993`. |
| 15:43:29 | Supervisor `823254`, child `823297`, watchdog `825993` all alive; watchdog log holds 1 line and 0 restart actions; loopback `200`, public `200`. |

## 2. Observed state before any change

```
readlink -f /workspace/releases/board/current   -> /workspace/releases/board/b85676f-20261113
/tmp/opencode/board-supervisor/supervisor.pid   -> 703108   kill -0: not alive
/tmp/opencode/board-supervisor/child.pid        -> 703153   kill -0: not alive
/tmp/opencode/board-supervisor/supervisor.lock  -> 703108   file present, flock free
ss -ltnp | grep 8787                            -> no socket
http://127.0.0.1:8787/health                    -> 000 (connection refused)
https://board.workflows.ac/health               -> 502
```

**The 502 is the app being absent, not the ingress.** Loopback refused while the public origin answered 502, and after the app returned on 8787 both loopback and public answered 200 with no ingress change. The ingress was passing traffic to a dead upstream.

Same signature as incidents 1 and 2: no trap line, no crash line, no `rm -f` of the PID files, both processes gone together, `oom_kill 0` (`/sys/fs/cgroup/memory.events`: `oom 0`, `oom_kill 0`, `oom_group_kill 0`, `memory.max` unlimited), PID 1 unchanged. Consistent with an untrappable signal delivered to the shared process group; the sender is still not identified.

## 3. What I changed

Two things, neither inside the git repo and neither inside the configuration repo.

1. **Supervisor moved out of the agent session.** `start.sh` is still the only launcher, unchanged, invoked with the same `env -u BOARD_…` prefix. The difference is the process context: `setsid` gives `start.sh` a new session, so the supervisor it backgrounds inherits that new session instead of the agent session's.
2. **Watchdog installed** (section 6) — a detached loop outside every repo that re-runs the proven start command when the supervisor PID disappears.

No `systemd` and no `cron` exist in this image (`systemctl`, `systemd-run`, `crontab`, `cron`, `crond`, `atd` all absent; `/run/systemd/system` absent), so `setsid` is the strongest available mechanism. It was present at `/usr/bin/setsid`.

Restore and relaunch command (identical both times):

```
cd /tmp && env -u BOARD_ENABLED -u BOARD_RELEASE_DIR -u BOARD_STATE_DIR \
  -u BOARD_GITHUB_LOGIN -u BOARD_REPO -u BOARD_PASSWORD -u BOARD_PASSWORD_HASH \
  -u BOARD_SESSION_SECRET -u BOARD_GITHUB_TOKEN \
  /bin/sh /workspace/code/openchamber-config/tools/board/start.sh
```

Relaunch wrapped for detachment:

```
setsid /bin/sh -c 'cd /tmp && exec env -u BOARD_ENABLED … /bin/sh \
  /workspace/code/openchamber-config/tools/board/start.sh' \
  </dev/null >>/tmp/opencode/board-supervisor/supervisor.log 2>&1 &
```

## 4. SID/PGID proof

| | Supervisor | PGID | SID | PPID |
|---|---|---|---|---|
| Before (in agent session) | `819664` | `819618` | `3934` | 1 |
| Before, child | `819719` | `819618` | `3934` | 819664 |
| Launching shell | `823187` | `823187` | `3934` | — |
| After (`setsid`) | `823254` | `823223` | `823223` | 1 |
| After, child | `823297` | `823223` | `823223` | 823254 |
| Watchdog | `825993` | `825993` | `825993` | 1 |

- The supervisor's `SID` changed from `3934` (the agent session) to `823223`, and `823223 ≠ 3934`. Its `PGID` changed from `819618` to `823223`, which is neither the launching shell's `PGID` (`823187`) nor its session.
- `PPID` is `1`: the supervisor is no longer a descendant of any agent shell, so a kill that walks the session's process tree by parentage misses it too.
- **Correction to the brief's expectation:** the supervisor's `PGID` does **not** equal its own `PID`. It equals `823223`, the PID of the `setsid` session leader (`start.sh`), because `start.sh` backgrounds `supervisor.sh` with `nohup … &` inside a shell without job control, so the child stays in the leader's process group. This is not achievable without editing `start.sh`, which is forbidden. It does not weaken the protection: the relevant property is that the launcher's process group and session can no longer reach the supervisor, and both are now different.

## 5. Public proof

| URL | Code | Bytes | vs staged release |
|---|---|---|---|
| `https://board.workflows.ac/health` | 200 | 46 (`{"status":"ok","version":"1.2.1","uptime":…}`) | — |
| `https://board.workflows.ac/app.js` | 200 | 417824 | `cmp` identical; `sha256 31c04a4f1c47a6d7265fb5984adaa07e5578d233d300dc2ed2bcbe2a17db3a8d` |
| `https://board.workflows.ac/` (`index.html`) | 200 | 45130 | `cmp` identical |

Compared against `/workspace/releases/board/b85676f-20261113/web/public/{app.js,index.html}`. Served bytes are byte-identical to the staged release.

## 6. Watchdog

- **Path:** `/tmp/opencode/board-supervisor/watchdog.sh` (mode 700). Outside the git repo and outside the configuration repo.
- **Log:** `/tmp/opencode/board-supervisor/watchdog.log`, one UTC-stamped line per action.
- **PID file:** `/tmp/opencode/board-supervisor/watchdog.pid`.
- **Interval:** 60 s. Every tick it reads `supervisor.pid` and tests `kill -0`. If the supervisor is gone it runs the proven start command above. The loop's own cadence is the throttle: a restart cannot happen more often than once per 60 s. It logs the outcome of each attempt (`restart ok` / `restart failed`) and never retries inside the same tick.
- **Running as:** `825993`, `SID 825993`, `PPID 1`, its own session.
- **Stop:** `kill "$(cat /tmp/opencode/board-supervisor/watchdog.pid)"`
- **Restart it:** `setsid /bin/sh /tmp/opencode/board-supervisor/watchdog.sh </dev/null >>/tmp/opencode/board-supervisor/watchdog.log 2>&1 &`
- **Self-test:** the restart path was exercised on a sandboxed copy in `/tmp/opencode/wd-test/` (stub start script, own state dir, `INTERVAL=3`) — three kills produced three logged restarts and three stub invocations. The live service was never touched. On the live instance the log contains 1 line and 0 restart actions while the supervisor is healthy, which is the intended no-op behaviour.
- **Risk accepted:** if the supervisor dies while its child still holds port 8787, the watchdog's restart will start a supervisor whose child cannot bind, and `supervisor.sh` backoff handles that. Worst case is one failed start attempt per minute, logged, and it cannot make a running service worse.

## 7. What is protected and what is not

**Protected now:** a `SIGKILL` aimed at the agent session's process group or session, and a teardown that walks the launching shell's descendant tree. The supervisor is in session `823223`, `PPID 1`, and the watchdog in session `825993`. Incident 3's mechanism — whatever killed the group the supervisor shared with the agent session — no longer reaches it.

**Still unprotected:**

- A host-wide kill (`kill -9 -1`, a cgroup-wide kill, a container stop/restart). Nothing inside the container survives that; there is no systemd unit and no cron to restart afterwards.
- A kill by PID. The watchdog only notices within 60 s, and a killer that also targets the watchdog PID, or repeats, wins.
- A machine or host reboot, or a container recreation: `start.sh` runs once from `entrypoint.sh` at boot, and the watchdog lives in `/tmp`, which does not survive recreation. Both the supervisor and the watchdog must be relaunched by hand after any restart.
- The identity of the killing actor. Still unnamed; the watchdog converts the symptom into a ≤60 s outage, it does not remove the cause.
- Whether the ingress would recover on its own is untested; recovery was observed only with a live upstream.

## 8. Observation, not a conclusion

At 15:39, while the board was dead, two unrelated processes were visible in this container: a `node --test … tests/board-supervisor.test.mjs …` suite from `/workspace/code/openchamber-config`, and a supervisor `/bin/sh /workspace/code/openchamber-config/.worktrees/lucas-dev-issue-77-skill-loading/tools/board/supervisor.sh` (`PID 814832`, `PPID 1`) which had exited by the next check. That test file contains real `SIGKILL` calls against supervisors it spawns, and it was modified at 15:23 today.

It uses a per-test `BOARD_STATE_DIR` under a temp directory and scopes its `/proc` scans to that state dir, so it is not shown to reach the live supervisor, and this is **not** evidence of who killed `703108`. It is recorded because concurrent test runs in other worktrees do start real board supervisors in this container, and because a kill path that is scoped by mistake would produce exactly this signature. Confirming or eliminating it requires a run with process accounting, which this container does not offer.
