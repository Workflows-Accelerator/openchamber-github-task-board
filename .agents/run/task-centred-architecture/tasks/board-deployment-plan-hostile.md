<env_preflight>
BLOCKED DRAFT — do not dispatch until current preflight ses_db928fa295bd459e709a528c returns. Fill exact HEAD/dirty facts and current private report path. This review must occur before production mutation.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment
Branch ops/board-deployment; base40952c6 expected unchanged, private untracked preflight evidence expected. No active preflight worker once dispatched; no parallel infrastructure owner.
Application accepted web base #33+hosting4f39e26, not dirty #37 or unaccepted #35. Product/infra read-only; own .agents/run/task-centred-architecture/outputs/board-deployment-plan-hostile-private.md + verifications/board-deployment-plan-hostile-private/**, leave private evidence untracked. Scratch /tmp/opencode. No secrets in arguments/output, env dumps, broad secret search or private GitHub comment.
Tests node --test web/tests/hosting.test.mjs; non-mutating live HTTPS/status and CLI inspection where necessary. No product patches, secrets writes, deploy/restarts/proxy/port/DNS/firewall mutations, master/push/issue closure.
Facts authoritative at dispatch; no initial status/pwd/ls discovery. Recheck precise remote assumptions where needed, never trust historical live facts.
</env_preflight>
<goal>
Independently approve or reject the concrete deployment plan and credential provenance before any production change.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/board-deployment-preflight-current.md]
Private current preflight report FILL_AT_DISPATCH, not historical proposal. Read it in the deployment worktree without publishing values.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent, FIX NOTHING. Test assumptions rather than copying READY from preflight. Confirm exact owner go and still-protected secret boundaries: no reused GITHUB_TOKEN, OPENCHAMBER_UI_PASSWORD, voice auth or JWT secret; no accidental operator-controlled token origin; no broad unauthenticated board; no secret in argv/logs/browser/storage. Report names/status only.
Challenge artifact identity and coverage: accepted immutable web code only, never unreviewed multi-repo source/panel. Running a single-repo base may support staging verification, but cannot be reported as the completed all-repository goal. Check persistent restart hook ownership and whether config-repo edits would need fresh separate worktree/review. No OpenChamber source modification.
Challenge actual network path, private-only board port, exact proxy router owner, valid TLS without bypass, origin/CSRF/header limits, login-rate-limit behavior under proxy without trusting attacker XFF. Verify preflight's rollback can genuinely restore agents/live and container startup rather than deleting a route only. A container recreation stops our agent sessions: plan must save a restartable checkpoint and recovery command before triggering it; no fire-and-forget claim. Dedicated secrets must exist with approved provenance; availability alone is not authority to reuse.
Check deployment and post-deploy proof: process liveness, GET health, unauthenticated data refusal, sign-in with dedicated password, authenticated repository reading only (no issue mutation without approved disposable target), original adjacent service recovery, TLS/origin, supervised restart proof if safely authorized. Separate liveness from readiness. If a required prerequisite missing, HALT with exact action, not a speculative workaround. Private report remains local/untracked; public summary contains no private hosting/auth findings.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, machine PROCEED/HALT with evidence for each requirement. Missing dedicated token/password or recovery/rollback prerequisite must HALT. No production mutation or code correction by reviewer. Flag any unapproved fork before execution.
</criteria>
<output>
At most12lines verdicts, empirical facts challenged, blocking findings ranked with minimal action and provenance, exact approved artifact/coverage and private report path, untested blind spots, actual provider/model. Do not claim deployed; no master/closure authority.
</output>
