# Wave 7 — deploy mechanics against the live environment

Verified 2026-11-14 21:50–22:05 UTC. **Nothing was deployed, killed, restarted, or
written outside this directory.** Every protected path was inspected read-only;
no env file, token or secret was read.

Claim under test: `../wave7-release-candidate/README.md`, section *Deploy* (lines
70–101) and section *Rollback* (lines 103–120).

Method: read the receipt, then check every path, binary and pid it touches against
the live container, then dry-run the whole sequence in `/tmp/opencode/w7dm/` up to
(not including) the cutover, kill and start.

---

## 1. Verdict summary

**RECEIPT_NEEDS_FIX.** Three independent defects, one of them a guaranteed outage:

1. **The wait loop hangs forever after a successful `kill -TERM`** — deterministic,
   not a race. The deploy dies between "board stopped" and "board restarted".
2. **The build compiles the wrong source tree** — `cd "$REPO"` builds the main
   checkout (`ops/task-board-activation`, `72a767f`), not `422b3a0`. Dry run
   produced `c23898a6…`, 167 352 bytes, instead of the verified `89d4b289…`,
   300 895 bytes.
3. **`start.sh` is invoked in the caller's session** — it re-creates exactly the
   killable process-group exposure that the board-down incidents 1–3 fixed with
   `setsid`.

---

## 2. Live environment facts

| Object | State | Evidence |
|---|---|---|
| `/workspace/releases` | present, `drwxr-xr-x root:root` | `stat -c '%A %U:%G %n'` |
| `/workspace/releases/board` | present, `drwxr-xr-x root:root`, **writable** (process is root, uid 0) | `stat`, `test -w` → WRITABLE |
| `/workspace/releases/board/current` | symlink → `/workspace/releases/board/b85676f-20261113` | `readlink` |
| `b85676f-20261113/` | present: `package.json`, `checksums.sha256`, `web/dist/server.mjs`, 11 files in `web/public/` | `find . -type f` |
| `b85676f-20261113/checksums.sha256` | present, 13 entries, **verifies clean** | `cd $PREV && sha256sum -c --strict checksums.sha256` → all OK, rc 0 |
| `422b3a0-20261114/` (deploy target) | **absent** — `mkdir -p` will create it | directory listing |
| `/workspace/code/openchamber-config/tools/board/start.sh` | present, sha256 `8d912b52…d91cbfeb` | `sha256sum` |
| `/workspace/code/openchamber-config/tools/board/supervisor.sh` | present | `test -f` |
| `/tmp/opencode/board-supervisor/supervisor.pid` | present, contains `73`, **alive** | `cat` (pid only), `/proc/73` |
| `/tmp/opencode/board-supervisor/child.pid` | present, contains `111`, alive | `/proc/111` |
| `/tmp/opencode/board-supervisor/supervisor.lock` | present, contains `73`, **flock held** | `flock -n … -c 'echo FREE'` → HELD |
| `/workspace/.openchamber-data/board/board.env` | present, `-rw------- root:root` 649 B, mtime 2026-11-13 (contents not read) | `test -f`, `stat` |
| `/workspace/.openchamber-data/jwt-secret` | present and readable (contents not read) | `test -r` |
| Board port | **8787**, listening on `0.0.0.0` | `/proc/net/tcp` state `0A`; `web/server/config.ts:17 DEFAULT_PORT = 8787`; `board.log` |
| `/health` | `200 {"status":"ok","version":"1.2.1","uptime":22870}` on loopback **and** `https://board.workflows.ac` | `curl -fsS -m 5` |
| `node` / `npx` | v22.23.5, `/usr/local/bin` | `command -v` |
| `esbuild` | 0.25.12, resolves from `$REPO` **through a symlink borrowed from another project** (see §7) | `node_modules/.bin/esbuild --version` |
| `flock` | `/usr/bin/flock` | `command -v` |
| `ss` | **not installed** (`ss: command not found`); used `/proc/net/tcp` instead | — |
| systemd | absent (`/run/systemd/system` missing) | `test -d` |
| cron | no crontab, no board entry in `/etc/cron.d` | `crontab -l`, `ls /etc/cron.d` |
| `/workspace` disk | **99 % full, 1.2 G free** | `df -h` |

### What `start.sh` actually does

Read in full (279 lines). It is a *gate-then-daemonise* launcher, not a server:

