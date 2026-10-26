<env_preflight>
Read-only review. Repo /workspace/extensions/github-task-board.
Worktree /workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment, branch ops/board-deployment.
Do not modify, stage or commit anything except one new untracked report: .agents/run/task-centred-architecture/outputs/board-deployment-runbook-v4-check-private.md, plus optional untracked logs under verifications/board-deployment-runbook-v4-check-private/.
Target: .agents/run/task-centred-architecture/outputs/board-deployment-runbook-v4-private.md (1317 lines). All earlier private reports and verifications are immutable inputs.
No production mutation, no SSH, no live host request, no container/proxy/env change, no secret value read or printed. Local builds, local loopback servers and curl in /tmp/opencode are allowed. Do not modify web/**, panel/**, package.json or tests.
</env_preflight>
<goal>
Decide whether runbook v4 is safe, internally consistent and executable by a different operator in a fresh session: every required finding from the v3 check genuinely closed, every command aborts on failure, no stage can publish or destroy before it is proven safe, and the handover is complete. Readiness stays HALT on unmet prerequisites.
</goal>
<context_files>
v3 check (the contract; its required findings must all be closed): [@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-runbook-v3-check-private.md]
Target v4: [@/workspace/extensions/github-task-board/.worktrees/team-ops-board-deployment/.agents/run/task-centred-architecture/outputs/board-deployment-runbook-v4-private.md]
Manager gate: [@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/deployment-plan-review-gate.md]
Owner decisions 18–20: [@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
Accepted runtime: `git show 54816f6:web/server/app.ts`, `auth.ts`, `config.ts`, `web/README.md`, `web/server.ts`.
</context_files>
<scope>
1. Close-out of every required v3 finding, each with the v4 section and line that closes it. This includes: pinned esbuild; cookie/CSRF header streaming without argv exposure; proxy `--local` on the correct host with a grounded CLI path and a Stage 0 capability check; `set -eu` and abort on every assertion, `diff`, `cmp` and curl status; the subprocess bundle check; the real page title; release and `current` pre-existence refusal; scoped `chmod`; conditional rollback restore; identity pin required; limiter 429 with Retry-After; read-only config inspection; decision 19 handover; measured TLS issuer and `ssl_verify_result`; exposure proof for `8787:8787`; single-repository scope disclosure; corrected supervisor references and counts.
2. New-defect sweep. Look for anything v4 introduces: a command that can fail without stopping, a check that cannot fail, a stage that reads a later stage's output, a secret on argv or in a world-readable file, a destructive command without a prior-state proof, a hardcoded status or cause, a wrong endpoint/method/variable/path/port, a readiness claim stronger than the evidence, a contradiction between stages, a duplicated but divergent command, or a step that only works because `/workspace` happens to be mounted somewhere.
3. Proxy transport reality check. v4 runs `devops.js proxy set --local` on `coolify-main`. Verify from repository evidence that the CLI can actually run there (mount, checkout or transport), and that the route directory and Traefik dynamic path are on that host. If the CLI is not demonstrably available there, the runbook must state an exact operator prerequisite and a stop condition, not assume. Rollback must remove the route on the same host.
4. Auth-flow executability. Trace Stage 4 and Stage 6 command by command: capture `Set-Cookie`, stream the cookie header through stdin, obtain CSRF, perform the authenticated read and logout, and handle a 429 by waiting `Retry-After` at most once. Confirm no stage relies on a jar over non-loopback http and no secret or session value appears on argv. Confirm the post-recreation proof happens before any public route exists.
5. Abort and failure semantics. Confirm each stage begins with `set -eu` in the declared shell and that a mismatch at the last command aborts the stage. Reproduce at least two failures locally in a scratch copy (a wrong expected value and a failed `cmp`) and show the stage exits nonzero. Check that the final PASS line is conditional.
6. Artifact identity. Reproduce the c385ced6 bundle hash from `git archive 54816f6` with the pinned esbuild if the toolchain is available locally; otherwise verify the command and version pin are internally consistent and cite the earlier reproduction. Check the 103,512-byte figure and the manifest coverage of all runtime files.
7. Release and rollback safety. Verify that a non-empty release directory or a pre-existing `current` stops the stage, that prior existence/pointers are recorded, that permissions are scoped, and that rollback restores the recorded state and deletes only created artifacts with hash verification. Check the supervisor state directory and any route backup.
8. Handover completeness. Verify the decision 19 matrix, the prohibition on reusing the OpenChamber token, the dedicated fine-grained token requirement, Coolify-generated password and session secret, no default password, and the secret-free evidence list (commands, exits, HTTP codes, TLS fields, container id/image digest/start time, release and manifest hashes, checkpoint path). Verify the operator can tell exactly which steps this runner cannot do.
9. Scope honesty and readiness. Confirm the document states 54816f6 is the single-repository base, that all-repository support depends on unmerged #37, and that readiness is HALT with the exact unmet prerequisites (dedicated token, Coolify password/secret, authorized transport to the proxy host, merged supervisor).
</scope>
<criteria>
Verdicts: Security APPROVED/NEEDS-FIXES, Spec PASS/PARTIAL/FAIL, Quality APPROVED/NEEDS-FIXES, Design ACCEPTED/REVISE, machine readiness PROCEED/HALT. Every confirmed defect needs a v4 line number, why it fails, and the smallest correction. Distinguish required from residual. Label any unproven suspicion. Do not edit the target, do not self-approve, do not run any production command.
</criteria>
<output>
At most 20 lines: the five verdicts; each remaining required defect as `line — problem — smallest correction`; the reproduced hash or the reason you could not reproduce it; the two abort reproductions; proxy-host and handover results; false suspicions cleared; what you could not verify; actual provider/model.
</output>
