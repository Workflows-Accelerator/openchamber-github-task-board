<env_preflight>
Repo: /workspace/config/opencode
Worktree: /workspace/config/opencode/.worktrees/team-dev-issue-29-task-context
Branch: docs/issue-29-task-context; HEAD 04007e3. Clean per reviewer.
Files: agent-prompts/dynamic/dynamic-agent.md only.
Tests: node --test tests/config-shape.test.mjs tests/w2-rules.test.mjs tests/phase1-quick-wins.test.mjs
Do not touch: any other file, opencode.json, credentials, opencode.db, host settings, live config root, master, remote issues. No push, no DB registration.
Preflight facts authoritative.
</env_preflight>
<goal>
Apply the single remaining sentence fix and stop the wording loop.
</goal>
<context_files>
[@/workspace/config/opencode/.worktrees/team-dev-issue-29-task-context/.agents/run/issue-29-task-context/exception-review-2.md]
</context_files>
<scope>
In agent-prompts/dynamic/dynamic-agent.md around line 27, replace the wording that equates the envelope's permission limits with an instruction or authorization, with exactly this meaning: permission limits are ceilings, never instructions. Then scan the same file for any other sentence with the same equivalence and fix only those.
Also make the two PARTIAL scope points concrete with the smallest wording: scope may not be widened by a later body edit either (the worker's baseline is the issue revision it fetched, and a change after that must be reconciled or stopped), and dependency installation or any new external dependency is covered by the same refusal list as push/deploy.
Do not add review cycles, sections or restructure. Record the sentence diff in the migration addendum.
</scope>
<criteria>
The equivalence is gone; ceilings-only wording present; body-edit scope widening and dependency installation explicitly refused; no other semantic change; cited tests pass; diff limited to that file plus the addendum.
</criteria>
<output>
Commit. Return <=10 lines: sentences changed, test results, commit. No merge, push or activation.
</output>
