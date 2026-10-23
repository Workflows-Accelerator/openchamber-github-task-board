<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board; base feat/v2-binding-and-ratelimit at 7013bd9. Newly created clean worktree; root checkout has unrelated untracked run files and an active panel fix in another worktree; do not touch either.
Files owned: new web/** (server, page, tests, README), plus reuse-by-import of panel/core.ts pure logic. Do not edit panel/**, service/**, test/**, package.json, tsconfig.json or any existing file unless a one-line additive change is strictly required (report it instead).
Tests: node --test web/**/*.test.js (or .mjs); build/typecheck commands you define inside web/; a local browser run with synthetic fixtures.
Do not touch: credentials or credential files, opencode.db, host settings, installed extension, production, DNS/TLS/proxy, remote issues, branches, master. No deployment, no push. Symlink root node_modules if needed; add no new runtime dependencies if the Node standard library suffices.
Preflight facts authoritative; targeted checks permitted for edits/precommit/resume/errors.
</env_preflight>
<goal>
Deliver a working single-user standalone board server and page at a domain-ready build, which reads and edits the same GitHub issues as the extension, holds GitHub credentials only server-side, and offers no agent control.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/27
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/continuation.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/frontend/frontend-ui-engineering/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/browser/playwright-verification/SKILL.md]
</skills>
<scope>
Single-user deployment. Configuration from environment only: BOARD_GITHUB_TOKEN (fine-grained, one repository), BOARD_GITHUB_LOGIN (expected account), BOARD_REPO (owner/name), BOARD_PASSWORD_HASH or BOARD_PASSWORD for first-run hashing at startup, BOARD_PORT, BOARD_SESSION_SECRET, optional BOARD_BASE_URL. Refuse to start with a missing/invalid configuration and say which variable is missing, never print a value.
Auth: browser posts the board password over HTTPS; server compares in constant time (scrypt with per-deployment salt) and issues an httpOnly, SameSite=Strict, Secure session cookie plus a CSRF token bound to the session. Rate-limit failed logins with a small in-memory limiter; do not implement account lockouts that can wedge the owner out. Sessions expire. No password or token in localStorage, URL, HTML, meta tags or logs. Redact Authorization and cookie headers in any log line.
Identity enforcement: at startup verify the token's account via GitHub /user and match BOARD_GITHUB_LOGIN; verify /repos/{owner}/{repo} access; refuse to serve otherwise. Every request revalidates the repository against the allowlist; never accept a repository from the client.
Read: list issues with pagination, normalize PRs out, expose the fields the board already parses. Reuse panel/core.ts pure parsing, identity and attention functions by import; do not copy them, and do not import panel/main.ts.
Write: allow editing an issue body section and toggling a status label. Before writing, GET the issue and compare a strong fingerprint (ETag or body hash) supplied by the client from the read it edited; refuse with a clear conflict response if changed. Body edits must preserve all other sections byte-for-byte; reuse the existing section-scoped parsing. Never close issues, never change human checkboxes, never touch labels other than the agreed status set, never write when uncertain.
Page: server-rendered or static shell plus small client script; no framework requirement. Lists tasks (title, state, phase, attention, freshness), opens one task, edits the body text of the agreed sections, answers an open question inline, changes status. Explicitly no agent-start or session-open controls and no live agent activity. Keyboard accessible, no horizontal scroll at 360px, visible focus, plain states for empty/error/stale/conflict. Reuse the extension's visual language by reading its CSS tokens rather than inventing a new look.
Tests: unit + integration with a local fake GitHub server (synthetic, no real token) covering unauthenticated denial, wrong password, rate limit, session expiry, missing/invalid config refusal, wrong account, cross-repository refusal, PR exclusion, pagination, conditional write success, concurrent-edit conflict, preserved sections, CSRF rejection, no token in HTML/JS/logs. Then a real browser session (Obscura or Playwright if available) against the fake server, with screenshots at desktop and 360px; label synthetic-fixture proof clearly. If browser tooling is unavailable, record NOT RUN rather than claiming visual proof.
Keep the server dependency-free where possible; if a dependency is unavoidable, justify it and add it only under web/.
</scope>
<criteria>
Starts only with valid config; denies all data without a session; only the configured account and repository are usable; credentials never reach the browser or logs; reads and conditional writes behave on the fake server; conflict refuses rather than overwrites; existing sections preserved; no agent control; accessible and responsive page verified in a real browser with screenshots; tests, typecheck/build green. Honest NOT RUN list for anything not executed.
</criteria>
<output>
Commit on the feature branch. Write web/README.md with configuration, how to run, and the security model. Report .agents/run/task-centred-architecture/outputs/issue-33-standalone-board.md with what changed, exact commands and results, screenshot paths, residuals and supplied/actual model. Return <=15 lines. Do not deploy, push, close the issue or touch the extension host. Independent hostile review follows.
</output>
