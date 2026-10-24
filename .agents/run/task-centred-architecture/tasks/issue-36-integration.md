<env_preflight>
Repo: /workspace/extensions/github-task-board (root checkout), branch feat/v2-binding-and-ratelimit at 8ab3af0 (or later run-state commit). Root holds unrelated untracked files (.agents/idle-nontext-state.json, .agents/run/board-lifecycle/**, .agents/run/test-inspection.mjs): never add, stage, move or delete them; never `git add -A`.
Source: fix/issue-36-autonomous-closure at 4f22605 (fix 7c6fd33 + hostile review 4f22605, both PASS).
Tests: npm test; npm run typecheck; npm run build in the root checkout.
Do not touch: other worktrees/branches, master, shared skills, credentials, opencode.db, installed extension, GitHub issues. No push (manager pushes), no force, no rebase, no reset.
</env_preflight>
<goal>
Merge the reviewed #36 fix into feat/v2-binding-and-ratelimit and prove the merged result is green.
</goal>
<scope>
1. `git merge --no-ff fix/issue-36-autonomous-closure -m "merge: #36 only a person closes a task"`. If conflicts arise anywhere other than generated panel/main.js, stop and report them without resolving. For panel/main.js, regenerate with npm run build.
2. After merge: npm test, npm run typecheck, npm run build; confirm panel/main.js is byte-identical to a fresh build (sha256 before/after) and git status shows no tracked change after the build.
3. Run test/autonomous-closure.test.js explicitly and record its count.
</scope>
<criteria>
Merge commit exists; full suite, typecheck, build green; bundle parity; no tracked dirt; untracked unrelated files untouched.
</criteria>
<output>
Return at most 8 lines: merge commit hash, conflicts (if any), test counts (full and targeted), bundle sha256, git status summary, actual model.
</output>