- **Env file:** sources `/workspace/.openchamber-data/board/board.env` **only** when
  `BOARD_ENV_FILE` is unset *and* `BOARD_STATE_DIR` is unset or equal to the
  default `/tmp/opencode/board-supervisor` (lines 17–30). A deploy shell satisfies
  both, so it sources it. It never overwrites an already-set variable.
- **Token:** `BOARD_GITHUB_TOKEN` falls back to `$GITHUB_TOKEN` from the *calling
  shell* (line 51); `BOARD_SESSION_SECRET` falls back to
  `/workspace/.openchamber-data/jwt-secret` (lines 53–56).
- **Port:** it does not set a port. The port comes from the release's own config
  (`DEFAULT_PORT = 8787`, `BOARD_PORT` override).
- **Artifact path:** `BOARD_RELEASE_DIR`, default `/workspace/releases/board/current`.
- **Daemonises:** yes — `nohup /bin/sh supervisor.sh </dev/null >>supervisor.log 2>&1 &`
  (line 252), then polls up to ~1 s for the pid file and exits.
- **Pid file:** written by `supervisor.sh`, not by `start.sh`
  (`supervisor.pid` = the supervisor's own `$$`, line 248; `child.pid` = the node
  child, line 321).
- **Fails loudly when the artifact is missing:** **no.** Every refusal goes through
  `skip()`, which prints one line and **`exit 0`** (lines 59–62, 71–81, 100–102).
  Missing release, missing `server.mjs`, bad checksums, missing `BOARD_ENABLED`,
  missing token — all exit 0. `set -e` in the deploy cannot detect a failed start;
  only the trailing `curl` can.

---

## 3. Real supervision model

```
pid 1   tini -- openchamber serve --port 3000        (container entrypoint)
 └─ entrypoint.sh lines 82–88: start.sh || true
     └─ pid 73  /bin/sh /workspace/config/opencode/tools/board/supervisor.sh
                PPid 1 (reparented), PGID 1, SID 1, flock held on supervisor.lock
         └─ pid 111  node web/dist/server.mjs
                     cwd /workspace/releases/board/b85676f-20261113, LISTEN 0.0.0.0:8787
```

- The board **is** supervised, and the supervisor **is** alive right now
  (`supervisor.log`: `Child process started with PID 111`, then
  `Child healthy for sustained period (30s >= 30s)`).
- `supervisor.sh` has a real watchdog loop for the **child**: crash restart with
  exponential backoff and jitter, `BOARD_MAX_RESTARTS` (default 10),
  `BOARD_SUSTAINED_HEALTH_SECS` (30 s) resets the allowance, log rotation.
  It also `cd`s into the release directory **once** (line 303), so a symlink swap
  requires a supervisor restart — which the receipt does.
- It is **not** systemd, **not** cron, **not** a bare process. It was started by
  the container entrypoint into tini's session (hence `SID 1`), at 15:33 UTC today
  — consistent with the container having been recreated recently.
- **The external watchdog is gone.** `incident-3.md` installed
  `/tmp/opencode/board-supervisor/watchdog.sh` + `watchdog.pid` + `watchdog.log`
  to re-run `start.sh` every 60 s. The state directory now contains only
  `board.log`, `board.log`/`supervisor.log`, `child.pid`, `supervisor.pid`,
  `supervisor.lock` — **no watchdog script, no watchdog pid, no watchdog process**
  (`ps -eo pid,ppid,cmd | grep -i watchdog` → empty). `/tmp` was wiped by the
  container recreation.
- Consequence: **nothing restarts `supervisor.sh` if it exits** (SIGKILL, kill by
  PID, `MAX_RESTARTS` exhausted) short of a container restart. The child is
  watched; the supervisor is not.

**Would the receipt's `kill -TERM $(cat supervisor.pid)` + `start.sh` restart the
board?** The kill/start pair would — `handle_signal` forwards TERM to the child,
waits ≤5 s, SIGKILLs if needed, reaps, removes both pid files, releases the lock,
exits 0; `start.sh` then takes the free lock and relaunches. But the receipt
**never reaches `start.sh`**, because of the wait loop in §4. Net effect: the
board is stopped and the deploy hangs.

---

## 4. Command-by-command verdicts

### Deploy (receipt lines 77–101)

