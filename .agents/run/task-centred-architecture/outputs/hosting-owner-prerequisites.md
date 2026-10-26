# Board hosting prerequisites — 2026-10-26

Status: deployment authorized by decision18; execution BLOCKED. This replaces the earlier preparation-only note, not the binding decisions.

## Accepted preparation
- Configurable bind with loopback default, secret-free GET /health and documented production start command are merged and pushed through54816f6 after independent review and merged-tree proof.
- This is an accepted single-repository staging base, not the completed all-repository goal. #37 must pass independent review and integration proof before that goal is claimed.

## Owner action now
Provision a dedicated Workflows Accelerator bot token and a separate board password/hash using the approved secure vault or deployment settings, never chat/public issues. Existing service credentials are not approved for reuse. Token coverage must match the approved bot-visible repository scope; editing requires the matching issue permissions. Receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33#issuecomment-6424281066 .

The required bot username is a non-secret identity pin; it can be checked using /user with the securely supplied dedicated token. The agent can generate a fresh board-only session secret of adequate entropy. Neither requires reusing another service’s secret.

## Agent-owned prerequisites still unverified
- Independent deployment-plan review (ses_936460fe0bd87f959b191af0); private plan/evidence stays untracked.
- Separate config-repository worktree and reviewed persistent startup/crash recovery, exact pinned artifact working directory, dependencies and secret-safe launch.
- Private-only network path, single route ownership, valid TLS, origin/rate-limit behavior and authenticated read-only readiness proof.
- Operator-recoverable checkpoint and complete rollback of startup/environment/network before container recreation terminates this runner. Do not promise a specific downtime duration without proof.

The same-container shape and brief interruption are already authorized; do not re-ask that permission. No master merge, L5 acceptance or issue closure is authorized. Real GitHub permissions/writes, production TLS/proxy, restart survival, installed-host rendering and deployed-browser behavior remain NOT VERIFIED. Production changes must be dispatched only after prerequisites and reviews pass.
