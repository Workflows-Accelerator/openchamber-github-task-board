<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board
Branch: feat/issue-33-standalone-board; HEAD ef1b78d (review docs); code af62a4e; tracked state clean; bundle in web/dist matches a fresh build.
Files owned: web/** only (server.ts, server/*.ts, public/*, tests/*, README.md, dist build), plus run report/proof.
Tests: node --test web/tests/*.test.mjs; npx tsc -p web/tsconfig.json; the esbuild command in web/README.md; node web/tests/browser-verify.mjs.
Do not touch: panel/**, service/**, test/**, package.json, tsconfig.json, other worktrees/branches, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, DNS/TLS/proxy, master, root checkout. No push, deploy, merge or close. Disposable probes under /tmp/opencode only.
Efficiency: work from the review report anchors; read only the functions involved.
</env_preflight>
<goal>
Close the two Moderate findings and the Low hardening findings from the independent security review, without changing the sign-in model that is still awaiting the owner's decision.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/.agents/run/task-centred-architecture/outputs/issue-33-hostile-review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-33-standalone-board/web/README.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/security/security-and-hardening/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/discipline/surgical-patch/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/methodology/test-driven-development/SKILL.md]
</skills>
<scope>
F3 (board password vs GitHub sign-in) is OUT of scope: do not add OAuth and do not remove the password flow. The owner is deciding the sign-in model. Keep the implemented auth working exactly as it is except for the hardening below.

Fix F1 — lost update (Moderate). Facts: GitHub does not support If-Match on PATCH; the fake honoured it, so the 412 path is dead in production.
Required:
1. Make the fake pessimistic: it must ignore If-Match by default, and offer a mode that mutates the issue between the board's fresh GET and its PATCH.
2. Implement the best available fail-closed emulation without pretending GitHub is atomic: serialize writes per issue inside the process; fresh GET and client-fingerprint compare with 409 as today; PATCH without depending on If-Match; immediately re-read and verify the intended section now equals what was written.
3. If verification fails, distinguish (a) the edited section is still the base the client saw → re-apply on the current body and retry, bounded to at most 2 retries; (b) the edited section changed to something else → 409 with the current issue, no retry; never touch other sections during a retry.
4. Add tests that prove: ignored If-Match still refuses when the issue changed before the fresh read; a change landing between read and PATCH is detected and either converges with both edits preserved or returns 409; retries are bounded; no other section changes.
5. Correct the README to state exactly what is and is not guaranteed. No claim of atomic conditional writes.

Fix F2 — unauthenticated login DoS (Moderate):
1. Check the limiter before running scrypt; a blocked client gets 429 without password work.
2. Bound the failure-tracking structure (cap entries, evict oldest) and make pruning cheap.
3. Optional but preferred: a small global concurrency limit for scrypt so parallel login attempts cannot monopolize the process.
4. Do not lock the owner out: a correct password still works while a bucket is cooling down (keep existing behaviour) or document the exact trade-off if you change it. Only trust X-Forwarded-For/Forwarded when a proxy is explicitly configured; otherwise keep the socket address.
5. Tests: 20 parallel wrong passwords run bounded work and finish quickly; 5000 distinct failures do not grow without bound; owner login during cooldown still works; forwarded headers cannot bypass the limiter by default.

Fix Lows F4–F9:
- F4: validate Origin (and Referer fallback) on writes against BOARD_BASE_URL when configured; same-origin or absent Origin allowed only as the current design requires. Test evil origin rejected once a base URL is set.
- F5: map upstream 401 → a clear unauthorized/expired-credential response, 403 with exhausted primary rate limit → rate limited, other 403 → forbidden, 422 → rejected/invalid, 5xx → unavailable. Tests for each.
- F6: parse the Link next URL with URL and require the same origin as the API base; dedupe issues by number; stop when a page adds nothing new. Test repeated pages and a malicious host.
- F7: strip a leading BOM before heading scanning, ignore headings inside fenced code blocks, and refuse to offer an editable section when the preamble is ambiguous (heading or fence) instead of saving and dropping structure. Tests for BOM, leading fence, duplicate headings, CRLF.
- F8: README examples must use stdin/secret-manager form only, never `VAR=... command`, and note `umask 077` if an operator writes the hash to a file.
- F9: cap stored sessions (for example 50, evict oldest) and document that changing the password requires a restart.

Also fix the review's Low/nit if trivial: literal `*(Answer: …)*` rendered in an answered question should display as a plain answer.
Update the residual list so it discloses F3, F1's remaining window, F2's assumptions and anything still unverified. Do not overclaim.
</scope>
<criteria>
All previous 68 tests still pass plus new regressions for F1, F2, F4–F9 and the answer-marker cosmetic fix; typecheck, bundle and browser script green; bundle hash reported; fake GitHub now pessimistic about If-Match; README accurate; no auth-model change; diff confined to web/**.
</criteria>
<output>
Commit on feat/issue-33-standalone-board. Report .agents/run/task-centred-architecture/outputs/issue-33-remediation.md and append verifications/issue-33-standalone-board/proof.md. Return at most 12 lines: commit, what changed per finding, test counts, bundle hash, remaining residual, actual and supplied model. No push, deploy, merge or close. A bounded re-review follows.
</output>
