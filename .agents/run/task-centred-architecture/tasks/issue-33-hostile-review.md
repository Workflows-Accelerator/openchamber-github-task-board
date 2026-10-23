<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board; HEAD 5ac82c2 (docs); code af62a4e; base c436dbf. Builder reports 68/68 web tests, tsc, esbuild and a 29-check Obscura browser run with 10 screenshots.
Files under review: web/** (server.ts, server/{config,auth,github,board,sections,app}.ts, public/index.html, public/app.js, public/theme.css, tests/**, tools/hash-password.mjs, README.md, dist/server.mjs), outputs/issue-33-standalone-board.md, verifications/issue-33-standalone-board/screenshots/**.
Tests: node --test web/tests/*.test.mjs; npx tsc -p web/tsconfig.json; the esbuild bundle command in web/README.md or package scripts; node web/tests/browser-verify.mjs if Obscura is available.
Do not touch: panel/**, service/**, test/**, package.json, tsconfig.json, other worktrees/branches, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, DNS/TLS/proxy, master, root checkout. No push, no deploy, no real token in any process. Disposable fixtures/probes under /tmp/opencode only.
</env_preflight>
<goal>
Independently attack the standalone board and decide whether it is safe to run behind HTTPS for a single owner, and whether what it delivers matches issue #33 as written.
</goal>
<context_files>
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/33
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/27
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-standalone-board.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/README.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/browser/playwright-verification/SKILL.md]
</skills>
<scope>
Review-only. Do not fix code; report and prove. Distrust the builder's own tests and screenshots.
1. Authentication and session: scrypt work factor and salt, constant-time comparison, session token entropy and generation, cookie flags (HttpOnly, Secure, SameSite=Strict, Path, Max-Age), session fixation, logout invalidation, expiry and idle behaviour, session storage growth, multi-window behaviour, password change without restart. Try to authenticate with wrong password, empty password, array/object JSON bodies, duplicate parameters, case tricks and oversized bodies; confirm no user enumeration and no crash.
2. CSRF: token generation, binding to session, transport, rotation, comparison; every state-changing route protected; GET cannot mutate; JSON content-type and Origin/Referer handling; replay after logout; token leakage in page source, URL, logs or storage. Attempt a cross-origin form POST and a fetch without the token.
3. Rate limiting: bypass via X-Forwarded-For, Forwarded, multiple sockets, HTTP/1.0 keep-alive, parallel bursts, IPv6 forms; memory growth under many distinct sources; whether the owner can be locked out; whether the limiter itself is a DoS vector.
4. Credential exposure: grep the built bundle, page, README examples, error responses and logs for the token or password; force server errors and stack traces; check Authorization and Cookie redaction; verify the token never appears in any browser-readable response; check the session cookie value is not the token; verify BOARD_PASSWORD handling at first run and that the hash is not world-readable by default if written.
5. Identity and repository enforcement: startup /user verification and login match; per-request repository allowlist; client-supplied repo/owner/URL ignored; cross-repository and traversal attempts; token scope assumptions; behaviour when GitHub returns 401/403/404/429/5xx.
6. Read path: pagination termination and duplicate pages, PR exclusion, empty and huge results, issue body size, rate-limit handling; confirm imported panel/core.ts parsing is reused, not forked.
7. Writes and lost updates: the builder claims fingerprint + ETag conditional writes. Establish exactly which headers are sent, whether GitHub honours If-Match on PATCH (verify; do not repeat an unverified claim), and whether the real protection is a fresh GET plus hash compare with a remaining TOCTOU window. Reproduce a lost update with a fake server that changes the issue between the check and the PATCH. Also try: edit another repository, edit a PR, close an issue, check a human-task box, change a label outside the status set, send a body that drops a section, send CRLF/BOM/duplicate-heading bodies, and confirm each is refused or preserved byte-for-byte.
8. XSS and page integrity: issue titles, bodies, labels and URLs are attacker-influenced if any repo collaborator exists. Attempt stored XSS through title, body, link, label and question text in each rendering context; check escaping, URL schemes, attribute contexts, CSP and other security headers, and whether a successful XSS could read the session or CSRF token. Check static file serving for traversal, symlink escape, wrong MIME and cache leakage of authenticated pages.
9. Behaviour and interface: no agent-start or session-open control anywhere in DOM or routes; empty/error/stale/conflict states truthful; keyboard access and visible focus; no horizontal scroll at 360px; check the actual screenshots rather than trusting the report, and open them yourself if the tool allows.
10. Honesty of the evidence: does the fake GitHub enforce auth, pagination, fingerprint and rate limits like the real one, or is it permissive enough to make the tests vacuous? Attempt to make a test pass for the wrong reason. Re-run the suite, tsc, bundle and browser script yourself; compare the reported counts. Verify the report's residual list is complete.
11. Spec fit: issue #33 says GitHub-based sign-in and a second GitHub account must be refused; the implementation uses a board password plus a server-held PAT. State this mismatch plainly and grade it against the written acceptance criteria rather than silently accepting the brief's substitute.
</scope>
<criteria>
Two verdicts: Spec PASS/FAIL/PARTIAL against issue #33 as written; Security APPROVED/NEEDS-FIXES with severity per finding (Critical/High/Moderate/Low), exact file:line at af62a4e and reproducible evidence (request/response or command/output). Any credential leak, auth bypass, CSRF gap or stored XSS is Critical/High. Separate proven from suspected. Re-run all claimed checks and report real counts. No implementation approval, merge, deployment or closure inference.
</criteria>
<output>
Commit only .agents/run/task-centred-architecture/outputs/issue-33-hostile-review.md and an appended section in verifications/issue-33-standalone-board/proof.md. Do not modify web/ or any product file. Do not merge, push, deploy, comment on issues or close. Leave the worktree clean. Return at most 15 lines: verdicts, findings with severity, the spec mismatch ruling, reproduced attack list, real test counts, commit, actual and supplied model.
</output>
