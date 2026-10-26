<env_preflight>
READY — independent recheck of cdc48b1 returned Security APPROVED / Spec PASS / Quality APPROVED / PROCEED with zero required findings; manager accepted it (outputs/issue-37-fix-recheck-private.md, untracked in the source worktree). This authorises working-review-branch integration and merged proof only, never master/deploy/closure/push.
Repo /workspace/extensions/github-task-board
Source worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo; branch feat/issue-37-multi-repo; accepted HEAD cdc48b1 on 8a958fe (product base 5b231ff); tracked clean, only the private recheck report untracked.
Root integration /workspace/extensions/github-task-board; branch feat/v2-binding-and-ratelimit; HEAD 8f1c21e tracked clean at dispatch except known private/unrelated UNTRACKED files. Verify branch and tracked-clean immediately before merge; unexpected branch, dirt or remote movement => STOP/report.
Do not read/stage/delete/copy .agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs, .agents/run/task-centred-architecture/outputs/{deployment-preflight-private,devops-board-deployment}.md, tasks/issue-34-hostile-review.md, or any *.md named *-private. Never git add -A.
Root node_modules present. Tests: node --test web/tests/*.test.mjs ; npm test ; npm run typecheck ; npx tsc -p web/tsconfig.json ; npm run build ; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs. web/dist is gitignored; report its SHA-256, never force-add it.
A #30 correction worker may be editing panel/** in its own worktree at the same time; it must not touch root. Never merge anything but feat/issue-37-multi-repo here.
No push, PR, GitHub issue change, closure, deployment, credential use, shared config/skill change, reset/rebase/force, or worktree removal.
</env_preflight>
<goal>
Integrate the accepted multi-repository board work into the working review branch and reproduce its behaviour on the merged tree without product changes.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/.agents/run/task-centred-architecture/outputs/issue-37-fix-recheck-private.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-37-multi-repo/.agents/run/task-centred-architecture/outputs/issue-37-hostile.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
Saved source proofs under the source worktree verifications/** and web/tests/*.test.mjs are immutable inputs; copy only into your own proof directory.
</context_files>
<scope>
Run merge/tests in root with explicit workdir; keep any scratch outside the repository.
1. Confirm source HEAD is cdc48b1 and tracked clean, root branch is feat/v2-binding-and-ratelimit, root tracked clean, and cdc48b1 is not yet an ancestor of root HEAD. Any mismatch => STOP/report.
2. git merge --no-ff feat/issue-37-multi-repo into feat/v2-binding-and-ratelimit with a message naming issue 37. Unexpected non-generated conflict => STOP/report, no improvisation, no product edits. Do not let an older source state replace root manager run state.
3. Prove the merged tree: web suite, root suite, both typechecks, panel+service build, fresh web esbuild with its SHA-256, and web/tests/hosting.test.mjs (it builds and boots the real bundle). Record actual counts, not assumed ones: web expected 384, root expected 517 (minus/plus unrelated load-sensitive flake only if you can show the failure is the <50 ms parser perf assertion and a rerun passes).
4. Re-run the F1–F4 merged-tree probes from your own scratch harness against root product code: revoke-mid-refresh write refused with zero upstream PATCH; cross-repo client race keeps label==selection and Refresh enabled; pre-dispatch 503 shows a definite refusal and no uncertain marker; 501-issue aggregate truncated and duplicate page truncated. Assert equality, do not copy the builder's expected values without deriving them.
5. Own root .agents/run/task-centred-architecture/outputs/issue-37-integration.md and verifications/issue-37-integration/** only. Commit the report and any committed generated artifact that genuinely changed (panel bundle only if the build changed it). Never modify manager mission.md/tasks.md/continuation.md. Report the integration and proof commit hashes.
6. No push; the manager pushes. No cleanup of the source worktree from inside itself.
</scope>
<criteria>
Accepted source ancestry present in the working branch; merged web/root/types/build and runtime probes reproduce the accepted behaviour; no product edit; manager state and private files untouched. Human validation and deployment remain pending.
</criteria>
<output>
At most 12 lines: merge commit, proof commit, conflicts; actual test/typecheck/build counts and exits; web bundle SHA-256; each of the four merged probes with pass/fail; tracked-clean state; actual provider/model; blind spots. Stop on failure, do not fix or clean up.
</output>
