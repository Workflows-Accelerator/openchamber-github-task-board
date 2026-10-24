<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity, created from feat/v2-binding-and-ratelimit at dd5cb2f (#28 and #36 merged). Clean at dispatch.
Owned: panel/core.ts (question answer functions only), panel/main.ts (answer entry points, reloadIssueBeforeMutation/updateIssueBody only as needed), generated panel/main.js, tests, .agents/run/task-centred-architecture/ report and verifications/issue-34/.
Tests: npm test; npm run typecheck; npm run build. Symlink /workspace/extensions/github-task-board/node_modules if missing. No env copying, no DB registration.
Do not touch: web/**, service/**, shared skills, credentials, opencode.db, installed extension, real GitHub, master, other worktrees. No push, merge or close. Synthetic fixtures only (shipped-bundle harness).
Efficiency: grep for resolveOptimisticQuestionAnswer, answerOpenQuestionInMarkdown, reloadIssueBeforeMutation, updateIssueBody; read only those regions.
</env_preflight>
<goal>
Answering a question saves the answer to the exact question the person saw, or fails visibly. Success is never shown for an unwritten or misdirected answer.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/34
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/outputs/draft-issue-answer-integrity.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Bug path: reproduce first, surgical patch, regressions.
1. Reproduce with failing tests on dd5cb2f, one per path: (a) wrong-question fallback in resolveOptimisticQuestionAnswer; (b) success toast without result.found in Questions view and drawer; (c) failed fresh read continuing on cached body; (d) failed PATCH keeping the new local body. If a path cannot be reproduced, say so and do not fix it hypothetically.
2. One shared answer path used by all three entry points (Questions view, drawer, Human Tasks). Before writing: fresh read required (abort with visible error if it fails); the question must still exist unresolved with exactly the text the person saw (case-preserving exact match, no fallback to another question) — otherwise refuse and show the current text (owner decision D3). Never match by stripped link text.
3. Write is best-effort: on PATCH failure restore the previous body and show the failure. If the outcome is ambiguous (network error after send), show "outcome unknown — check the issue on GitHub" and never repeat automatically. No atomic claims in code or messages.
4. Answering must not change workflow phase or close anything; do not alter #36 guards.
No new identity scheme (content hash / generation counter is #31 later work). No unrelated refactors.
</scope>
<criteria>
Each reproduced path: test fails before, passes after. Full suite, typecheck, build green; panel/main.js matches a fresh build; diff limited to answer paths.
</criteria>
<output>
Commit on fix/issue-34-answer-integrity. Report .agents/run/task-centred-architecture/outputs/issue-34-answer-fix.md plus verifications/issue-34/. Return at most 12 lines: commit, paths reproduced (or not), what changed, red-first evidence, test counts, bundle sha256, actual model. A fresh hostile review follows.
</output>
