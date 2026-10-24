<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board at a795985. Review range: ef1b78d..a795985 (earlier security review was at ef1b78d).
Tests: web test suite, npm test, tsc, build; Obscura browser check as the remediation used. Synthetic GitHub fakes only.
Do not touch: panel/**, shared skills, credentials, opencode.db, production, master, other worktrees. No push, merge, close, deployment, live credentials. Never read or reuse voice-page authentication.
</env_preflight>
<goal>
One bounded, independent hostile re-review: are the owner decisions implemented truthfully and did the remediation break anything?
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-2026-10-24.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/tasks/issue-33-amendment-v2.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-remediation.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
</skills>
<scope>
You did not write this. Assume claims are false until shown.
1. Writes: prove there is no automatic retry/re-apply on any write path (read every fetch/PATCH call site and its error handling). Prove the pre-save conflict check refuses a changed issue. Prove an ambiguous outcome shows "unknown" and is not repeated. Prove the overwrite warning is visible next to editing controls and in README.
2. F2 rate limit: cooldown ≤60s, no accumulating or permanent lockout, bounded memory under many addresses, authenticated sessions unaffected during cooldown, no forwarded-header trust by default. Attack it (many IPs, many attempts, concurrent logins).
3. Security regression check of the diff: credentials never reach the browser or logs, CSRF, session cookie flags, XSS in rendered issue text, path traversal in static serving, token scope to one repository.
4. Verify each F4–F10 "CLOSED" claim at HEAD with file:line evidence.
5. Note any deployment blocker you see (e.g. loopback-only bind) without fixing it.
Fix nothing except a trivially correct defect (separate commit + test); report the rest.
</scope>
<criteria>
Verdicts: Security PASS/NEEDS-FIXES, Spec (owner decisions) PASS/PARTIAL, findings ranked High/Medium/Low with file:line. Test counts reproduced.
</criteria>
<output>
Write .agents/run/task-centred-architecture/outputs/issue-33-rereview.md in the worktree and commit. Return at most 12 lines: verdicts, findings, test counts, any commit, actual model.
</output>
