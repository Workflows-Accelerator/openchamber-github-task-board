# Deployment Preflight & Architectural Feasibility Audit: board.workflows.ac

**Date:** 2026-10-24  
**Author:** Engineer (9router/engineer)  
**Target:** `board.workflows.ac` / Workflows Accelerator (`workflows-accelerator`)  
**Repository:** `Workflows-Accelerator/openchamber-github-task-board`  
**Host Environment:** Hetzner Cloud `nbg1` (`coolify-main` 10.0.0.2, `coolify-openchamber` 10.0.0.7)  
**Execution Invariant:** Read-Only Preflight (Zero Mutations, No Git Commits, Secrets Masked)  

---

## 1. Zero-Mutation & Safety Attestation

This preflight was conducted strictly in read-only mode in accordance with operational safety boundaries:
- **Zero mutations:** No containers created, modified, or stopped. No Traefik dynamic YAML files written or removed. No DNS records altered. No SOPS or `.env` files created or modified.
- **Root code read-only:** `/workspace/extensions/github-task-board` root application code and the `#33` worktree (`.worktrees/team-dev-issue-33-standalone-board`) were inspected without modifications or builds.
- **Secrets safety:** Zero secrets or credentials printed, logged, or exposed in shell history. Only variable names and existence statuses are reported.
- **Denylist protection:** Denylist IPs (`195.201.92.101`, `62.238.57.66`) and SSH keys (`116726501`, `116726548`) were untouched.

---

## 2. Scope 1: SOPS Vault & Secret Sourcing Audit

### 2.1 SOPS Storage & Infrastructure Findings
- **SOPS Configuration:** `/workspace/devops/.sops.yaml` is active and configures age recipient `age1ezvq7t6gml2ujq27yd5juzmdgamh06rklzmzua84vfvsqzwyx5pqscvzq4` for `.*\.env` and `.*\.env\.enc`.
- **Age Private Key:** Found at `~/.config/sops/age/keys.txt` (symlinked from `/workspace/.config/sops/age`).
- **Encrypted Filesystem Audit:** Across the entire filesystem, the only `.env.enc` file under DevOps control is `/workspace/devops/environments/clients/acme-test/.env.enc`.
- **Client `workflows-accelerator` Status:** The directory `/workspace/devops/environments/clients/workflows-accelerator/` contains a plaintext `.env` and `.env.example`. **No `.env.enc` exists for `workflows-accelerator`.**

### 2.2 Variable Name Audit (Names & Presence Only)
In `/workspace/devops/environments/clients/workflows-accelerator/.env`, the only configured keys are:
- `HCLOUD_TOKEN` (Present)
- `COOLIFY_TOKEN` (Present)
- `S3_ACCESS_KEY` (Present)
- `S3_SECRET_KEY` (Present)
- `S3_BUCKET` (Present)
- `SSH_PRIVATE_KEY` (Present)
- `SSH_PUBLIC_KEY` (Present)
- `SPACESHIP_API_KEY` (Present)
- `SPACESHIP_API_SECRET` (Present)

