<env_preflight>
Corrector ses_a98775652dd8bc6cb3e33d46 completed. This recheck is independent of it; do not adopt its self-declared APPROVED status.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment
Branch ops/board-deployment, HEAD40952c60d44c9afc5f98cc135acc5210407d92b9 tracked-clean. Untracked immutable: board-deployment-preflight-current-private.md, board-deployment-plan-hostile-private.md, board-deployment-plan-corrected-private.md and their verifications/ dirs. Private reports stay untracked.
Read-only product and infrastructure. Own only .agents/run/task-centred-architecture/outputs/board-deployment-plan-recheck-private.md and verifications/board-deployment-plan-recheck-private/**, untracked. No secrets or credential values; no broad secret search. Scratch /tmp/opencode.
No production mutation: no deploy/restart/proxy/port/DNS/firewall/env/secret change, no container recreation, no product patch, no worktree creation, no master/push/closure.
Current source routes/methods are authoritative: verify against web/server/app.ts and config.ts rather than assuming invented endpoints. Preflight authoritative at dispatch; no initial status/pwd/ls.
</env_preflight>
<goal>
Independently decide whether the corrected plan is safe, internally consistent and executable, and whether deployment readiness is genuinely PROCEED or must remain HALT.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-plan-review-gate.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-deployment-plan-correction.md]
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-plan-corrected-private.md]
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-plan-hostile-private.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right. FIX NOTHING.
Verify finding-by-finding: every accepted blocker closed, no invented acceptance of reviewer errors. Specifically test: secrets only in approved secure store, never chat/public/argv/logs; username pin tied to approved bot rather than any token; immutable artifact includes server bundle plus public assets/metadata/dependencies and fails safely; genuine supervision with bounded backoff, single owner, graceful disable, no foreign PID kill, capped logs, fixture proof; entrypoint non-blocking and preserves existing behaviour; private-only exposure with single route owner and a transport that actually works or an exact operator step; full captured-original rollback and secret-free checkpoint before runner death; adjacent-service baseline honesty; shared proxy login bucket either bounded or explicitly escalated as a fork.
Read the corrected plan for internal contradictions, silently assumed capabilities, circular prerequisites, invented CLI flags/commands, and verification that would pass while the service is broken. Distinguish design review from readiness. Missing credentials or an untested transport keep readiness HALT even if the design is sound. Confirm stage order cannot terminate the runner before recovery exists and cannot publish a route before the process is healthy.
Recompute exact current health/auth commands from source. Confirm no private topology or credential values leak into tracked/public material. Confirm accepted staging artifact is single-repository and full-coverage claims wait for accepted #37.
Manager's own doubts to test, not accept: the supervisor hardcodes one release path per commit, which would force a new reviewed configuration change for every board release; a stable atomically switched release pointer or an explicit configured release path is preferable if the plan does not already provide one. The supervisor exits nonzero on missing artifact/checksum while the entrypoint must remain non-blocking, so integration semantics must be explicit and tested. The plan's own 'Plan Status APPROVED' is not a verdict. Checksums omit dependencies. Verify the `10.0.0.7:8787:8787` mapping is actually supported by the chosen Coolify mechanism rather than assumed. Confirm rollback does not delete unrelated pre-existing material and that reconnection steps do not depend on this runner.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, design ACCEPTED/REVISE and machine readiness PROCEED/HALT with evidence. Any required blocker unresolved => HALT with exact missing action and owner. No production mutation, no self-approval, no code correction.
</criteria>
<output>
At most 12 lines: verdicts, closed/open blockers, any new contradiction, exact current commands verified, readiness status, owner-only prerequisites in plain words, untested areas, private report path, actual provider/model. No deployed/master/closure claims.
</output>
