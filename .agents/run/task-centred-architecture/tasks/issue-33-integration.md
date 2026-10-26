<env_preflight>
BLOCKED DRAFT — decision17 final correction supersedes earlier candidate. Prior residual review ses_6f740247134713dd1a74137a FAILED (a4191a4), cannot authorise this integration. Dispatch only after NEW issue-33-last-hostile review returns Security APPROVED, Spec PASS and Quality APPROVED, manager inspects actual full diff/report and writes updated review gate. Any further failed recheck PARKS issue for mission, never use this release brief.
Repo /workspace/extensions/github-task-board
Dispatch worktree /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board; branch feat/issue-33-standalone-board; reviewed HEAD FILL_AT_DISPATCH (latest product0bca8fb, builder evidence5c562e8; final reviewer still running, NO authority yet).
Root integration feat/v2-binding-and-ratelimit; HEAD FILL_AT_DISPATCH, tracked clean except known private/unrelated UNTRACKED files. Do not read/stage/delete/copy .agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs, .agents/run/task-centred-architecture/outputs/{deployment-preflight-private,devops-board-deployment}.md, tasks/issue-34-hostile-review.md. Never git add -A.
Dependencies root node_modules already present. Tests node --test web/tests/*.test.mjs; npm test; npm run typecheck; npx tsc -p web/tsconfig.json; npm run build; npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs. No build:web script; web/dist gitignored.
No master, production GitHub mutations, credentials, installed extension, shared config/skills, unrelated worktrees, reset/rebase/force, push/PR/issues/closure/deployment. Do not remove source worktree from inside itself.
Preflight authoritative; immediately before merge targeted source/root branch/dirt checks mandatory to detect concurrent change.
</env_preflight>
<goal>
Integrate the accepted standalone board into the working review branch and reproduce the merged web and panel behavior without product changes.
</goal>
<context_files>
Manager review gate FILL_AT_DISPATCH: root .agents/run/task-centred-architecture/outputs/issue-33-review-gate.md.
Independent verdict FILL_AT_DISPATCH: source .agents/run/task-centred-architecture/outputs/issue-33-last-hostile.md (prior residual-hostile report FAILED, not authority).
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
Browser fixtures in source verifications/issue-33-last-correction/**, immutable original residual-review/** and forthcoming issue-33-last-review/**. Read exact helper imports/artifact roots before adapting only paths/ports into owned merged proof; no overwrite of historical proof.
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/ship/worktree/management/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Keep session in source worktree, run merge/tests in root with explicit workdir. One release worker root at a time; no simultaneous #35 release.
1. Confirm accepted source unchanged, root intended branch and tracked clean. Unexpected branch/dirt/remote movement => STOP/report. Never reset/rebase/force/overwrite state.
2. Merge --no-ff feat/issue-33-standalone-board into feat/v2-binding-and-ratelimit. Non-generated conflicts => STOP/report, no improvisation. No product edits. Existing root manager state must not be replaced by older source state.
3. Prove merged tree. Full web and root suites, root/web types, panel build/parity and fresh web esbuild/hash/syntax. Root suite baseline depends on whether #35 already integrated: expected517 without it, 542 or independent-review final count with it; record actual, do not hardcode an old466 count. Shared panel/core.ts imports are now newer than the source baseline, so merged web behavior must be tested rather than assumed.
4. Run relocated copies of saved final-correction browser84/HTTP36/gateway19/baseline32/preserved28 matrices against ROOT product modules/runtime, not original source worktree. Relocate only imports/artifact paths/ports, preserve assertion equality. Expect exactly1PATCH after send, UNKNOWN+preserved view/both drafts for invalid reply, valid controls succeed, code targets zeroPATCH. Inspect desktop360 screenshots/logs. This merged-tree reproof is necessary because panel/core.ts is newer. Any additional independent final-review regression suite must also run against merged tree. If runtime cannot reproduce or fails, STOP/report precise gap, no claimed pass/product patch.
5. Own root .agents/run/task-centred-architecture/outputs/issue-33-integration.md and verifications/issue-33-integration/** only. Commit explicit proof paths; legitimate generated panel bundle only if truly needed. web/dist remains gitignored (no force-add), report fresh hash/parity. Do not change manager mission/tasks/continuation. Prior source evidence preserved by merge before cleanup.
6. No push, PR, GitHub issue changes, Done, deploy or worktree removal. Manager accepts empirical proof, pushes review branch and cleans source worktree separately. Local feature branch retained by portfolio policy. No remote branch deletion.
</scope>
<criteria>
Accepted source ancestry in working branch; merged web/root/types/build and fresh runtime probes reproduce accepted behavior, no unsupported security/deployment claim; manager state/private files untouched. Reports preserved before teardown. Human validation and production go remain pending.
</criteria>
<output>
At most12 lines: merge/proof commits, conflicts, actual tests/counts/exits, panel/web hashes/parity, merged browser/probe counts and screenshots/logs, clean tracked state, actual provider/model, blind spots. Stop on failure, no fix or cleanup from this worktree.
</output>
