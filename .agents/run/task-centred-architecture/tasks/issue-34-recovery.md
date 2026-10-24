<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity at dd5cb2f. Manager inspected after explicit child failure: tracked/untracked state clean, no commits after dd5cb2f. Previous child ended with error before any assistant message; no running worker owns this worktree.
Owned files and prohibitions: original issue-34-answer-integrity.md below. Tests: npm test; npm run typecheck; npm run build. Dependencies may be symlinked from root; no environment copying or database registration.
Preflight authoritative at dispatch: do not repeat git status/pwd/ls startup discovery; targeted inspection allowed for pre-commit, action failure or stale resume.
Do not touch web/**, service/**, shared skills, credentials, opencode.db, installed extension, real GitHub, master or other worktrees. No push, merge, issue closure or production changes.
</env_preflight>
<goal>
Recover the failed-start #34 task and prove answering saves to exactly the question the person saw or fails visibly.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-answer-integrity.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/issue-34-worker-failure.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Perform the original issue-34-answer-integrity.md scope unchanged, with this clarification: explicit HTTP rejection restores local state; transport loss after a write was sent has UNKNOWN remote outcome and must not be called failed or repeated automatically. Any displayed optimistic answer must be reconciled or marked unconfirmed, never shown as confirmed. Exact identity compares source question text including Markdown link destinations, case and punctuation, not display/stripped text. If two unresolved questions have identical source text, refuse ambiguity rather than guess. Do not add the #31 hash/generation system in this bugfix.
The preceding child made no implementation attempt; this is recovery, not permission to widen scope. If startup tooling fails, return the actual error promptly rather than inventing success or bypassing a denial.
</scope>
<criteria>
Original four paths get red-before/green-after evidence if reproduced; changed/withdrawn/already-answered/ambiguous question refuses; all three UI entry points share the corrected save path; no false success, no automatic repeat; full suite, types/build green and bundle parity. A separate hostile review is mandatory after your work.
</criteria>
<output>
Commit code/tests/proof only in this worktree. Write .agents/run/task-centred-architecture/outputs/issue-34-answer-fix.md. Return at most 12 lines: commit, reproduced/not-reproduced paths, red/green proof, test counts, bundle parity, remaining blind spots, actual provider/model (unverified if unavailable). Never close #34.
</output>
