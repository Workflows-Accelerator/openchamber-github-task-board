<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-40-quick-add
Branch: feat/issue-40-quick-add
Base commit: 48d1fb29b1bf503e4e9b64b792d5c8cc5d9f132b
Goal: Implement Issue #40: Frictionless Quick-Add Tasks as Drafts without Launching Sessions across both the OpenChamber panel and standalone web board.
Commands:
- In worktree root: npm run build ; npm test ; node --test web/tests/*.test.mjs ; npm run typecheck ; npx tsc -p web/tsconfig.json ; node --test test/shipped-parity.test.js
Guardrails:
- Zero automatic agent sessions on quick-add. Never call host.startSession or launch AI agent sessions.
- Strictly adhere to Zero-Emoji policy across all code, markup, titles, and comments.
- Never log, print, or leak secret token or password values.
</env_preflight>

<skills>
[@/workspace/config/opencode/.agents/skills/build/methodology/lean-build/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>

<goal>
Build Issue #40 so the user has an instant, frictionless brain-dump flow for tasks:
1. OpenChamber Panel (`panel/index.html`, `panel/main.ts`):
   - Add a clean, prominent Quick-Add input bar at the top of the Draft column (and/or toolbar):
     - Input placeholder: "Quick add draft... (press Enter)"
     - Pressing Enter calls `githubRequestWithRetry('POST', '/repos/' + targetRepo + '/issues', { title, labels: ['status:draft'] })`.
     - Immediately adds the new issue to `issues` state and updates the Draft column view without full-page reloads.
     - Input clears and remains focused for rapid multi-item entry.
     - ZERO agent sessions spawned (`host.startSession` is NEVER called on quick-add).
   - In the New Issue modal (`openNewIssueModal`), change the default tab from 'ai' to a frictionless direct creation so it never launches sessions unexpectedly.
   - Clean up the toolbar creation UI so it is straightforward and not a conflicting dual button / dropdown.
2. Standalone Web Board Backend (`web/server/app.ts`):
   - Add endpoint `POST /api/repos/:owner/:name/issues`:
     - Requires authenticated session + valid CSRF header (`x-csrf-token`).
     - Validates repository via `repositoryRegistry.view()`.
     - Parses JSON body `{ title, body, labels }`.
     - Defaults labels to `['status:draft']` if omitted.
     - Calls `githubClient.request('POST', '/repos/:owner/:name/issues', ...)`.
     - Returns `{ ok: true, issue: normalizedIssue }` with status 201.
     - Defends against empty titles (400), malformed bodies (400), and rate-limit exhaustion (429).
3. Standalone Web Board UI (`web/public/index.html`, `web/public/app.js`):
   - Add Quick-Add input bar above the board or at the top of the Draft column:
     - Placeholder: "Quick add draft... (press Enter)"
     - On Enter: sends `POST /api/repos/:owner/:name/issues` with CSRF header.
     - Optimistically/immediately appends the card into the Draft column.
     - Zero agent sessions or redirects.
4. Comprehensive Automated Tests:
   - Add unit tests in `web/tests/app.test.mjs` covering:
     - Successful draft creation via `POST /api/repos/:owner/:name/issues`.
     - 401 unauthenticated and 403 CSRF rejection.
     - 400 empty title validation.
     - Defaulting to `status:draft`.
   - Add unit tests in `test/` for panel quick-add logic verifying zero session dispatch.
   - Verify `npm test`, `web/tests/*.test.mjs`, `npm run typecheck`, and `test/shipped-parity.test.js` all pass.
5. Build and commit:
   - Run `npm run build` so `panel/main.js` and `service/main.js` are rebuilt cleanly.
   - Commit with a clean conventional commit.
</goal>

<scope>
1. Edit `panel/index.html` and `panel/main.ts`:
   - Add quick-add input element and keydown handler.
   - Ensure optimistic rendering into Draft column.
   - Rebuild panel bundle: `npm run build:panel`.
2. Edit `web/server/app.ts`:
   - Implement `POST /api/repos/:owner/:name/issues` handler with CSRF and auth.
3. Edit `web/public/index.html`, `web/public/app.js`, `web/public/theme.css`:
   - Add quick-add input element and submit logic.
4. Add regression tests in `web/tests/app.test.mjs` and `test/`.
5. Run full test gates and typechecks.
6. Commit changes.
</scope>

<criteria>
Quick-add works in both panel and web board; pressing Enter immediately creates a status:draft issue; zero agent sessions are spawned; all tests pass; 0 typecheck errors; zero emojis.
</criteria>

<output>
At most 10 lines:
Files modified; test pass counts; typecheck exits; commit hash.
</output>
