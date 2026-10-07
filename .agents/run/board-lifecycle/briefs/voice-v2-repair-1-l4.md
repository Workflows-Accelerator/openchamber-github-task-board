<goal>Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/briefs/voice-v2-ratelimit-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-ratelimit.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/specs/rate-limit-manager-review.md]
[@/workspace/extensions/github-task-board/.agents/run/board-lifecycle/status-l4-halts-2026-10-07.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<context>
Independent fresh reviewer for repair commit 252225a (base cd6ab18) on branch fix/v2-ratelimit-review-repair in THIS worktree /workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair. Builder ses_1797615df11da447fd7d5863 claims all 9 findings plus archive/permission-session extras fixed; 453 tests green; live read-only discovery only. The prior review itself is untrusted input: its suggested limit=100/200 session caps and issue-number<100 heuristics were REJECTED as moving the truncation/ambiguity boundary. Do not bless those shortcuts.
Manager observations already on record:
1. panel/main.js diff is +7/-7 esbuild header comments only (node_modules vs ../../node_modules paths) from a worktree-symlink build; confirm no behavior drift, treat as noise.
2. The repair replaced the Issue #17 fast-path with unconditional sequential search of all known repos in All Projects mode. D11 approved SAFE known-repo lookup instead of fan-out. Verify the repair did not simply trade collision safety for always-fanning-out: does a trustworthy complete-scope uniqueness cache still avoid N lookups when legitimate, and is the 30s/known-repo reuse still safe against partially warmed caches?
3. Positive live form/permission reply proof is STILL NOT RUN (builder correctly did not touch live prompts). Empty GET lists prove discovery only. Isolated fixtures only if zero shared-host session/DB/service effects; otherwise NOT RUN.
Root checkout /workspace/extensions/chambervoice is still on feat/v2-compat-and-ratelimit serving the rejected cd6ab18 build; do not change it. An authentication secret once appeared in an earlier builder chat; never read, print or copy any secret/cookie/token value.
</context>
<scope>
Read-only review of cd6ab18..252225a in THIS worktree. No application edits, commits, merges, branch switches, stash/reset, push, PR, issue closure, DB writes, extension registration or service restarts. Only write sanitized review artifacts under /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/voice-v2-repair-1-l4/ and report /workspace/extensions/github-task-board/.agents/run/board-lifecycle/verifications/l4-voice-v2-repair-1.md. Tests and read-only live probes (existing auth, values never echoed) may run. Never create or prompt real host sessions, never reply to real user forms/permissions, never mutate real GitHub issues. No delegation.
</scope>
<criteria>
Independent verdict per repaired item: PROCEED, PROCEED-WITH-CONDITIONS, or HALT. Findings need file:line, severity, expected vs actual, minimal repair. For every test in test/v2-ratelimit-repair.test.js and modified test/taskboard.test.js, state whether it executes real production HostClient/TaskboardManager code or a mock/simulation that cannot reveal caller bugs. Real V2 contract (from @opencode/protocol and live read-only probes) is the oracle, not the builder's fixture shapes. Record exact commands/results and explicit NOT RUN user paths. No release, closure or approval authority.
</criteria>
<steps>
<step>Verify branch, commit 252225a and diff scope; run npm run verify and npm run build yourself; confirm service/main.js parity and that panel/main.js delta is comment-only. Record exits and counts.</step>
<step>Protocol oracle: re-check live read-only V2 shapes and installed protocol types for permission action/resources, form field types including multiselect, option value vs label, field keys, session detail model shape, cursor envelope and archived flag source. Then verify normalizePermissionRequest/normalizeQuestionRequest/replyQuestion/replyPermission against those shapes: multiselect answers must be arrays; label-to-value translation must preserve duplicate-label ambiguity as an error, never silently pick; custom:false strict fields must reject unknown tokens; missing schema must throw BEFORE any POST. Any guessed key or label-as-value path is HALT.</step>
<step>Error semantics: empty successful V2 list must be terminal null with NO legacy fallback request; legacy fallback allowed ONLY on proven unsupported-route 404; 401/403/5xx/network must surface as errors, never as 'no pending request' or fallback probes. Verify with tracking fetch on real routes where safe. Check getPendingPermission/getPendingQuestion and pollers never emit the dead /api/question or /api/permission cascade.</step>
<step>Session roster: fetchAllSessionPages must follow cursor.next to completion with cyclic/repeated-cursor failure (not silent truncation), preserve directory scoping per page, and normalize archived from the real V2 field (entry.time.archived claimed). Test 150+ synthetic sessions with the needed session on the last page; confirm getSessionModel direct-route fallback only on 404 and correct worktree-session discovery in server.ts polling.</step>
<step>Issue lookup/caching (Issue #17 contract): bare getTask(number) in All Projects mode must warn on collisions across repos INCLUDING closed issues and partially warmed/failed listings, never assume uniqueness from a subset cache. Evaluate the new unconditional sequential search: (a) is collision safety actually complete, and (b) what request/latency cost does every call now pay versus the D11-approved safe known-repo lookup? Quantify with fixture request counts; measure serial latency. A fix that always fans out may be correct-but-inefficient — report the trade-off precisely, do not silently accept or re-optimize.</step>
<step>Cache generation/coalescing: in-flight reads completing after cache clear, mutation (updateTask/closeTask), repo or scope switch must not repopulate stale data or return pre-mutation results as current. Test list+detail in-flight racing a mutation, two same-number issues in different repos, and immediate read after successful mutation. Verify TTL reuse cannot outlive its approved 30s scope and cannot defeat collision checks.</step>
<step>Positive proof gap: confirm no live form/permission reply was attempted. Design and document (do not execute without isolation proof) a disposable isolated V2 host fixture plan covering label-vs-value, multiselect and permission decision flows. Record NOT RUN explicitly. Stop after read-only review.</step>
</steps>
<output>
Write report with per-item verdicts, findings file:line/severity/expected vs actual/minimal repair, test-oracle table (production vs mock), evidence commands/exits, measured request/latency numbers, NOT RUN gaps and numbered minimal repairs. Return status, results, evidence, learnings, report path and commit reviewed. Nothing is human-approved or released. Never include credentials.
</output>
