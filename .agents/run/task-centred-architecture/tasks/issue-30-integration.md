<env_preflight>
READY — independent final review of 959bfd294947ba9da7b8c2c32cb7cd4039563f83 returned Security APPROVED / Spec PASS / Quality APPROVED / PROCEED with zero required findings; manager accepted (owner decision22). This authorises working-review-branch integration and merged proof only, never master/deploy/closure/push.
Repo /workspace/extensions/github-task-board
Source worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type, branch feat/issue-30-work-type, HEAD959bfd294947ba9da7b8c2c32cb7cd4039563f83 on cf7dd92, tracked clean; private untracked review reports/evidence must be preserved.
Root /workspace/extensions/github-task-board, branch feat/v2-binding-and-ratelimit; tracked clean at dispatch. Manager may add .agents/run/**-only commits while you work; any other tracked change since64130ec that is not your merge output => STOP.
Do not read/stage/delete/copy .agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs, outputs/{deployment-preflight-private,devops-board-deployment}.md, tasks/issue-34-hostile-review.md, or any *-private.md. Never git add -A.
Commands: node --test web/tests/*.test.mjs ; npm test ; npm run typecheck ; npx tsc -p web/tsconfig.json ; npm run build ; node --test test/shipped-parity.test.js ; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs (gitignored; report SHA-256, never force-add).
No push, PR, issue change, closure, deployment, credential use, shared config/skills, reset/rebase/force, or worktree removal. One release worker in root at a time; a deployment-package worker runs in another worktree and must not touch root.
</env_preflight>
<goal>
Integrate the accepted feature/bug prompt work into the working review branch, rebuild both generated artifacts, and prove the merged tree without changing product behaviour.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-final-recheck-private.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-work-type/.agents/run/task-centred-architecture/outputs/issue-30-fix-round-3.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-37-integration-acceptance.md]
</context_files>
<scope>
1. Confirm source HEAD is959bfd2 tracked clean, root on feat/v2-binding-and-ratelimit tracked clean, and the source is not already an ancestor of root. Unexpected state => STOP/report.
2. Merge --no-ff feat/issue-30-work-type into feat/v2-binding-and-ratelimit naming issue 30. Conflicts limited to generated panel/main.js may be resolved by a fresh legitimate build; any other conflict => STOP, no product edit.
3. Rebuild both generated artifacts: panel/main.js from root sources and the web bundle. Panel source is now the merged panel/main.ts + core.ts; expect a deterministic build and report its SHA-256 (the source worktree reported 7cb9aaafd463c4c59cdfb8a37a3c37b6f3172f1842c68b9076ced8ff2e3f1b3a before merge; a merge-induced difference must be explained by source content, not path comments). Never hand-edit generated files.
4. Prove the merged tree: web suite, root suite, both typechecks, shipped parity, and the issue-30 slice plus the three retargeted older tests. Expected web384, root525 (a single load-sensitive timing failure may be rerun once with the exact failing assertion and an unchanged passing rerun recorded). Any other failure => STOP/report, no fix.
5. Also confirm prompt output is unchanged on the merged tree: the preflight and batch renderers still produce byte-identical text to the accepted source for undecided, bug and feature fixtures. Use a scratch harness; do not add product files.
6. Own root .agents/run/task-centred-architecture/outputs/issue-30-integration.md and verifications/issue-30-integration/** only. Commit report/logs plus legitimately rebuilt generated artifacts. Do not modify manager mission.md/tasks.md/decisions. Report merge/proof commits.
7. No push; the manager pushes. No cleanup of the source worktree.
</scope>
<criteria>
Accepted source ancestry in the working branch; merged web/root/types/build/parity green; generated artifacts deterministic; prompt bytes unchanged; no product edit; manager state and private files untouched. Human validation and deployment remain pending.
</criteria>
<output>
At most 12 lines: merge commit and proof commit; conflicts; actual suite/typecheck/parity counts and exits; panel and web bundle SHA-256; prompt byte-comparison result; tracked-clean state; actual provider/model; blind spots. Stop on failure; no fix or cleanup.
</output>
