# L4 hostile review — VOICE CRASH FIX (ses_909742d6a8b4139607f53184)

Reviewed: chambervoice branch issue-lifecycle-voice-allprojects (issues #17-#20).
Verdict: PASSED, 7 findings fixed and COMMITTED as 3356e58 (chambervoice repo).
Suite: npm run verify 427 tests green.

## Findings (all fixed)
1. [MEDIUM] service/taskboard.ts:207-212 — isValidRepo too weak (allowed a/b/c, traversal).
   Fixed: strict two-segment owner/repo slug regex, reject `.`/`..`, case-insensitive sentinel.
2. [MEDIUM] service/taskboard.ts:298-321 — case-sensitive repo dedupe caused duplicate
   queries/tasks. Fixed: case-insensitive Map keyed by lowercase slug.
3. [HIGH] service/taskboard.ts:547-585 — getTask(number) sequential search: O(N) latency,
   first-repo number match shadowed cross-repo collisions, auth/rate-limit errors masked as
   "not found". Fixed: Promise.allSettled parallel search + collision disambiguation message
   + surface 401/403.
4. [MEDIUM] service/tool-executor.ts:538,878,1006 — tool outputs stripped `repo`, so All
   Projects callers couldn't attribute issues. Fixed: preserve `repo` on mapped items.
5. [LOW] service/taskboard.ts:452 — all-repos-failed error lacked repo attribution.
   Fixed: prefix with repo slug.
6. [LOW] sentinel comparisons case-sensitive in 6 places. Fixed: case-insensitive.
7. [MEDIUM] test/taskboard.test.js — vacuous coverage of getTask/ToolExecutor guards.
   Fixed: subtests (e)(f)(g) incl. unmocked ToolExecutor mutation blocking.

## Blind spots (declared by author)
- No live github.com calls (strict local mocks only). Issues #18/#19/#20 remain open backlog.
