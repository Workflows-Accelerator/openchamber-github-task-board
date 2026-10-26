<env_preflight>
BLOCKED DRAFT — do not dispatch until every precondition in <preconditions> is empirically true and recorded. Fill exact commits, running workers, credential presence (names only), hook commit and plan/recheck verdicts at dispatch.
Repo /workspace/extensions/github-task-board
Worktree FILL_AT_DISPATCH — a fresh deployment worktree from the accepted integrated review branch, not the old ops worktree.
Target: board.workflows.ac in the existing OpenChamber container, same-container shape approved by decision18.
No credentials values are to be read, printed, copied or passed in arguments. Only variable names and presence may be checked. Never write secrets into tracked files, reports, logs or chat. No unsafe secret search.
Scratch /tmp/opencode. No master push, no issue closure, no deletion of remote branches, no force-push/reset/rebase, no unrelated service changes or repairs.
</env_preflight>
<goal>
Deploy the accepted board artifact on the approved private path with a reviewed supervisor and fully reversible checkpoint, ending only at the operator-triggered recreation boundary.
</goal>
<preconditions>
All must be true and recorded; otherwise HALT with the exact missing item:
1. Deployment plan recheck verdict design ACCEPTED and readiness PROCEED-with-only-execution-prerequisites (credentials/transport may remain the blocking items for the final trigger).
2. Startup hook merged to opencode-config master by the human, present in the live checkout used by the container, independently reviewed; BOARD_ENABLED opt-in semantics tested.
3. Owner has provisioned BOARD_GITHUB_TOKEN, BOARD_PASSWORD_HASH (or password), and confirmed the bot account through the secure store; BOARD_GITHUB_LOGIN derivable and verified; BOARD_SESSION_SECRET generated fresh by the deployer; BOARD_BASE_URL, BOARD_REPO, BOARD_HOST, BOARD_PORT known. Presence checked by name only.
4. No other worker is running anywhere that would be killed by recreation. All in-flight issues are committed and their worktrees/run state persisted; manager confirms no active child sessions.
5. Accepted integrated commit is immutable and contains #33+hosting plus any merged #35/#37 when their reviews passed. Never deploy unreviewed worktree content.
6. Artifact layout verified: server bundle, web/public assets, package metadata and external dependencies resolve from the chosen release directory; checksum recorded.
7. Full rollback material captured: previous env variable names/presence, port mappings, route ownership, startup hook state, health baselines for agents/live, container identity. Secret values only in the approved encrypted store, never in the report.
8. Operator recovery path proven: who can reach the controller, the exact supported command or UI action to trigger recreation, and the post-restart verification instructions that do not depend on this session surviving.
</preconditions>
<scope>
1. Build from the exact accepted commit into a new immutable release directory; do not modify source. Run the accepted typecheck/build/parity gates and the hosting tests on that exact tree. Record checksums of bundle and assets. Do not force-add ignored build output.
2. Stage environment variables through the approved Coolify mechanism without echoing values. Confirm startup would fail closed if a required variable is absent. Confirm BOARD_HOST is explicit for container binding and the public origin is correct.
3. Install/enable the reviewed supervisor for the release directory with BOARD_ENABLED controlled explicitly. Prove it starts the exact artifact, restarts on crash with bounded backoff, writes capped logs without secrets, and refuses duplicate starts. Prove disable stops it without touching other services.
4. Network: publish only the private address/port mapping supported by the reviewed plan; never a public 0.0.0.0 exposure. Confirm single route ownership with the verified transport or hand the exact supported operator step to the owner. Do not invent flags.
5. Pre-recreation checks: internal health 200 without secrets, HEAD 405 with Allow: GET, unauthenticated data routes 401, a real sign-in with the dedicated password, authenticated read of only the accepted repository set, and log redaction. No production issue mutation. If a disposable test issue is needed, stop and ask; do not create one.
6. Capture adjacent-service baselines before change and compare after; do not repair unrelated failures or mislabel them.
7. Write a secret-free operator checkpoint to persistent storage: artifact commit/checksum, release path, env variable names, port mapping, route owner, supervisor state, rollback steps, verification commands, and a resume instruction for a fresh agent session. Commit and push run-state evidence that is safe to publish; keep private topology out of public artifacts.
8. STOP at the recreation boundary. Do not trigger container recreation yourself unless the owner is present and has confirmed the checkpoint is safe; otherwise present the single operator action and wait. After recreation this runner dies; verification is a fresh session's task.
</scope>
<criteria>
Every executable step verified with real commands and recorded exits. No secret value in output. No unreviewed artifact. No public port exposure. No production issue mutation. Rollback can restore captured originals and remove only newly introduced board material. Health, auth, supervisor and adjacent baselines verified pre-recreation. Honest NOT RUN list for anything post-recreation. No claim of deployment success before a fresh-session post-restart verification.
</criteria>
<output>
At most 12 lines: artifact commit/checksum, gates run and results, credential presence only, supervisor and private-path result, pre-recreation health/auth results, adjacent baseline result, checkpoint path, exact remaining operator action, rollback status, untested post-restart items, actual provider/model. No deployed/master/closure claim.
</output>
