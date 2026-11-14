<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Mode: READ-ONLY. Write ONLY under `.agents/run/chamberos-board-v2/verifications/extension-security/`.
Forbidden: never edit source, never read or print `board.env`, `jwt-secret`, tokens, passwords or cookies, never push, never restart the board, never spawn subagents.
</env_preflight>

<goal>
Threat-model the three additions before they are built, and return a list of non-negotiable constraints for the implementation. Assume an attacker can render arbitrary HTML in a chat page and can call any service route the extension exposes.
</goal>

<checklist>
1. Read the extension's current security posture: `package.json` `openchamber` block (capabilities, origins, integration, filesystem), `service/main.ts` (routes, auth check, token handling), `panel/main.ts` (how it authenticates to GitHub today, where the token lives).
2. **New route `POST /snapshot`.** A sandboxed page can post anything to it. Define: maximum body size, required shape validation, what happens on malformed input, whether it may write to disk, where (must be outside the package, under the user's home), what file mode, and how the service avoids a page overwriting the owner's data with garbage or with a fake "0 needs me" that hides real work. Consider: does a forged snapshot mislead the owner in a way that costs them something?
3. **`GET /status`.** It is polled while a section is visible and returns rows the app draws. Check: can a snapshot inject markup into a row label (the app draws rows, so text should be inert — prove it), can it leak a token or a repo name the user did not intend, and does the response carry anything sensitive when unauthenticated (the bearer check applies to `/status` too).
4. **`marks`.** `keepRunning: true` means a long-lived process. What does that cost, what does it expose, and can a mark leak issue titles to a tooltip on a row the owner did not open? Decide whether mark text should carry a title or only a count.
5. **`instructions` and `skills`.** Text an agent reads on every session: check for prompt-injection surface (can an issue title from GitHub end up in the instructions text?), token cost, and whether the skill can be made to act on untrusted issue content.
6. **`sessionEvents`/`sessionControl` (wave 3 preview).** List the minimum permission set needed and the failure mode if the service is offline.
7. Produce a table: risk | likelihood | impact | required mitigation | test that proves it. Then list the invariants an implementation must not violate.
8. Write `.agents/run/chamberos-board-v2/verifications/extension-security/README.md` and commit only that directory.
</checklist>

<output>
At most 14 lines: TOP_RISKS (max 5, one line each), REQUIRED_MITIGATIONS (numbered), SNAPSHOT_RULES (size/shape/storage/mode), MARK_TEXT (title allowed? yes/no + why), INJECTION (verdict), SESSION_EVENTS_MIN (permissions), INVARIANTS, COMMIT, NOT_VERIFIED.
</output>