| # | Command | Verdict | Why |
|---|---|---|---|
| 1 | `mkdir -p "$REL/web/dist" "$REL/web/public"` | **works** | `/workspace/releases/board` writable, root, 1.2 G free |
| 2 | `git -C "$REPO" archive 422b3a0 package.json \| tar -x -C "$REL"` | **works** | `git cat-file -t 422b3a0` → commit; `package.json` present at that commit |
| 3 | `git -C "$REPO" archive 422b3a0 web/public \| tar -x -C "$REL"` | **works** | 13 files, no subdirectories |
| 4 | `cd "$REPO"; npx esbuild web/server.ts …` | **FAILS** | builds the **main working tree** (`72a767f`), not `422b3a0`. Dry run: `c23898a6c614753b837ebc27398e4cf3b8788f59ccfafca0b9041a852d74fc2c`, 167 352 B. Expected `89d4b289…d604b7`, 300 895 B. `web/server/app.ts` is 1678 lines at `HEAD` vs 3366 at `422b3a0`. The resulting release would be checksum-clean and silently wrong. |
| 5 | `sha256sum package.json web/dist/server.mjs web/public/* > checksums.sha256` | **works** | glob is non-recursive but `web/public` has **0 subdirectories** at `422b3a0` (13 flat files). Would break the moment a subdirectory is added. |
| 6 | `sha256sum -c --strict checksums.sha256` | **works** | 15 entries, 16 files in release (`checksums.sha256` excluded), rc 0 |
| 7 | `readlink -f /workspace/releases/board/current` | **works** | → `b85676f-20261113` |
| 8 | `ln -sfn "$REL" current.tmp` + `mv -Tf current.tmp current` | **works** | same filesystem (`/workspace/releases/board`), so `mv -Tf` is a single atomic `rename(2)`; `current` is a symlink, replaced atomically |
| 9 | `kill -TERM "$(cat …/supervisor.pid)"` | **works today, fragile** | pid file holds `73`, alive, lock held. If the supervisor had died by SIGKILL (as in incidents 1–3) the file is stale → `kill: no such process` → `set -e` aborts **after** the symlink swap. |
| 10 | `while kill -0 "$(cat … \|\| echo 0)" 2>/dev/null; do sleep 0.2; done` | **FAILS — infinite loop** | `handle_signal` does `rm -f "$PID_FILE"` (supervisor.sh:237). `cat` then fails, `\|\| echo 0` yields `0`, and `kill -0 0` means "signal 0 to my own process group" → **always succeeds**. Verified: `kill -0 0` → SUCCESS. The loop can never terminate. |
| 11 | `/workspace/code/openchamber-config/tools/board/start.sh` | **works, unsafe** | never reached because of #10; when reached it daemonises correctly, but (a) exits 0 on every failure, (b) `nohup` does not `setsid`, so the new supervisor inherits the deploy shell's session/process group — the exact exposure incident-3 fixed |
| 12 | `curl -fsS http://127.0.0.1:8787/health` | **works** | port matches (`DEFAULT_PORT 8787`), returns 200 |
| 13 | `curl -fsS https://board.workflows.ac/health` | **works** | 200, same body |

### Rollback (receipt lines 107–117)

| # | Command | Verdict | Why |
|---|---|---|---|
| 1 | `cd "$PREV" && sha256sum -c --strict checksums.sha256` | **works** | 13/13 OK, rc 0 |
| 2 | `ln -sfn` + `mv -Tf` | **works** | as deploy #8 |
| 3 | `kill -TERM "$(cat …/supervisor.pid)"` | **works today, fragile** | as deploy #9 |
| 4 | wait loop | **FAILS — same infinite loop** | identical construct (line 114) |
| 5 | `start.sh` | **works, unsafe** | as deploy #11 |
| 6 | `curl …:8787/health` | **works** | — |

The rollback *description* ("symlink swap plus supervisor restart") is correct;
only the wait loop and the session inheritance are wrong.

---

## 5. Artifact reproducibility (checklist item 5)

The receipt's build recipe is **correct and reproducible**; only the source tree it
is pointed at is wrong.

| Build | Command | Result |
|---|---|---|
| Receipt flags on a clean `422b3a0` extract | `esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external` (esbuild 0.25.12) | `89d4b289f2555f9e1437f043ebf02d820b8817da0acf88d8903add4b27d604b7`, 300 895 B — **matches the receipt byte for byte** |
| Same flags, `cd $REPO` (main working tree `72a767f`) | identical | `c23898a6…d74fc2c`, 167 352 B — **what the receipt would actually ship** |
| Worktree `web/dist/server.mjs` at `add4855` | already built | `89d4b289…d604b7`, 300 895 B — matches the `422b3a0` build |

