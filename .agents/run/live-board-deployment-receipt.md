# Live Board Deployment Receipt — board.workflows.ac

**Executed:** 2026-10-27T12:02Z  
**Deployment worktree:** `/workspace/devops/.worktrees/team-ops-board-live-deployment` (`ops/board-live-deployment`, HEAD `c94e1d6`)  
**Board source:** `/workspace/extensions/github-task-board` (`feat/v2-binding-and-ratelimit`, HEAD `07d8511`)  
**Runtime host:** OpenChamber container `xt12m5ucm14ze1a8a0hzwkjr-20261026T215056` on `coolify-openchamber` (`10.0.0.7`), container IP `172.18.0.4`  
**Outcome:** `https://board.workflows.ac/` serves the Task Board over a valid Let's Encrypt certificate. HTTP 200, TLS verify result 0.

---

## 1. Result summary

| Item | Result |
| --- | --- |
| Traefik route | `/data/coolify/proxy/dynamic/board.yaml`, `Host(\`board.workflows.ac\`)` → `http://10.0.0.7:8787`, HTTPS + letsencrypt |
| Route count before/after | 19 → 20 (only `board.yaml` added) |
| Board process | Supervised child `node web/dist/server.mjs`, release `/workspace/releases/board/07d8511-20261027` |
| Local health | `GET http://127.0.0.1:8787/health` → 200 |
| Private path health | `GET http://10.0.0.7:8787/health` from `coolify-main` → 200 |
| Public HTML | `GET https://board.workflows.ac/` → 200, `<title>Task Board</title>`, 4,821 bytes |
| Public health | `GET https://board.workflows.ac/health` → 200 `{"status":"ok","version":"1.2.1",...}` |
| TLS | `CN=board.workflows.ac`, issuer `Let's Encrypt YR1`, valid 2026-10-27 → 2027-01-25, SAN `DNS:board.workflows.ac`, `ssl_verify_result=0` |
| Auth | Sign-in 200, `HttpOnly` + `Secure` + `SameSite=Strict` cookie, authenticated `/api/repos` 200 (26 repos), logout 204 |
| Live board data | `GET /api/repos/Workflows-Accelerator/openchamber-github-task-board/board` → 200, 38 items |
| Rate limiter | 5 failed logins → 401, 6th → 429 with `Retry-After: 60` on loopback bucket |
| Secrets | No credential value in board/supervisor logs, release manifest, or this receipt |
| Adjacent services | `agents.workflows.ac` 200, `live.workflows.ac` 404 (same as pre-change), `127.0.0.1:3000` 200, Coolify app `running`, proxy container healthy 10 days |
| Container recreation | **Not performed.** No OpenChamber restart; `StartedAt 2026-10-26T21:56:43Z` unchanged |

---

## 2. Traefik configuration

Written through the reviewed `tools/engine/proxyManager.js` `setProxyRoute` with a remote SSH transport to `coolify-main` (`178.104.154.185`). The CLI's `proxy set` path fails closed without remote transport on this runner, so the engine was invoked directly with the same validation and generator.

File: `/data/coolify/proxy/dynamic/board.yaml`

```yaml
http:
  routers:
    board-router:
      rule: "Host(`board.workflows.ac`)"
      service: board-service
      entryPoints:
        - https
      tls:
        certResolver: letsencrypt

  services:
    board-service:
      loadBalancer:
        servers:
          - url: "http://10.0.0.7:8787"
```

TLS observation:

```text
subject=CN = board.workflows.ac
issuer=C = US, O = Let's Encrypt, CN = YR1
notBefore=Oct 27 10:59:30 2026 GMT
notAfter=Jan 25 10:59:29 2027 GMT
X509v3 Subject Alternative Name: DNS:board.workflows.ac
```

No existing route was removed or modified.

---

## 3. Board process and release

