<env_preflight>
Repo: /workspace/extensions/github-task-board, root branch feat/v2-binding-and-ratelimit at 9b30930 (run-state edits pending only). Root application code is read-only. #33 is under active independent review; do not edit or build its worktree.
Deployment context: owner chose board inside the existing OpenChamber container, same shape as live.workflows.ac, one repository Workflows-Accelerator/openchamber-github-task-board. Secrets already in SOPS according to owner. This is NOT authority to deploy.
Files owned: only /workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-preflight-private.md (LOCAL ONLY, never git-add or push). Report may contain key names but NEVER values.
Tests: read/list/inspect commands only using existing DevOps CLI /workspace/devops/devops or node tools/devops.js as discovered in the previous report. No production writes, no test notification or issue mutation, no env copy, no credential printing/argv, no private voice/auth inspection. Protected assets from devops skill must not be targeted.
Preflight authoritative: skip initial pwd/ls/status discovery. Targeted source reads to confirm actual CLI command safety are allowed. If permission denied, stop that route, never bypass it.
</env_preflight>
<goal>
Make the chosen hosting plan concrete and identify any missing secrets or restart/reachability blockers without changing anything.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/devops-board-deployment.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
1. Inspect the existing SOPS storage through supported secret-name/presence-only operations. Do not decrypt entire files to output, grep secret values, or dump env. Determine which required board variable names have an existing usable source: GitHub token, board password/hash, session secret (if actually used at current source). Record only names and presence, and unknown where safely unavailable. Owner chose password-only sign-in; account-login identity check is NOT required. No SOPS secret creation or edits. Report absent VAPID keys as not yet provisioned; no push work now.
2. Establish how the live-service process is supervised and auto-started, by inspecting only launch definitions/start scripts and safe selected config fields, not process env/auth files. Distinguish process restart vs container recreation vs full host reboot. Propose the minimal persistent board launch using the existing supervisor, without modifying OpenChamber config. If none exists, mark a real owner fork, not a guessed nohup process.
3. Verify the network path precisely: a process listening on 0.0.0.0 INSIDE a bridged container is not necessarily reachable at the worker host IP. Identify host-network vs published port vs container-only port from selected docker inspect fields (NEVER dump Env). Does port 8787 need publication and container recreation? Would that interrupt OpenChamber/live? Mark unknowns.
4. Correct earlier plan assumptions: BOARD_TRUST_PROXY=true must not be recommended unless untrusted direct access/forged forwarded headers cannot bypass rate limits. Default no trust, or only explicitly verified proxy source. Dynamic Traefik route and Coolify domain must not create duplicate conflicting routers. No guarantee of zero downtime or automatic cert issuance without observed proof.
5. Produce a concrete go/no-go checklist including launch persistence, proxy route, TLS, health endpoint actually implemented, bounded rollback stopping only board, secret source names/presence, and exact changes that would need owner go. Never recommend restarting live or changing global OpenChamber without renewed approval.
</scope>
<criteria>
Zero mutation; selected safe inspections only; fact/unknown/estimate separated; commands listed with secrets redacted; no private voice authentication information in report. No claim of deployment readiness until blockers have concrete evidence.
</criteria>
<output>
Write the local-only report at the owned path; do not commit it. Return at most 12 lines: secret presence by variable NAME only, startup persistence, network path/port-publication findings, corrections to the first report, blockers and owner decisions needed, actual provider/model.
</output>
