<goal>
Conduct a hostile review of the PR #25 port repair-1 changes on branch fix/issue-page-size-fallback in this worktree:
- F-01: Verify isOversizedAnswer was narrowed so generic SyntaxErrors (like HTML error responses) DO NOT trigger an unwanted retry, while genuine JSON truncation and RESPONSE_TOO_LARGE do.
- F-02: Verify that when retrying page 1 at per_page=20, If-None-Match headers are stripped so an old 100-item ETag does not falsely produce a 304 on a 20-item request.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-pr25-pagesize-port/.agents/run/board-lifecycle/verifications/pr25-port-2026-10-08/l4-review.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/pr25-port-repair-1-2026-10-08.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/quality/code-review-and-quality/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<context>
Working directory: /workspace/extensions/github-task-board/.worktrees/team-dev-pr25-pagesize-port (branch fix/issue-page-size-fallback).
Scope is narrow: F-01 and F-02 fixes in panel/core.ts, panel/main.ts, panel/main.js, test/issue-page-size.test.js.
Audit criteria:
1. F-01: Probe isOversizedAnswer with:
   - "<!DOCTYPE html><html><body>502 Bad Gateway</body></html>" (SyntaxError) -> must return FALSE
   - "{\"error\": \"not found\"" (truncated JSON SyntaxError) -> must return TRUE
   - SyntaxError with message "Unterminated string in JSON at position 256000" -> must return TRUE
   - Error with code: 'RESPONSE_TOO_LARGE' -> must return TRUE
   - Generic TypeError or NetworkError -> must return FALSE
2. F-02: Probe page 1 retry with an ETag/If-None-Match passed in. Verify the second request (at pageSize=20) does not send If-None-Match.
3. Gates: npm run typecheck (0 errors), npm run build, git diff --exit-code panel/main.js (byte parity clean), node --test test/*.test.js (all pass, 0 fail).
</context>
<scope>
WRITE ONLY (evidence): .agents/run/board-lifecycle/verifications/pr25-port-2026-10-08/l4-review-2.md.
MUST NOT: edit production code, push, touch master.
</scope>
<output>
At most 10 lines: verdict (PROCEED / HALT), findings count, F-01 & F-02 probe results, exact gate counts, and commit SHA.
</output>
