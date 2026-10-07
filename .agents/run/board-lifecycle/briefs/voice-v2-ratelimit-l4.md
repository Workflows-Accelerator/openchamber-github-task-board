<goal>Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/voice-v2-and-ratelimit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/v2-compat-audit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/rate-limit-manager-review.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<context>
Fresh review session replacing ended builder ses_6a5a8749c6759270a40cbafd. Builder saved cd6ab18 on feat/v2-compat-and-ratelimit, based on 235d1ec in /workspace/extensions/chambervoice. Changes cover host-client, tool-executor, server, taskboard, two test files, generated service/main.js. Inspect only this change, not unrelated supervisor work. Builder reports typecheck/build passing and npm run verify 437 tests. Live GETs succeeded, session list returned 26 project/50 global sessions, but form/permission lists were EMPTY. No live answer or permission-reply receipt exists. 'Nothing relevant unverified' is rejected. Credentials appeared in the builder's chat; do NOT copy credentials into artifacts or replies.
</context>
<scope>
Read-only hostile review of cd6ab18 and runtime contracts. Application edits, merge, push, PR, issue closure, branch switches, service restarts, DB writes, and permission decisions are forbidden. Other files in .agents/run/voice-supervisor and .opencode are not yours. Only write a sanitized report at /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-ratelimit.md. Tests may run; inspect source in the installed V2 host. Live READ-ONLY probes permitted with existing authorized auth, NEVER echo/log credentials or cookies. Do not answer real pending user questions or approve/deny any real permission as a test. If positive reply proof requires a disposable session, describe the exact safe fixture and mark NOT RUN; manager will route that separately. No workers of your own.
</scope>
<criteria>
Independent verdict per component: session roster, form normalization/replies, permissions, rate-limit cache/routing. A successful GET of an empty list does not prove nonempty payload normalization or reply success. Report file:line, actual vs expected shape sourced from V2 implementation, severity, minimal repair, evidence and explicit blind spots. Re-run relevant suites and include commands/exit/count. Report PROCEED, PROCEED-WITH-CONDITIONS, or HALT; no acceptance or human verdict on your own behalf.
</criteria>
<steps>
<step>Verify commit, branch and clean tracked state. Inspect git diff 235d1ec..cd6ab18. Do not include unrelated earlier supervisor changes.</step>
<step>SESSION LIST: follow cursor pagination; the live global count is exactly 50 and may be a default page limit. Does the roster quietly drop sessions beyond page 1? Verify directory filtering location shape, session id/time/parent shapes from real V2 source, all list callers, archived sessions and activity scopes.</step>
<step>FORMS: compare real V2 fields/answers contract to normalization, not just builder mocks. Check field key/name, choice value vs display label, array/multiple/boolean/text fields, multi-question answers, custom answers, status and location scope. Does replyQuestion invent 'choice' or 'field_0' when schema unavailable? Fail safely instead of guessing. A 404 to form-detail route may not mean old API. Check fallback on empty V2 lists does not hit known-removed V1 routes every poll. Do not hide 401/403/500 or malformed payload as 'no pending question'.</step>
<step>PERMISSIONS: source-check decision vocabulary, session/request matching, directory scope, URL encoding, forwarding sessionId. Check 404 fallback and retry cannot approve another session or repeat a successful decision. Distinguish unavailable/unauthorized from no pending requests. No real permissions may be resolved by this audit.</step>
<step>RATE LIMITS: numeric issue IDs repeat across repositories. A cache containing #12 from A does NOT prove #12 absent in B. Test partially warmed lists, filtered/top-50 lists, same number across two repos, repo switches, newly added/removed projects, stale knownIssueRepos and token identity. Never silently choose/write to wrong repo. Compare D11 intent with existing #17 collision/disambiguation guarantees. Verify mutation invalidation and 30s freshness bounds for both list/get, in-flight requests, stale completion after mutation, cache key scope, expired memory eviction, concurrent queries and serialized fanout. Report tradeoffs introduced by serializing errors/timeouts.</step>
<step>Re-run typecheck and npm run verify if feasible; record sanitized evidence and missing positive user-path proof. Review generated bundle parity with source. Check test cases would fail under old implementation; do not rewrite mocks to pass assumptions.</step>
</steps>
<output>
Write report with status, independent per-component verdicts, findings table, evidence commands/results, unverified behaviors and proposed bounded repair. Return concise status/results/evidence/learnings, report path, commit reviewed. Never include credential/cookie/token values. Stop after review; do not merge or fix.
</output>