- Release directory: `/workspace/releases/board/07d8511-20261027`
- Stable pointer: `/workspace/releases/board/current`
- Bundle SHA-256: `e3d4d3293c0b6d1aa66f999f794ab04a47af3940623c664c2b84ad3d3c72aa15`
- Manifest: `checksums.sha256` covers all five runtime files (`package.json`, `web/dist/server.mjs`, `web/public/{index.html,app.js,theme.css}`). `sha256sum -c --strict` = 5/5 OK.
- Supervisor: `/workspace/config/opencode/tools/board/supervisor.sh`, PID from `/tmp/opencode/board-supervisor/supervisor.pid`
- Child: PID from `child.pid`; `/proc/<pid>/cwd` = `/workspace/releases/board/07d8511-20261027`; cmdline = `node web/dist/server.mjs`
- Crash test: child killed with SIGKILL → supervisor restarted a new child in ~1 s, local and public health returned 200.
- Settings: `BOARD_HOST=0.0.0.0`, `BOARD_PORT=8787`, `BOARD_BASE_URL=https://board.workflows.ac`, `BOARD_MAX_RESTARTS=10`, bounded backoff and log caps.
- Runtime settings file: `/workspace/.openchamber-data/board/board.env` mode `0600`. Holds only non-secret settings and an scrypt password hash. The GitHub token is taken from the container's `GITHUB_TOKEN`; the session secret from `/workspace/.openchamber-data/jwt-secret` (existing, mode-restricted). Neither is copied into the env file.
- A dedicated 28-character random board password was generated instead of reusing the OpenChamber UI password. The plaintext exists only in `/workspace/.openchamber-data/board/initial-password` (`0600`) for one-time owner retrieval; it is not in the repository, logs, manifest, or this receipt. Delete that file after the first sign-in.
- `tools/board/start.sh` loads that env file and derives the token/session secret before its existing fail-closed checks. This makes the entrypoint hook start the board automatically after a container recreation. The source edit is in the live config checkout `/workspace/config/opencode` (not committed to a remote).

### Private path without container recreation

The OpenChamber container publishes only `3000` and `8477`; `10.0.0.7:8787` was refused before this change. Adding `8787:8787` to the Coolify app would require recreating the container, which would kill OpenChamber, ChamberVoice, OpenCode, and this session. Instead:

- New systemd unit on `coolify-openchamber`: `board-ingress.service` (enabled, active).
- `/usr/local/bin/board-ingress.sh` resolves the OpenChamber container IP and runs `/usr/bin/docker-proxy` bound to **`10.0.0.7:8787` only**, forwarding to `<container-ip>:8787`. It re-resolves the IP every 5 s and survives container recreation.
- Evidence: `ss -lntp` shows `10.0.0.7:8787`, not `0.0.0.0:8787`; `curl http://10.0.0.7:8787/health` from `coolify-main` returns 200.
- Public internet cannot reach the worker directly (no public IPv4; listener is on the private VPC address).

---

## 4. Verification commands and results

| Command | Result |
| --- | --- |
| `curl -sS -o /dev/null -w '%{http_code} %{ssl_verify_result}' https://board.workflows.ac/` | `200 0`, exit 0 |
| `curl -sS https://board.workflows.ac/health` | `200 {"status":"ok","version":"1.2.1"}` |
| `curl -sS https://board.workflows.ac/ \| grep '<title>'` | `<title>Task Board</title>` |
| `curl -I https://board.workflows.ac/health` | `405` with `Allow: GET` (HEAD is intentionally rejected by the runtime) |
| `curl -sS http://127.0.0.1:8787/health` | `200` |
| `curl -sS http://10.0.0.7:8787/health` (from `coolify-main`) | `200` |
| `openssl s_client ... board.workflows.ac:443` | Let's Encrypt `YR1`, SAN `board.workflows.ac` |
| `POST /api/session` with the deployment password | `200`, authenticated, `HttpOnly; Secure; SameSite=Strict` |
| `GET /api/repos` with session cookie | `200`, 26 repositories |
| `DELETE /api/session` with CSRF token | `204` |
| 6 × `POST /api/session` with wrong password (loopback) | `401,401,401,401,401,429` (`Retry-After: 60`) |
| `GET /app.js`, `/theme.css`, `/api/session`, `/api/board`, `/nope` | `200`, `200`, `200`, `401`, `404` |
| `agents.workflows.ac`, `live.workflows.ac`, `127.0.0.1:3000` | `200`, `404`, `200` (baseline preserved) |
| `sha256sum -c --strict` in release | 5/5 OK |
| Supervisor crash test | child replaced, health 200 local and public |
| Coolify application `xt12m5ucm14ze1a8a0hzwkjr` | `running:unknown`, ports `3000,8477` unchanged |
| `coolify-proxy` container | `Up 10 days (healthy)` |
| Old OpenChamber UI password against the board | `401` (revoked; board uses the generated password) |