### 2.3 Standalone Board Variable Status
Evaluating requirements against `web/server/config.ts` (#33 worktree):
| Variable Name | Required | Status in SOPS (`.env.enc`) | Status in DevOps (`.env`) | Alternative Usable Source in Container |
| :--- | :--- | :--- | :--- | :--- |
| `BOARD_GITHUB_TOKEN` | Yes | **ABSENT** | **ABSENT** | `GITHUB_TOKEN` present in container `process.env` (permissions unverified) |
| `BOARD_GITHUB_LOGIN` | Yes (Code) | **ABSENT** | **ABSENT** | Unset (Code in `#33` requires validation unless patched; owner chose password-only) |
| `BOARD_REPO` | Yes | **ABSENT** | **ABSENT** | Known constant: `Workflows-Accelerator/openchamber-github-task-board` |
| `BOARD_PASSWORD_HASH` / `BOARD_PASSWORD` | Yes | **ABSENT** | **ABSENT** | `OPENCHAMBER_UI_PASSWORD` present in container `process.env` (if shared) |
| `BOARD_SESSION_SECRET` | Yes | **ABSENT** | **ABSENT** | `/workspace/.openchamber-data/jwt-secret` exists (can derive or generate 32+ char secret) |
| `BOARD_PORT` | Optional | N/A | N/A | Defaults to `8787` |
| `BOARD_BASE_URL` | Optional | N/A | N/A | Expected: `https://board.workflows.ac` |
| `BOARD_TRUST_PROXY` | Optional | N/A | N/A | Defaults to `false` (Must remain false unless proxy verified) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | No (Spike) | **ABSENT** | **ABSENT** | Unprovisioned (Web push out of scope for initial deployment) |

**Empirical Reality vs Owner Premise:**  
The owner's assumption that board secrets are "already in SOPS" is **FALSE** in the repository. No board credentials exist in SOPS ciphertext or DevOps client env. Sourcing must either adopt container fallbacks (`GITHUB_TOKEN`, `OPENCHAMBER_UI_PASSWORD`, generated `BOARD_SESSION_SECRET`) or require explicit owner provisioning before deployment.

---

## 3. Scope 2: Process Supervision & Lifecycle Analysis

### 3.1 How `live.workflows.ac` (`chambervoice`) Actually Runs
- `chambervoice` (`PID 7879`) is NOT supervised by systemd, pm2, or supervisord (none of which run in the container; PID 1 is `/usr/bin/tini`).
- `chambervoice` is registered in `/workspace/.openchamber-data/extensions.json` and spawned by OpenChamber (`PID 48`, `/usr/local/bin/openchamber serve`).
- OpenChamber's internal guest service manager (`packages/web/server/lib/guests/service.js`) spawns guest services **on-demand** upon receiving an authenticated API request (`POST /api/guests/:id/service/request` or UI open).
- OpenChamber allocates a random loopback port (`OPENCHAMBER_SERVICE_PORT`) and proxies requests internally. ChamberVoice additionally opens an external socket on `0.0.0.0:8477` via its own internal configuration.

### 3.2 Failure Modes: Standalone Board under OpenChamber
If the standalone board (`web/server.ts`) is executed inside the OpenChamber container:
1. **Process Crash:**
   - Traefik forwards requests from `coolify-main` (`10.0.0.2`) directly to worker port `8787` (`http://10.0.0.7:8787`), completely bypassing OpenChamber's port 3000.
   - Because OpenChamber is not on the request path, OpenChamber NEVER detects the incoming traffic and will NEVER restart the crashed board process. The board remains down indefinitely until manual intervention.
2. **Container Recreation (Coolify Redeploy / Update):**
   - The entire container filesystem and process table reset.
   - Any background process started manually is terminated.
   - `entrypoint.sh` executes `/workspace/config/opencode/entrypoint.sh`. It auto-updates, sets credentials, starts `keepalive-proxy`, and launches OpenChamber. **It does not launch the board.**
   - Without modifying `entrypoint.sh` or OpenChamber configuration, the board will NOT start after container recreation.
3. **Full Host Reboot:**
   - Docker daemon restarts the OpenChamber container.
   - Same outcome as container recreation: the board process is absent.

### 3.3 Minimal Persistent Launch & Real Owner Fork
OpenChamber config cannot be modified per constraints. Therefore, there is NO existing supervisor in the OpenChamber container capable of providing unattended persistent execution and auto-restart for the standalone board.

**The Real Owner Fork:**
- **Fork A (Dedicated Coolify Application - Option 1):** Deploy `openchamber-github-task-board` as an independent Coolify Docker service on `coolify-openchamber`. Docker daemon handles supervision, crash restart policies (`restart: unless-stopped`), port isolation, and zero-impact lifecycle independent of OpenChamber.
- **Fork B (Container Entrypoint Hook - Option 2 Variant):** Add a persistent start hook in `/workspace/config/opencode/entrypoint.sh` (or a dedicated wrapper script in `opencode-config`) alongside `keepalive-proxy`. *Requires owner approval to edit `opencode-config`.*
- **Fork C (Host-Level Systemd Unit):** Run the board as a systemd service directly on the host worker `coolify-openchamber` (`10.0.0.7`). Provides full systemd auto-restart and journal logging without container dependencies.

---

## 4. Scope 3: Network Path & Docker Port-Publication Verification

### 4.1 Physical & Network Topology
- Ingress: Public DNS `board.workflows.ac` resolves to Primary IP `178.104.154.185` (`coolify-main`).
- Traefik Proxy: Listens on ports 80/443 on `coolify-main` (`10.0.0.2`).
- Target Worker: `coolify-openchamber` has private VPC IP `10.0.0.7` (no public IP). Traefik proxies requests across Hetzner VPC `10.0.0.0/16`.

### 4.2 The Bridged Container Reachability Fallacy
- OpenChamber container (`xt12m5ucm14ze1a8a0hzwkjr`) runs in **Docker bridge mode**, not host mode.
- Coolify application configuration explicitly binds:
  - `ports_mappings`: `3000:3000,8477:8477`
  - `ports_exposes`: `3000,8477`
- When a process inside the container listens on `0.0.0.0:8787`, **that port is confined to the container's private bridge network**.
- It is **NOT** reachable at the worker host IP `http://10.0.0.7:8787` because Docker has not established an iptables port forwarding rule (`-p 8787:8787`).
- When Traefik connects to `http://10.0.0.7:8787`, the packet reaches host `10.0.0.7`. Because no host process or Docker proxy listens on port 8787 on the host, the Linux kernel rejects the packet (`TCP RST` / Connection Refused).

### 4.3 Container Recreation & Service Interruption
- Docker bridge port mappings CANNOT be added dynamically to a running container.
- To publish `8787:8787`, Coolify MUST update the application schema and **RECREATE the OpenChamber container**.
- Container recreation **terminates PID 1** (`tini`), killing OpenChamber (`agents.workflows.ac`), ChamberVoice (`live.workflows.ac`), OpenCode runner, and active terminal sessions.
- **Downtime is NOT zero seconds.** Deploying inside the existing container forces an outage across all existing services running in `xt12m5ucm14ze1a8a0hzwkjr`.

---

## 5. Scope 4: Corrections to Previous Report (`devops-board-deployment.md`)

1. **`BOARD_TRUST_PROXY=true` Flaw:**  
   - *Previous report:* Recommended `BOARD_TRUST_PROXY: true` to parse `X-Forwarded-For`.
   - *Correction:* Setting `BOARD_TRUST_PROXY=true` unconditionally allows any client who can craft an `X-Forwarded-For` header to spoof their IP, bypassing the sliding-window login rate limiter (`MAX_ATTEMPTS = 5` per IP). Direct requests or untrusted proxy hops can forge client identities.  
   - *Requirement:* Default to `BOARD_TRUST_PROXY=false`. If enabled, trust must be restricted strictly to verified requests originating from Traefik gateway `10.0.0.2`.
2. **Duplicate Conflicting Routers:**  
   - *Previous report:* Proposed adding dynamic route `/data/coolify/proxy/dynamic/board.yaml` AND updating Coolify application domains to include `https://board.workflows.ac:8787`.
   - *Correction:* Doing both creates two competing Traefik routers for `Host('board.workflows.ac')`—one from Coolify Docker labels and one from the dynamic file provider. This risks ACME challenge failures, race conditions, and nondeterministic proxy behavior. Choose exactly ONE mechanism.
3. **Zero Downtime Claim:**  
   - *Previous report:* Claimed 0 seconds downtime.
   - *Correction:* Refuted. Publishing port 8787 requires recreating the OpenChamber container, causing service downtime on `agents.workflows.ac` and `live.workflows.ac`.
4. **Automatic TLS Certificate Issuance:**  
   - *Previous report:* Assumed automatic certificate generation on first request.
   - *Correction:* Traefik currently serves `CN = TRAEFIK DEFAULT CERT` and returns HTTP 503. Let's Encrypt issuance is not guaranteed until Traefik can route ACME HTTP-01 challenges to a reachable backend. Issuance must be validated empirically during staging, not assumed.
5. **Health Endpoint Verification:**  
   - *Previous report:* Listed `/api/session` and `/` as health endpoints.
   - *Correction:* Audited `web/server/app.ts`. There is NO `/health` endpoint implemented in `#33`. `GET /api/session` returns `HTTP 200 { authenticated: false }`, which functions as a session probe but does not perform internal subsystem health checks.

---

## 6. Scope 5: Concrete Go/No-Go Checklist & Owner Gates

| Gate # | Check Description | Current Status | Blocker / Action Required | Owner Gate? |
| :--- | :--- | :--- | :--- | :--- |
| **G1** | **Code Bind Configuration (`BOARD_HOST`)** | **FAIL** | `web/server/app.ts:801` hardcodes `'127.0.0.1'`. Must support `BOARD_HOST` (e.g. `0.0.0.0`). | Dev Patch |
| **G2** | **Code Auth Alignment (`BOARD_GITHUB_LOGIN`)** | **FAIL** | Code requires `BOARD_GITHUB_LOGIN`. Owner decided password-only sign-in. Either provide dummy login or patch code. | Dev/Owner |
| **G3** | **Secret Provisioning (`BOARD_GITHUB_TOKEN`)** | **FAIL** | Absent in SOPS. Must decide: use existing container `GITHUB_TOKEN` or supply dedicated fine-grained PAT. | **OWNER GO** |
| **G4** | **Secret Provisioning (`BOARD_PASSWORD`)** | **FAIL** | Absent in SOPS. Must decide: generate random password, use `OPENCHAMBER_UI_PASSWORD`, or owner supplies. | **OWNER GO** |
| **G5** | **Secret Provisioning (`BOARD_SESSION_SECRET`)** | **FAIL** | Absent in SOPS. Must generate $\ge 32$-char secret or derive from `/workspace/.openchamber-data/jwt-secret`. | Auto / Safe |
| **G6** | **Supervisor & Persistence Decision** | **FAIL** | No supervisor in OpenChamber container. Must choose Fork A (Coolify App), Fork B (Entrypoint edit), or Fork C (Host Systemd). | **OWNER GO** |
| **G7** | **Network Reachability & Downtime Approval** | **FAIL** | Port 8787 requires container recreation. Owner must approve downtime for `agents` and `live`. | **OWNER GO** |
| **G8** | **Proxy Routing Architecture Selection** | **READY** | Dynamic Traefik YAML `/data/coolify/proxy/dynamic/board.yaml` on `coolify-main` is ready to configure once port is open. | Automated |
| **G9** | **Bounded Rollback Procedure** | **READY** | Stopping board process/deleting `board.yaml` leaves OpenChamber and `live.workflows.ac` completely intact. | Automated |

---

## 7. Bounded Rollback Procedure

To ensure the board deployment can be aborted or rolled back without collateral impact:
1. **Dynamic Proxy Deactivation:**  
   Delete `/data/coolify/proxy/dynamic/board.yaml` on `coolify-main`. Traefik dynamic reloader unloads the route in $<1$ second; DNS wildcard remains intact; `live` and `agents` remain unaffected.
2. **Board Process Termination:**  
   Kill the board process PID (`kill <board_pid>`). Does not disrupt OpenChamber (`PID 48`) or ChamberVoice (`PID 7879`).
3. **Container State Reversion (if container was modified):**  
   If Coolify application `xt12m5ucm14ze1a8a0hzwkjr` was altered to publish 8787, revert `ports_mappings` to `3000:3000,8477:8477` and `ports_exposes` to `3000,8477`. *Note: this requires another container recreation.*

---

## 8. Command Ledger (Read-Only Audit Trail)

1. `glob /workspace **/*.{enc,enc.*,sops.yaml}` $\rightarrow$ Zero results in root workspace.
2. `read /workspace/devops/.sops.yaml` $\rightarrow$ Verified age recipient configuration.
3. `read /workspace/devops/tools/engine/vaultManager.js` $\rightarrow$ Audited safe vault inspection methods.
4. `read /workspace/devops/environments/clients/workflows-accelerator/config.yml` $\rightarrow$ Inspected target services and topology.
5. `ls -la ~/.config/sops/age/` $\rightarrow$ Verified presence of age private keys.
6. `find /workspace /root /home -name "*.enc" -o -name ".sops.yaml"` $\rightarrow$ Located `acme-test/.env.enc`.
7. `node -e '...inspect keys in workflows-accelerator/.env...'` $\rightarrow$ Verified key names only, zero board secrets.
8. `node -e '...vaultManager.listKeys(acme-test)...'` $\rightarrow$ Verified key names only in `acme-test`.
9. `read /workspace/config/opencode/entrypoint.sh` $\rightarrow$ Verified container entrypoint execution chain.
10. `grep /workspace "chambervoice/service|8477"` $\rightarrow$ Traced ChamberVoice port and launch mechanisms.
11. `ps -ef` $\rightarrow$ Captured live container process hierarchy (`tini` PID 1, `openchamber` PID 48, `chambervoice` PID 7879).
12. `read /workspace/.openchamber-data/extensions.json` $\rightarrow$ Verified extension registration for `chambervoice` and `github-task-board`.
13. `read /workspace/.openchamber-data/guest-services/7879.json` $\rightarrow$ Proved ChamberVoice guest service lifecycle under OpenChamber PID 48.
14. `read /usr/local/lib/node_modules/@openchamber/web/server/lib/guests/DOCUMENTATION.md` $\rightarrow$ Audited guest service on-demand lifecycle and crash recovery semantics.
15. `read /workspace/devops/.agents/run/workflows-accelerator-onboarding/step2-report.md` $\rightarrow$ Proved container bridge mode with explicit `3000:3000,8477:8477` port mappings.
16. `read /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/server/config.ts` $\rightarrow$ Audited required environment variable names and validation constraints.
