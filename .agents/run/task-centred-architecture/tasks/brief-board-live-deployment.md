<env_preflight>
Repo: /workspace/devops
Worktree: /workspace/devops/.worktrees/team-ops-board-live-deployment
Branch: ops/board-live-deployment
Goal: Use devops-cockpit and tools/devops.js to configure Coolify and Traefik proxy for board.workflows.ac, ensure the board service is running, and verify https://board.workflows.ac is live and serving the task board webapp.
Commands: node tools/devops.js [command], curl probes, health checks.
Guardrails: Never log or print secret token/password values; use secret masking. Never delete other services or shared proxies.
</env_preflight>

<goal>
Configure and verify live deployment of board.workflows.ac in Coolify using the devops-cockpit playbook and tools/devops.js so that the user can open https://board.workflows.ac from their phone and interact with the live task board.
</goal>

<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/devops-board-deployment.md]
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
</context_files>

<scope>
1. Inspect the client configuration for `workflows-accelerator` under `environments/clients/workflows-accelerator/` and `tools/devops.js`.
2. Check the dynamic proxy status:
   Use `node tools/devops.js proxy list workflows-accelerator` (or equivalent proxy commands).
   Ensure a Traefik proxy rule routes `board.workflows.ac` to the OpenChamber container (private IP `10.0.0.7`, port `8787`).
   If needed, set the proxy route using `node tools/devops.js proxy set workflows-accelerator --app board --domain board.workflows.ac --private-ip 10.0.0.7 --port 8787 --allow-prod` (or the appropriate devops CLI command).
3. Ensure the board web server is running on the app container:
   The task board is at `/workspace/extensions/github-task-board`.
   Ensure `BOARD_HOST=0.0.0.0`, `BOARD_PORT=8787`, `BOARD_BASE_URL=https://board.workflows.ac` are configured.
   If credentials (BOARD_GITHUB_TOKEN, BOARD_PASSWORD, BOARD_SESSION_SECRET) need to be set or generated in Coolify/environment, configure them securely.
   Start or restart the board server (e.g. `npm run start:web` or supervisor in the background).
4. Verify HTTP and HTTPS reachability:
   - Local container loopback: `curl -I http://127.0.0.1:8787/health` -> HTTP 200
   - Local container loopback: `curl -sS http://127.0.0.1:8787/` -> HTML page containing task board title
   - Public endpoint: `curl -I https://board.workflows.ac/health`
   - Public endpoint: `curl -sS https://board.workflows.ac/` -> HTTP 200, verifying valid TLS and serving the task board webapp.
5. Conduct a hostile review of the deployment: check for secret leaks in logs, verify rate limiter is active, and ensure no other services were disrupted.
6. Record full evidence in .agents/run/live-board-deployment-receipt.md.
</scope>

<criteria>
https://board.workflows.ac responds with HTTP 200 over valid TLS and serves the live task board webapp; zero credentials leaked in logs or files.
</criteria>

<output>
At most 12 lines summarizing:
Proxy configuration status; server process status; local health check exit code; public https://board.workflows.ac probe exit code and TLS status; blind spots; next steps.
</output>
