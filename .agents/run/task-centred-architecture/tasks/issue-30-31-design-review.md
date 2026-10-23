<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design
Branch: docs/issue-30-31-design; HEAD 12c4dc8; proposal at .agents/run/issue-30-31-design/proposal.md (471 lines). Tracked state clean at start except your report.
Files: proposal is the artifact under review. Product source is read-only reference (panel/core.ts, panel/main.ts, panel/labels.ts, panel/types.ts, docs/issue-body-contract.md, service/main.ts, installed SDK/host files cited in the proposal).
Tests: none mandatory; if you reproduce a claimed defect, use disposable probes under /tmp/opencode and record the command and output. Do not add repo tests.
Do not touch: product code, docs/, test/, package.json, other worktrees/branches, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, root checkout. No push, no issue edits.
</env_preflight>
<goal>
Independently falsify the #30/#31 design before any of it is built, and grade whether its source claims, its defect findings and its three decisions are trustworthy.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/30
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/31
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/proposal.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/architecture/spec/spec-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/meta/composition/context-engineering/SKILL.md]
</skills>
<scope>
Review-only. Do not improve or rewrite the proposal; find what is wrong, overstated or missing.
1. Verify every [EXISTS] anchor against the actual files at HEAD: parseOpenQuestions and its fallback, parseHumanTasks, collectHumanTodos precedence, answerOpenQuestionInMarkdown (including newline collapse), appendOpenQuestionToMarkdown, resolveOptimisticQuestionAnswer (the wrong-question/completed-fallback defect), reloadIssueBeforeMutation returning null and callers continuing, updateIssueBody setting body before PATCH and keeping it on failure, the three answer UI copies ignoring result.found, setBadge semantics and clearing, host.storage scope, the emit-route and built-in notification claims, resolveV2Metadata/groupIssuesByAttention, the eight statuses and closure rule. Line numbers may drift: verify behaviour, not the number.
2. Reproduce, with a disposable probe or an existing test harness, at least: (a) an answer written to the wrong question via the completed-question fallback, and (b) a success toast on a write that did not happen or a body kept after a failed PATCH. If either cannot be reproduced, say so and downgrade the claim to source-reading.
3. Attack the Work Type proposal: backward compatibility with existing issues (absence), whether absence-becomes-a-question floods the human queue, conflict with GitHub native issue types, contract versioning cost, and whether the four claimed behaviour changes are the real set.
4. Attack question identity: FNV-1a 8-hex collision risk at realistic question counts, normalization collisions (two genuinely different questions normalizing the same), non-ASCII and markdown-link handling, identical-question dedupe, and the false-rejection rate when a typo is fixed. Is content-hash identity actually better than a stable marker, given every writer is ours?
5. Attack the answer flow as a lost-update fix: a fresh GET followed by a body PATCH still has a race window. Verify whether GitHub truly refuses If-Match/conditional unsafe writes, and state precisely what residual overwrite risk remains after this design. If the proposal overclaims that it closes lost updates, say so with evidence.
6. Attack the notification loop: whether host.setBadge really reaches a user with the panel closed, whether it is global or session-scoped, dedupe in host.storage across windows/devices, toast flood, and whether "no reliable channel" is the honest conclusion. Check the resume path for prompt loops, duplicate resumes and authority overreach (an answer must not authorize more than the question).
7. Verify the worked examples and historical claims against git history (commits, file counts, test counts, the task-204 review line cited). Flag anything fabricated or misremembered.
8. Check #30 and #31 acceptance criteria coverage, the honest handling of expiration, and whether the change table omits a required layer or hides effort. Judge the three decisions: are they the only genuine product forks, are the options real, and is each recommendation defensible?
</scope>
<criteria>
Two verdicts: Design PASS/FAIL/PARTIAL against #30 and #31; Evidence APPROVED/NEEDS-FIXES for its source claims and defect findings. Severity (Critical/High/Moderate/Low) for every defect, exact file:line anchors, reproducible evidence. Separate proven from suspected. State which of D1, D2, D3 you would change and why, but do not invent new product decisions. Do not infer implementation approval, merge or closure.
</criteria>
<output>
Commit only .agents/run/issue-30-31-design/review.md in this worktree. Do not edit the proposal or product code; do not merge, push, comment on issues, close or deploy. Return at most 15 lines: verdicts, the anchor errors and defect claims that survived or failed, residual lost-update risk, decision critique, commit, actual and supplied model.
</output>