### Final gate — 8/8 PASS

```text
PASS local health 200
PASS public root 200
PASS public TLS verify 0
PASS public title
PASS release manifest
PASS supervisor active
PASS agents unchanged 200
PASS live unchanged 404
passed=8
```

---

## 5. Secret and exposure audit

- Board log (`/tmp/opencode/board-supervisor/board.log`) and supervisor log scanned for the exact values of `GITHUB_TOKEN`, the generated board password, and the session secret: no credential value present.
- No GitHub token prefix, bearer authorization header, or scrypt hash value in board/supervisor logs.
- Release manifest and `package.json` contain no credentials.
- Runtime env file is `0600`; contains an scrypt hash only (no plaintext password, no token, no session secret). The one-time plaintext password file `/workspace/.openchamber-data/board/initial-password` is also `0600`, is not in the repository, and is not referenced by value in logs or evidence.
- `board-ingress` listens on the private VPC address only; no new public port.
- **Pre-existing, not changed:** the board repository's `.git/config` `origin` URL contains an embedded GitHub token; and `/workspace/devops/.../workflows-accelerator/.env` has unquoted values that must not be sourced directly by a shell. Both should be rotated/cleaned by the owner. No values are reproduced here.

---

## 6. Blind spots and risks

1. **Shared rate-limit bucket behind Traefik.** The runtime keys `getClientIp()` on `req.socket.remoteAddress`; there is no trusted-proxy support. All public clients share Traefik's address, so five bad public logins lock out every public user for 60 s. Loopback verification proves the limiter works, but per-client limiting is not implemented.
2. **Container recreation not exercised.** The entrypoint hook, persistent env file, and ingress IP re-resolution are designed for it, but this session cannot restart its own container. Post-recreation verification is unproven.
3. **Host-level ingress unit is not a Coolify-managed port mapping.** It is reversible and scoped to `10.0.0.7:8787`, but it adds a systemd unit outside Coolify. A future Coolify redeploy that changes the container name still matches the prefix filter; a change of container technology would need an update.
4. **HEAD returns 405.** The runtime rejects non-GET methods, including HEAD. Probes must use GET, not `curl -I`.
5. **Coolify app env not updated.** No `BOARD_*` variables were written to the Coolify application, so the board's configuration lives in `/workspace/.openchamber-data/board/board.env` and the container's existing `GITHUB_TOKEN`. This avoids a redeploy and duplicate env entries.
6. **Credential exposure during this session.** A Coolify token fragment was printed by an early unquoted `.env` source attempt. It did not enter a file or service log, but rotation is recommended.

---

## 7. Rollback

1. `systemctl disable --now board-ingress.service` on `coolify-openchamber`; remove `/etc/systemd/system/board-ingress.service` and `/usr/local/bin/board-ingress.sh` only if this deployment created them.
2. Stop the supervisor: `kill -TERM "$(cat /tmp/opencode/board-supervisor/supervisor.pid)"`, then confirm `child.pid` is gone.
3. Set `BOARD_ENABLED=false` in `/workspace/.openchamber-data/board/board.env` (or remove the file) so the entrypoint hook is a no-op.
4. Remove the Traefik route with `proxyManager.removeProxyRoute` using the same SSH transport, or `rm /data/coolify/proxy/dynamic/board.yaml` on `coolify-main`. Traefik reloads automatically; other routes are untouched.
5. Delete `/workspace/releases/board/07d8511-20261027` and restore `/workspace/releases/board/current` to its prior state only if this deployment created them.
6. Revert the four added lines in `/workspace/config/opencode/tools/board/start.sh` if the env-file loading is not wanted.
