<env_preflight>
Current preflight ses_db928fa295bd459e709a528c completed BLOCKED, actual9router/engineer. This is the independent review before production mutation; no concurrent infra worker. Candidate is a plan, not a deployed service.
Repo /workspace/extensions/github-task-board
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment
Branch ops/board-deployment; HEAD40952c60d44c9afc5f98cc135acc5210407d92b9. Tracked-clean; only untracked .agents/run/task-centred-architecture/outputs/board-deployment-preflight-current-private.md and verifications/board-deployment-preflight-current-private/**. Accepted hosting code through54816f6 is in the main checkout, not this old worktree; do not mistake old-worktree test results for accepted-hosting proof. No parallel infrastructure owner.
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
[@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-preflight-current-private.md]
Current report is private/untracked; never copy it into tracked/public artifacts. Main accepted hosting proof: .agents/run/task-centred-architecture/outputs/hosting-integration-acceptance.md. Report incorrectly calls #35 parked: its final recheck is running. Do not treat report wording as authority.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/devops/devops-cockpit/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are independent, FIX NOTHING. Test assumptions rather than copying READY from preflight. Confirm exact owner go and still-protected secret boundaries: no reused GITHUB_TOKEN, OPENCHAMBER_UI_PASSWORD, voice auth or JWT secret; no accidental operator-controlled token origin; no broad unauthenticated board; no secret in argv/logs/browser/storage. Report names/status only.
Challenge artifact identity and coverage: accepted immutable web code only, never unreviewed multi-repo source/panel. Running a single-repo base may support staging verification, but cannot be reported as the completed all-repository goal. Check persistent restart hook ownership and whether config-repo edits would need fresh separate worktree/review. No OpenChamber source modification.
Challenge actual network path, private-only board port, exact proxy router owner, valid TLS without bypass, origin/CSRF/header limits, login-rate-limit behavior under proxy without trusting attacker XFF. Verify preflight's rollback can genuinely restore agents/live and container startup rather than deleting a route only. A container recreation stops our agent sessions: plan must save a restartable checkpoint and recovery command before triggering it; no fire-and-forget claim. Dedicated secrets must exist with approved provenance; availability alone is not authority to reuse.
Check deployment and post-deploy proof: process liveness, GET health, unauthenticated data refusal, sign-in with dedicated password, authenticated repository reading only (no issue mutation without approved disposable target), original adjacent service recovery, TLS/origin, supervised restart proof if safely authorized. Separate liveness from readiness. If a required prerequisite missing, HALT with exact action, not a speculative workaround. Private report remains local/untracked; public summary contains no private hosting/auth findings.
Challenge these specific omissions: a startup-only nohup hook is NOT crash supervision; exact pinned working directory/build path and dependencies must survive recreation; public port publication must actually be private-only; absent router is an inference from503/self-signed and needs inspection; live502 is not proven harmless by calling it dormant; rollback must disable persistent hook and restore environment/entrypoint as well as ports. No private secret ever goes in chat despite preflight line190 saying 'in chat or vault'; correct that privately. BOARD_GITHUB_LOGIN is a non-secret identity pin: confirm source requires it and can be derived with /user after a dedicated token is securely supplied, not another credential the owner must create. Owner already approved interruption (decision18); do not re-ask it. Do not recommend scoping final all-repo token to just one repo without noting approved coverage. Record exact recoverable operator actions/checkpoint, not a ~30s downtime promise.
</scope>
<criteria>
Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, machine PROCEED/HALT with evidence for each requirement. Missing dedicated token/password or recovery/rollback prerequisite must HALT. No production mutation or code correction by reviewer. Flag any unapproved fork before execution.
</criteria>
<output>
At most12lines verdicts, empirical facts challenged, blocking findings ranked with minimal action and provenance, exact approved artifact/coverage and private report path, untested blind spots, actual provider/model. Do not claim deployed; no master/closure authority.
</output>
