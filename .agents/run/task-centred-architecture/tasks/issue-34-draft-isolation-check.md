<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch fix/issue-34-answer-integrity at 72f3f76; clean after final review; no active worker. Base a8f55c2 product. #34 final review passed, do not repeat its seven checks.
Key source: panel/main.ts:2268-2297 saveQuestionDraft/getQuestionDraft/clearQuestionDraft; all call sites around Questions/Human Tasks/Drawer and repoForIssue. test/test-app-harness.js synthetic host supports All Projects fixtures.
Tests: focused disposable node --test probe; existing node --test test/issue-34-answer-integrity.test.js if needed. Shared root node_modules symlink. No installs.
Own writes ONLY .agents/run/task-centred-architecture/outputs/issue-34-draft-isolation-check.md and verifications/issue-34-draft/**. Source read-only; disposable probes /tmp/opencode. No real GitHub, installed extension, web/service, credentials, other worktrees, master, push/merge/deploy/issue closure.
Facts authoritative; skip startup git status/pwd/ls. Targeted checks allowed for action failure or commit verification.
</env_preflight>
<goal>
Independently prove or disprove whether the new draft cache leaks an answer between repository-qualified issues or unrelated questions.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-final-hostile.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You did not implement this. Manager diff inspection found keys `${issueNumber}::${questionText}` plus fallback `issue::${issueNumber}` with no repo. This is a hypothesis, not a defect verdict. Obtain empirical proof through real render functions in synthetic host harness:
A. repo A issue #1 and repo B issue #1, identical question text. Type a distinctive draft on A; switch/open B in All Projects or repo switch. Does A text populate B? Can clearing/success on B delete A draft? Preserve existing repoForIssue identity.
B. One issue with unrelated Q1 and Q2. Type Q1 draft; rerender/open Q2. Does generic issue fallback prefill Q2? Can success clearing Q2 erase Q1 fallback or retain stale exact entry?
C. After exact original question disappears/changed, can draft be preserved in a clearly identified orphan draft without guessing which current question owns it? Current behavior only, no fix design beyond minimum correction.
D. Briefly check the two added userLayoutPreference assignments in renderHumanTasksView/renderQuestionsView: are they necessary and do they change unrelated rendering? Only report a real reproduced regression, not stylistic nits.
Do not rerun completed full suite or all seven old probes. Fix nothing, even tests in product. Rank only demonstrated findings; reference inputs, DOM/results and minimal correction.
</scope>
<criteria>
Spec PASS/PARTIAL/FAIL; Quality APPROVED/NEEDS-FIXES for draft isolation only. Empirical reproduction or explicit disproval of each hypothesis. Plain minimum scope if broken, no new identity/history architecture.
</criteria>
<output>
Commit report/probe evidence only. <=10 line return: findings/verdicts, exact reproduction outcomes, report commit, blind spots, actual provider/model. Never merge or edit product.
</output>
