<goal>
Fix the F-01 over-narrowing finding in isOversizedAnswer on branch fix/issue-page-size-fallback (iteration 2 of 2).
Ensure isOversizedAnswer correctly recognizes all V8 JSON truncation SyntaxError messages (including mid-array and mid-object truncations) while still rejecting non-truncation errors (like HTML error responses).
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-pr25-pagesize-port/.agents/run/board-lifecycle/verifications/pr25-port-2026-10-08/l4-review-2.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/build/refactoring/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<context>
Working directory: /workspace/extensions/github-task-board/.worktrees/team-dev-pr25-pagesize-port (branch fix/issue-page-size-fallback @ 001791a).
You are repair iteration 2 of 2 for the PR #25 port.
In iteration 1, the fix for F-01 over-narrowed the truncation check: it looked for "position 256000" or narrow patterns, which caused V8 truncation errors to return false:
- Probe: `JSON.parse('{"error": "not found"')` throws: `SyntaxError: Expected ',' or '}' after property value in JSON at position 21` -> returned false (must return TRUE!)
- Truncated arrays like `JSON.parse('[{"id": 1}, {"id": 2')` throw: `SyntaxError: Expected ',' or ']' after array element in JSON at position ...` -> must return TRUE!

The requirement for `isOversizedAnswer(err: any): boolean`:
1. Return TRUE if `err?.code === 'RESPONSE_TOO_LARGE'`.
2. Return TRUE if `err instanceof SyntaxError` AND the error message indicates JSON truncation/premature end of input:
   - "Unterminated string"
   - "Unexpected end of JSON input"
   - "Unexpected end of input"
   - "after property value" (e.g. "Expected ',' or '}' after property value")
   - "after array element" (e.g. "Expected ',' or ']' after array element")
   - Or regex matching: `/(?:unterminated string|unexpected end of (?:json )?input|expected (?:','|'\}'|'\]') after (?:property value|array element))/i`
3. Return FALSE for non-truncation SyntaxErrors, such as:
   - HTML error responses: `JSON.parse('<!DOCTYPE html>...')` -> "Unexpected token '<', "<!DOCTYPE "... is not valid JSON" -> returns FALSE.
   - Malformed JSON that is not a truncation: `JSON.parse('{"a": undefined}')` -> returns FALSE.
   - Any non-SyntaxError without code 'RESPONSE_TOO_LARGE'.

Gates:
- npm run typecheck (0 errors)
- npm run build (rebuild panel/main.js, byte parity clean)
- node --test test/*.test.js (all pass, 0 fail)
- One clean commit.
</context>
<scope>
WRITE: panel/core.ts, panel/main.ts (if needed), panel/main.js (rebuilt bundle), test/issue-page-size.test.js.
MUST NOT: package.json (keep 1.2.0), README.md. No push, no master.
</scope>
<criteria>
1. All probe cases pass:
   - `{"error": "not found"` -> isOversizedAnswer returns TRUE.
   - `[{"id": 1}, {"id": 2` -> isOversizedAnswer returns TRUE.
   - `"Unterminated string in JSON at position 256000"` -> isOversizedAnswer returns TRUE.
   - `code: 'RESPONSE_TOO_LARGE'` -> isOversizedAnswer returns TRUE.
   - `<!DOCTYPE html><html><body>502 Bad Gateway</body></html>` -> isOversizedAnswer returns FALSE.
   - `{"invalid": foo}` -> isOversizedAnswer returns FALSE.
2. Gates clean: 0 typecheck errors, byte parity clean, full test suite green.
</criteria>
<output>
At most 10 lines: F-01 status, all probe test results, exact gate counts, commit SHA, and final tree state.
</output>
