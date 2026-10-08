<goal>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Independently review the D12 builder's change; no acceptance or integration is authorized by this review alone.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/board-d12-origins-cache-2026-10-08.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/auth-credential-audit-2026-10-08.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-d12-origins-etag/.agents/run/board-lifecycle/verifications/d12-origins-cache/report.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/clarity/answer-first/SKILL.md]
</skills>
<context>
Working directory: /workspace/extensions/github-task-board/.worktrees/team-dev-d12-origins-etag; branch feat/d12-origins-etag at 4c688e2, base f849dce.
Builder commits: 9b98dc5 manifest; cff11bb five tests; 4c688e2 report. Claims: manifest-only activation, no production TypeScript/bundle changes, 288/288 tests, zero type errors, unchanged bundle, proxy fallback on missing token/network-CSP error/401, mocked 304 handled directly. These are claims, not independent proof.
Manager reproduced 288 pass marks with node --test --test-reporter=dot test/*.test.js; git status clean; commit chain matches. Narrow manifest diff matches adding origins to EXISTING openchamber.capabilities (do not replace other capabilities) and adding https://api.github.com to openchamber.contributes.origins. Typecheck/build, test authenticity, live CSP/304, and secret hygiene not manager-verified.
The manager was denied reading the worktree report; do not bypass that denial on the manager's behalf. Read it in your own authorized worker context and return a short evidence summary. The manager's earlier git file-table outputs were inconsistent; independent integration review confirmed the real branch inventory was clean. Stop on impossible metadata or unexpected files, do not speculate about root cause or delete files on a dubious view.
Issue 24 correction receipt reportedly posted at https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/24#issuecomment-6067461817. No further issue writes.
Board human click-through is already open. Do not resend it, alter UI, answer All Projects policy on the human's behalf, or treat silence as approval.
</context>
<scope>
READ: changed package.json, test/d12-origins-cache.test.js, report, production direct-request functions, harness, installed SDK/host schema and CSP enforcement relevant to origins. Read narrowly; no credential files or values.
WRITE: only .agents/run/board-lifecycle/verifications/d12-origins-cache/l4-review.md and a D12 section in this worktree's .agents/run/board-lifecycle/verifications/proof.md. Commit evidence locally.
Temporary mutation probes only: package.json, panel/main.ts, panel/main.js. Restore exact reviewed content after each probe; no permanent application/test edits. If unauthorized path needed, stop and report.
DO NOT: merge, publish, push, close/edit/comment on issues, modify root checkout, touch master, change shared host files/config, restart services, mutate live sessions/forms/permissions/DB, broaden origins, or read/log credentials.
</scope>
<criteria>
Spec verdict PASS/FAIL/PARTIAL and quality verdict APPROVED/NEEDS-FIXES, plus PROCEED/PROCEED-WITH-CONDITIONS/HALT, backed by independent observations.
Declared scope only, existing capabilities preserved, exactly https://api.github.com permitted. Host manifest parser and effective CSP wiring grounded in current installed source, not a presumed schema or old audit.
New tests run real production bundle/functions with only boundary mocks; not copied implementations, static string tautologies, synthetic enactments, or a harness that silently omits production transport. Their failures must genuinely detect missing origins, broken fallback, or broken conditional headers/304 behavior.
Zero authentic credential material printed or persisted. Safely report secret-check result without printing matched strings or token prefixes. Never export raw HAR/full request headers; those contain authorization/cookies.
L0/L1 reproduced with exact counts; L3 LIVE SERVED CSP AND REAL 304 MUST REMAIN NOT RUN. A synthetic 304 is not the user's required empirical 304. No overall done claim.
Final application content restored byte-exactly and working tree clean after committing evidence.
</criteria>
<steps>
<step>
Check clean status and history; independently inspect the actual diff f849dce..4c688e2. Expect exactly package.json, test/d12-origins-cache.test.js, and verifications/d12-origins-cache/report.md. Stop if scope differs.
</step>
<step>
Audit manifest schema and host origin-grant/CSP path. Determine whether declaring origins is sufficient for this already-installed extension, requires an ordinary panel reload, requires capability approval, or would require a forbidden shared-service restart. Report uncertainties as prerequisites, not silent instructions. Do not change shared host state.
</step>
<step>
Inspect all five tests and production githubRequest/direct fetch/fallback code. Exercise edge cases offline: missing credentials, unavailable/rejecting fetch, 401, 304 plus cached body and pagination, per-repo isolation, failed requests/retry budget, and authorization confinement to the approved origin. Distinguish pre-existing code hazards that D12 activates from regressions caused by the diff. Report any fork involving new policy; do not fix it.
</step>
<step>
Prove oracle authenticity using small controlled red/green probes: remove the origins grant; disable the real direct-to-host.request failure fallback; remove the real If-None-Match header or deliberately break real 304 handling. For each, name the test that fails and capture a sanitized assertion; restore package.json/panel/main.ts/panel/main.js to reviewed HEAD immediately, rebuild when necessary, then prove green. No history rewrites/resets/amends and no test weakening. If probes cannot safely target production functions, report the proof gap instead of simulating copied logic.
</step>
<step>
Run npm run typecheck, npm run build, git diff --exit-code panel/main.js, targeted D12 tests, and node --test test/*.test.js. Claimed baseline 283 + 5 = 288. Known timing flake ONLY: test/scale-and-adversarial.test.js:144 (<60ms budget). If only that assertion fails, rerun once and record both attempts; do not weaken it. Other failures mean HALT.
</step>
<step>
Review the post-merge recipe skeptically: prove it targets the real served extension iframe, reads actual effective CSP including any header/meta/sandbox restriction, exercises the unchanged same-request cache without clearing ETag or adding a cache-busting URL, and captures an actual api.github.com 304 plus visible retained issue data. Pinpoint manual Refresh/cache invalidation pitfalls. Evidence must allowlist status/method/redacted URL/ETag presence or equality/response body absence; never dump token-bearing headers, console payloads, storage, or browser profiles. No fake fixture, bare external curl, or mocked response may substitute for the real served-panel 304. State whether the recipe is executable without live session/form/permission/DB mutation or shared-service restart. Preserve L3 NOT RUN until later empirical evidence exists.
</step>
<step>
Record findings with file:line, severity, reproducible evidence, required fix, and verdicts. Append D12 status to canonical proof.md: L0/L1 independent results, L3 NOT RUN, L4 result, L5 pending classification (internal config waiver considered only if no user-facing/workflow changes). Commit evidence only and verify final git status --porcelain clean.
</step>
</steps>
<output>
Return at most 15 lines: three verdicts, findings count/severity and concise actionable findings, exact gate counts, mutation red/green results, final commit and clean status, live CSP/304 status NOT RUN, any reload/approval prerequisite, recipe readiness, and evidence path. Full detail lives in l4-review.md/proof.md. Never quote credential values or prefixes.
</output>
