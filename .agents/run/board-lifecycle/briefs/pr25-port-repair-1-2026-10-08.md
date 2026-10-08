<goal>
Fix the two hostile review findings on branch fix/issue-page-size-fallback:
- F-01 (Moderate): Narrow isOversizedAnswer so it only triggers on actual JSON truncation phrases or code RESPONSE_TOO_LARGE, preventing unnecessary retries on generic SyntaxErrors (such as HTML error bodies).
- F-02 (Low): Ensure If-None-Match / ETag conditional headers are stripped when retrying page 1 at the smaller page size, so a 304 against the 100-item ETag does not falsely apply to a 20-item request.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-pr25-pagesize-port/.agents/run/board-lifecycle/verifications/pr25-port-2026-10-08/l4-review.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/pr25-pagesize-port-2026-10-08.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<context>
Working directory: /workspace/extensions/github-task-board/.worktrees/team-dev-pr25-pagesize-port (branch fix/issue-page-size-fallback @ 68561e6).
You are repair iteration 1 of 2. Read l4-review.md first for exact details.
Findings:
- F-01 (Moderate): isOversizedAnswer currently treats any SyntaxError as an oversized answer. If a proxy or API gateway returns an HTML error page (e.g. 502 Bad Gateway with <!DOCTYPE html>), JSON.parse throws a SyntaxError ("Unexpected token < in JSON at position 0"), causing an unintended retry at per_page=20.
  Fix: Check err.message for truncation indicators (e.g. "Unterminated", "Unexpected end of JSON", or matching JSON truncation regex like /position \d+/) or err?.code === 'RESPONSE_TOO_LARGE'. A parse error at position 0 or syntax error on non-truncated content must return false.
- F-02 (Low): When retrying page 1 with per_page=20 after an oversized error, any stored ETag or If-None-Match header must not be sent on the resized retry (a 304 against the old 100-item page cache must not satisfy a 20-item request).
  Fix: Ensure the read at pageSize=20 does not pass conditional headers from the 100-item request.

Gates:
- npm run typecheck (0 errors)
- npm run build (rebuild panel/main.js, byte parity clean)
- node --test test/*.test.js (expect 302 + new test cases, 0 failures)
- One commit per concern or single clean fix commit.
</context>
<scope>
WRITE: panel/core.ts, panel/main.ts, panel/main.js (rebuilt bundle), test/issue-page-size.test.js.
MUST NOT: package.json (keep 1.2.0), README.md, any other files. No git push, no master.
</scope>
<criteria>
1. F-01 red/green: Test with HTML error body ("<!DOCTYPE html>...") -> isOversizedAnswer returns false, no retry. Test with truncated JSON -> returns true, retries at 20.
2. F-02 red/green: Test that resized retry does not pass If-None-Match header.
3. Gates clean: 0 typecheck errors, bundle byte-parity clean, all tests passing.
</criteria>
<output>
At most 10 lines: F-01 and F-02 status, red/green evidence lines, exact gate counts, commit SHA, and final tree state.
</output>
