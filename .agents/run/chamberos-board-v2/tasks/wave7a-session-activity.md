<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-session-activity
Branch: feat/wave7a-session-activity
Base: feat/board-v3 (e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/session-activity.test.mjs && npx tsc -p web/tsconfig.json --noEmit
Exclusive files you may touch: web/server/session-activity.ts, web/tests/session-activity.test.mjs
Do NOT touch: web/server/app.ts, web/server/config.ts, web/public/**, /workspace/code/openchamber-config/**, /workspace/code/openchamber-triggers/**, /workspace/.openchamber-data/**.
Forbidden: push, deploy, GitHub writes, `git remote -v`, deletion, delegation, weakening tests.
</env_preflight>

<goal>
Build `web/server/session-activity.ts` — a fail-safe, cached tracker that queries optional local/configured agent-session sources (such as OpenChamber session status and `openchamber-triggers` `/state`) so the board can distinguish an issue with a genuinely running agent session (animated rotating green border) from `status:in-progress` with no active agent (steady state).
</goal>

<context>
Read `web/server/config.ts` and `/workspace/code/openchamber-triggers/service/main.js` (lines 720–840 only, read-only) to understand the exact JSON shape returned by Triggers `/state` (`{ triggers: [{ id, sessionId, ... }] }`) and match the board server's TypeScript style (`node:http`/`fetch`, `AbortSignal.timeout`, strict TS).
Note: Triggers `/state` records `sessionId` for triggers; OpenChamber's session status endpoint (if configured) reports `{ [sessionId]: { type: 'busy' | 'idle' } }`. Design the tracker cleanly so it supports both:
1. Direct OpenChamber active-session status map (e.g. `openchamberUrl` `/api/session/status` or `/session/status` returning active/busy session IDs + optional session metadata linking to `owner/repo#number`), AND
2. `openchamber-triggers` `/state` (`triggersUrl`) mapping trigger `id` / `sessionId` / `action.directory` to issue refs when active.
If neither URL is configured or reachable, degrade gracefully to `{ available: false, activeByIssue: {} }` without throwing or delaying board loads.
</context>

<requirements>
1. **`extractIssueRefs(text: string, defaultRepo?: string): string[]`**:
   - Pure helper parsing `owner/repo#123` (and `#123` when `defaultRepo` is provided, e.g. from directory -> repo map) into normalized lowercase keys (`owner/repo#123`).
2. **`SessionActivityTracker` class / factory**:
   - Options: `{ openchamberUrl?: string; triggersUrl?: string; repoByDirectory?: Record<string, string>; ttlMs?: number; timeoutMs?: number; fetchFn?: typeof fetch }`.
   - Validates URLs safely (http/https only; never logs auth tokens if headers are ever used).
   - `getSnapshot(options?: { forceRefresh?: boolean }): Promise<SessionActivitySnapshot>`:
     - Singleflight coalescing + `ttlMs` cache (default 5000ms).
     - Timeout enforcement (`timeoutMs` default 1200ms) so a hung local service never slows `/api/board`.
     - Returns `{ fetchedAt, available, degraded, activeByIssue: Record<string, { active: boolean; sessionId: string | null; source: 'openchamber' | 'triggers'; updatedAt: string | null }> }`.
     - Never throws on network error, 5xx, timeout, or malformed JSON — marks `degraded: true` and returns empty/safe snapshot.
</requirements>

<steps>
1. Write failing tests first in `web/tests/session-activity.test.mjs` using local mock `http` servers or injected `fetchFn`:
   - `extractIssueRefs` (`owner/repo#42`, `#42` with `defaultRepo`, multiple refs, ignores invalid `#0`/`#abc`)
   - Unconfigured URLs -> `{ available: false, degraded: false, activeByIssue: {} }`
   - Active busy session mapped to issue key (`active: true`) vs idle session ignored (`active: false` / omitted)
   - Triggers `/state` + OpenChamber status combined
   - TTL cache + singleflight deduplication (1 fetch for concurrent callers)
   - Timeout / 500 / malformed JSON graceful degradation without throwing
2. Implement `web/server/session-activity.ts` cleanly.
3. Run `node --test --test-timeout=60000 web/tests/session-activity.test.mjs` and `npx tsc -p web/tsconfig.json --noEmit`.
4. Commit as `feat(board): add fail-safe active session tracker for running cards`.
</steps>

<output>
At most 10 lines: STATUS, EXPORTS, TEST_COUNTS (exit code), TYPECHECK (exit code), COMMIT, NOT_VERIFIED.
</output>
