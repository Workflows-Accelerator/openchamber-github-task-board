<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-36-autonomous-closure
Branch: fix/issue-36-autonomous-closure at 7c6fd33 (base feat/v2-binding-and-ratelimit 9c235a9). Tracked state clean at dispatch.
Tests: npm test; npm run typecheck; npm run build (node_modules symlinked from root). Synthetic fixtures only.
Do not touch: service/**, web/**, shared config/skills, credentials, opencode.db, installed extension, real GitHub, master, other worktrees. No push, merge or close.
</env_preflight>
<goal>
Independent hostile review of the #36 fix: prove or disprove that no automatic path can close an issue, and that human Done and archive still close.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/36
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-36-autonomous-closure.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-36-autonomous-closure/.agents/run/task-centred-architecture/outputs/issue-36-closure-fix.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
You did not write this code. Do not assume it is right. Review `git diff 9c235a9..7c6fd33`.
1. The fixer could not reproduce closure from body phase (no body-phase parser in reconciler) and cut defensively. Rule: is the cut still correct and minimal, or does it hide a real reachable path elsewhere? Grep every caller of updateIssueStatus, every `state: 'closed'` / `state:"closed"` write, toggleArchiveIssue, drag/drop to Done, keyboard/menu actions, bulk actions, label-driven status:done projection. List each with: automatic or human, and whether it can still close.
2. Confirm every legitimate human gesture (card drag to Done, column menu, close/archive control, any other UI that closed before) passes isHumanGesture:true and still closes with the same UX. A human path silently dropped is a High defect.
3. Confirm non-terminal automatic reconciliation still works (in_progress, review, etc.).
4. Confirm tests would fail on pre-fix code for the automatic paths (check out 9c235a9 test-only run or reason from diff with evidence). Confirm generated panel/main.js matches a fresh build (sha256 before/after npm run build).
5. Check the prompt-guard line is short and correct.
Fix nothing larger than a trivially-correct defect you find (commit it separately with a test); otherwise report it.
</scope>
<criteria>
Verdicts: Correctness PASS/FAIL, Scope PASS/FAIL, with file:line evidence and test counts. Each finding ranked High/Medium/Low.
</criteria>
<output>
Write .agents/run/task-centred-architecture/outputs/issue-36-hostile-review.md in the worktree and commit it. Return at most 12 lines: verdicts, findings, closure-path table summary, test counts, bundle parity, any commit made, actual model.
</output>
