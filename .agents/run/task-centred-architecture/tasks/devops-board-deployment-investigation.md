<env_preflight>
Repo context: /workspace/extensions/github-task-board (board server lives on branch feat/issue-33-standalone-board, worktree .worktrees/team-dev-issue-33-standalone-board; read only).
DevOps CLI: see the devops-cockpit skill below; locate `./devops` or `node tools/devops.js` under /workspace/config/opencode or a devops repo with find/grep (rg is unavailable).
READ-ONLY MISSION. No create, update, delete, deploy, restart, DNS, TLS, firewall, Coolify or Traefik change of any kind. Credentials only from env or SOPS as the CLI already does; never put a token on argv, never print or record token/password values. Protected assets (never touch): IPs 195.201.92.101 and 62.238.57.66, SSH keys 116726501 and 116726548. If a command could mutate, do not run it.
Do not touch any repo files except your report.
</env_preflight>
<goal>
Learn exactly how live.workflows.ac and OpenChamber are deployed, and propose the same shape for board.workflows.ac.
</goal>
<context_files>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-readiness.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. Using read/list/inspect commands only: which server hosts live.workflows.ac and OpenChamber; container vs systemd; Coolify app/service definitions; Traefik/nginx routing; how TLS certificates are issued; where DNS for workflows.ac is managed; how secrets/env are supplied.
2. Why board.workflows.ac currently fails TLS verification (DNS target, certificate subject/chain), from read-only evidence.
3. How the board server (read its start command, port, env vars in the #33 worktree: web/**, service/**, README) would fit the same shape: a concrete proposal listing each change needed (DNS record, app definition, env vars by name only, proxy route, certificate, health check), who/what applies it, and rollback.
4. State every fact with its evidence command (credentials redacted) and mark unknowns plainly. Keep any private voice/auth details out of the report except to say they exist.
</scope>
<criteria>
Zero mutations (state so explicitly, list every command run). Proposal concrete enough for the owner to say go/no-go.
</criteria>
<output>
Write /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/devops-board-deployment.md. Do not commit. Return at most 15 lines: how live.workflows.ac is deployed, TLS root cause, proposed board shape, changes needing owner go, unknowns, actual model.
</output>