No flag, target or `--packages=external` difference exists. `web/dist/server.mjs`
is gitignored (`web/.gitignore:1:dist/`) and not tracked at `422b3a0`.

---

## 6. Corrected sequences

Dry-run verified in `/tmp/opencode/w7dm/` up to the cutover: archive extraction,
build, manifest, `sha256sum -c --strict`, and `start.sh`'s own manifest-coverage
logic (`comm -13` → empty). Only the cutover, kill and start lines are unexecuted.

### Corrected deploy

```bash
set -euo pipefail
REPO=/workspace/code/openchamber-github-task-board
SHA=422b3a0
REL=/workspace/releases/board/${SHA}-20261114
STATE=/tmp/opencode/board-supervisor
ESBUILD="$REPO/node_modules/.bin/esbuild"
EXPECT=89d4b289f2555f9e1437f043ebf02d820b8817da0acf88d8903add4b27d604b7
BUILD=$(mktemp -d /tmp/opencode/board-build.XXXXXX)

# 1. source tree = exactly the commit under test (not the repo working tree)
git -C "$REPO" archive "$SHA" | tar -x -C "$BUILD"

# 2. build from that tree
mkdir -p "$REL/web/dist" "$REL/web/public"
( cd "$BUILD" && "$ESBUILD" web/server.ts --bundle --platform=node \
    --format=esm --target=node20 --packages=external \
    --outfile="$REL/web/dist/server.mjs" )
cp "$BUILD/package.json" "$REL/package.json"
cp -a "$BUILD/web/public/." "$REL/web/public/"

# 3. manifest, verify, and prove provenance
( cd "$REL" && sha256sum package.json web/dist/server.mjs web/public/* > checksums.sha256 \
  && sha256sum -c --strict checksums.sha256 )
[ "$(sha256sum "$REL/web/dist/server.mjs" | cut -d' ' -f1)" = "$EXPECT" ] \
  || { echo "artifact is not $SHA — aborting before cutover"; exit 1; }

# 4. record rollback target before the swap
readlink -f /workspace/releases/board/current   # expect b85676f-20261113

# 5. cutover (atomic rename, same filesystem)
ln -sfn "$REL" /workspace/releases/board/current.tmp
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current

# 6. stop the supervisor and wait for the LOCK, not for the pid file
if [ -f "$STATE/supervisor.pid" ]; then
  SUP=$(cat "$STATE/supervisor.pid")
  kill -TERM "$SUP" 2>/dev/null || true          # stale pid must not abort the deploy
  for i in $(seq 1 100); do
    flock -n "$STATE/supervisor.lock" -c true 2>/dev/null && break
    sleep 0.2
  done
  flock -n "$STATE/supervisor.lock" -c true 2>/dev/null \
    || { echo "supervisor still holds the lock"; exit 1; }
fi
# 6b. wait for the port to be released (old child may outlive a SIGKILLed supervisor)
for i in $(seq 1 50); do
  curl -fsS -m 1 http://127.0.0.1:8787/health >/dev/null 2>&1 || break
  sleep 0.2
done

# 7. relaunch DETACHED — outside this shell's session (incident-3 hardening)
setsid /bin/sh /workspace/code/openchamber-config/tools/board/start.sh \
  </dev/null >>"$STATE/supervisor.log" 2>&1

# 8. prove, and fail hard if the board did not come back
for i in $(seq 1 30); do
  curl -fsS -m 3 http://127.0.0.1:8787/health && break
  sleep 1
done
curl -fsS -m 5 http://127.0.0.1:8787/health
curl -fsS -m 8 https://board.workflows.ac/health
```

### Corrected rollback

```bash
set -euo pipefail
PREV=/workspace/releases/board/b85676f-20261113
STATE=/tmp/opencode/board-supervisor

( cd "$PREV" && sha256sum -c --strict checksums.sha256 )
ln -sfn "$PREV" /workspace/releases/board/current.tmp
mv -Tf /workspace/releases/board/current.tmp /workspace/releases/board/current

if [ -f "$STATE/supervisor.pid" ]; then
  SUP=$(cat "$STATE/supervisor.pid")
  kill -TERM "$SUP" 2>/dev/null || true
  for i in $(seq 1 100); do
    flock -n "$STATE/supervisor.lock" -c true 2>/dev/null && break
    sleep 0.2
  done
  flock -n "$STATE/supervisor.lock" -c true 2>/dev/null \
    || { echo "supervisor still holds the lock"; exit 1; }
fi
for i in $(seq 1 50); do
  curl -fsS -m 1 http://127.0.0.1:8787/health >/dev/null 2>&1 || break
  sleep 0.2
done

setsid /bin/sh /workspace/code/openchamber-config/tools/board/start.sh \
  </dev/null >>"$STATE/supervisor.log" 2>&1

for i in $(seq 1 30); do
  curl -fsS -m 3 http://127.0.0.1:8787/health && break
  sleep 1
done
curl -fsS -m 5 http://127.0.0.1:8787/health
```

