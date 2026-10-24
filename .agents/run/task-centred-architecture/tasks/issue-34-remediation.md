<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity
Branch: fix/issue-34-answer-integrity. Base dd5cb2f; builder 309f9f1; first independent review 7accbf8. Worktree may hold review commits only. No worker may be editing when this starts; the manager confirms both reviewers finished before dispatch.
Owned: panel/core.ts (question answer functions only), panel/main.ts (answer path, updateIssueBody/reloadIssueBeforeMutation, dependency add/remove handlers, save-button in-flight guards), generated panel/main.js, tests, .agents/run/task-centred-architecture/ report and verifications/issue-34/. Nothing else.
Tests: node --test test/issue-34-answer-integrity.test.js; npm test; npm run typecheck; npm run build. Root node_modules symlink. No env copying, no DB registration.
Do not touch web/**, service/**, shared skills/config, credentials, opencode.db, installed extension, real GitHub, master or other worktrees. No push, merge, issue closure or deployment. Synthetic harness only.
Preflight authoritative; targeted state checks allowed for commit verification.
</env_preflight>
<goal>
Close the five independent-review findings so no answer path can show success or a definite failure when the remote outcome is uncertain.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-34-answer-integrity/.agents/run/task-centred-architecture/outputs/issue-34-answer-fix.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-34-hostile-review-v2.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
</skills>
<scope>
Test first for each finding; reproduce with the named reviewer probe, then fix. Findings from review 7accbf8 (read its committed report):
1. High — post-send 5xx/gateway errors are treated as a definite rejection. Any failure that can occur after the request was sent (5xx, gateway/proxy error, response parse failure, timeout, abort, readback failure) is UNKNOWN: no rollback presented as truth, no "failed" wording, no automatic repeat. Only a definitive pre-commit rejection (validation 422, auth/permission 401/403, explicit 4xx that cannot be post-commit) may restore the previous state and report failure. State the classification rule in one comment and test each class.
2. Medium — on a changed or deleted question in a multi-question issue, the D3 message shows currentOpen[0], which may be a different question. Show the exact current text only when the same question is identified; otherwise say the question changed and refresh the view without presenting another question as if it were the one answered.
3. Medium — dependency add/remove ignores updateIssueBody's result and toasts success. Make every such caller honor the result: success only on confirmed apply; unknown on ambiguous; visible failure otherwise.
4. Medium — after an ambiguous outcome the restored local body is presented as confirmed and further writes can proceed. Mark the issue visibly unconfirmed, block dependent writes until a successful refresh reconciles it, and clear the marker on reconciliation. Never auto-repeat the ambiguous write.
5. Medium — save/answer controls lack in-flight disabling, so a double click can send two mutations and two toasts. Disable the control (and ignore re-entry) until the operation settles, then restore it. Test the second click produces no second request.
Also check other callers of updateIssueBody in the same answer/edit family for the same false-success pattern; fix only those that can show success without a confirmed apply, and list them.
No new question-identity/hash system; no #31 work; no unrelated refactor; keep #36 human-close guards.
</scope>
<criteria>
Each finding: test fails before, passes after. Exactly one request per user action. No automatic retry. No success without confirmed apply; no definite failure wording when outcome may be unknown. Full suite, typecheck, build green; panel/main.js matches a fresh build.
</criteria>
<output>
Commit on fix/issue-34-answer-integrity. Append to the existing report with a per-finding table keyed to the review. Return at most 12 lines: commit, per-finding status, red/green evidence paths, other callers fixed, test counts, bundle sha256, remaining blind spots, actual provider/model. One final bounded hostile pass follows; no merge.
</output>