Two behavioural changes worth naming: the wait is on the **flock**, which is the
authoritative ownership signal (`supervisor.sh` never releases it except by
exiting, and a dead process cannot hold it), and the launch is under **`setsid`**,
so the supervisor lands in its own session instead of the deploy shell's.

---

## 7. Residual risks a deploy would still carry

1. **No supervisor watchdog.** The incident-3 watchdog is gone with `/tmp`. If the
   supervisor exits after the deploy (SIGKILL, kill by PID, 10 consecutive child
   crashes), the board stays down until a container restart or a manual
   `start.sh`. Reinstall it before or right after the deploy:
   `setsid /bin/sh /tmp/opencode/board-supervisor/watchdog.sh </dev/null >>/tmp/opencode/board-supervisor/watchdog.log 2>&1 &`
   (the script itself no longer exists and must be recreated).
2. **`start.sh` cannot fail the deploy.** Every refusal is `exit 0`. A missing
   `BOARD_ENABLED`, missing token, or bad checksums leaves the board down while
   the deploy script believes it succeeded. Only the `curl` proves anything —
   keep it and keep the retry loop.
3. **Token source.** `start.sh` needs `BOARD_GITHUB_TOKEN` from `board.env` or
   `$GITHUB_TOKEN` from the calling shell. This session has `GITHUB_TOKEN` set, so
   a deploy from here works; a deploy from a bare `sh -c` without it would
   silently skip the start. Not verified: whether `board.env` itself carries
   `BOARD_GITHUB_TOKEN` (contents were not read).
4. **`npx esbuild` is borrowed from another project.**
   `$REPO/node_modules/.bin` is a symlink to
   `/workspace/extensions/chambervoice/node_modules/.bin` →
   `/workspace/code/chambervoice/node_modules/.bin`, and `esbuild` is not declared
   in the board's `package.json` (no `dependencies`, no `devDependencies`). The
   build works today only because chambervoice's `node_modules` exists. The
   approved workspace plan moves `extensions/chambervoice` → `code/chambervoice`;
   a reinstall or removal there breaks the board build. Pin esbuild in the board
   project before relying on it.
5. **`/tmp` state is ephemeral.** `supervisor.pid`, `child.pid`, logs and the lock
   live under `/tmp/opencode/board-supervisor`. A container recreation wipes them
   and the pid file is then stale; `start.sh` handles the stale case, but any
   tooling that reads the pid file directly (including the receipt) does not.
6. **`web/public/*` is non-recursive.** Safe today (0 subdirectories at
   `422b3a0`). Adding one subdirectory makes `sha256sum` fail and, with `set -e`,
   aborts the deploy — and would also make `start.sh`'s coverage check refuse the
   release.
7. **Kill by PID / host-wide kill.** `setsid` protects against a process-group or
   session kill only. A killer that targets the supervisor pid, or a host-wide
   kill, still wins. The watchdog only narrows the window to ≤60 s.
8. **Disk.** `/workspace` is 99 % full (1.2 G free). One 350 KB release is fine;
   nothing else large should be written.
9. **Provenance label.** Even corrected, the release directory is named after the
   commit; the receipt's version is `422b3a0-20261114`. If the final published
   commit differs, rename the directory and re-check the expected sha.

---

## 8. Not verified

- No cutover, no `kill`, no `start.sh` execution — by instruction.
- End-to-end restart behaviour (supervisor TERM → child reaped → lock released →
  `start.sh` relaunch) is established from the code paths and the live process
  state, not by running it.
- Contents of `board.env`, `jwt-secret`, tokens, cookies — never read.
- Whether the live image's `entrypoint.sh` is byte-identical to
  `/workspace/code/openchamber-config/entrypoint.sh`; the running process tree is
  consistent with it, but the image copy was not inspected.
- Authenticated board behaviour after a deploy.
