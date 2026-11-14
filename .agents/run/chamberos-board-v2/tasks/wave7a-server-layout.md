<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/workflows-accelerator-agent-dev-wave7a-server-layout
Branch: feat/wave7a-server-layout
Base: feat/board-v3 (e1f90aa)
Test command: node --test --test-timeout=60000 web/tests/layout.test.mjs && npx tsc -p web/tsconfig.json --noEmit
Exclusive files you may touch: web/server/layout.ts, web/tests/layout.test.mjs
Do NOT touch: web/server/app.ts, web/server/board.ts, web/server/config.ts, web/public/**, /workspace/code/openchamber-config/**, /workspace/.openchamber-data/**.
Forbidden: push, deploy, GitHub writes, `git remote -v`, deletion, delegation, weakening tests.
</env_preflight>

<goal>
Build `web/server/layout.ts` — an atomic, concurrency-safe server-side persistence store for canvas layout state (`canvas-layout.json`) so dragging or arranging 345 cards never triggers 345 GitHub API writes.
</goal>

<context>
Read `web/server/auth.ts` and `web/server/config.ts` first to match the repo's exact TypeScript style, ESM `.ts` imports, error handling, and `stateDir` / file persistence conventions (`fs/promises`, atomic temp file + rename).
</context>

<requirements>
1. **Data model (`CanvasScopeLayout` & `CanvasLayoutFile`)**:
   - Versioned schema (`version: 1`).
   - Keyed by scope (`'all'` or `owner/repo` string).
   - Each scope stores:
     - `direction`: `'auto' | 'LR' | 'TD'` (default `'auto'`)
     - `expandedGroups`: `string[]` (unique bounded list of group keys explicitly expanded; collapsed-by-default model!)
     - `positions`: `Record<string, { x: number; y: number }>` (finite numbers only, rounded sensibly or exact finite numbers)
     - `updatedAt`: ISO timestamp string
2. **`CanvasLayoutStore` class / factory**:
   - Constructed with `{ filePath: string; maxScopes?: number; maxPositionsPerScope?: number }`.
   - `getScope(scope: string): Promise<CanvasScopeLayout>` — returns sanitized scope (or clean default `{ direction: 'auto', expandedGroups: [], positions: {}, updatedAt: null }` if missing).
   - `patchScope(scope: string, patch: { direction?: 'auto' | 'LR' | 'TD'; expandedGroups?: string[]; setPositions?: Record<string, { x: number; y: number } | null>; resetPositions?: boolean }): Promise<CanvasScopeLayout>`:
     - `setPositions`: merges finite `{ x, y }` entries; `null` deletes a key; `resetPositions: true` clears all saved positions in that scope so auto-layout takes over cleanly.
     - Serialized through an internal async write queue (mutex) so concurrent requests never clobber each other or corrupt the file.
     - Atomic write: create parent directory (`mkdir({ recursive: true })`), write to temp file in same directory (`mode: 0o600`), `rename` onto `filePath`.
   - **Corrupt / missing file resilience**: missing file returns empty state; corrupt JSON backs up or ignores safely without crashing `getScope` or `patchScope` (verify behavior in tests).
   - **Validation errors**: reject invalid `direction`, non-finite `x`/`y`, oversized scope/position counts with a clear typed `LayoutValidationError` (so `app.ts` can later map it to HTTP 400).
</requirements>

<steps>
1. Write failing tests first in `web/tests/layout.test.mjs` covering: missing file default, `patchScope` create/merge/delete/reset, `direction` and `expandedGroups` persistence across store re-instantiation, 20 concurrent `patchScope` calls preserving every write, atomic write cleanup (no leftover `.tmp` files), corrupt JSON recovery, and strict validation errors (NaN/Infinity, invalid direction, cap exceeded).
2. Implement `web/server/layout.ts` cleanly.
3. Run `node --test --test-timeout=60000 web/tests/layout.test.mjs` and `npx tsc -p web/tsconfig.json --noEmit`.
4. Commit as `feat(board): add atomic server-side canvas layout store`.
</steps>

<output>
At most 10 lines: STATUS, EXPORTS, TEST_COUNTS (exit code), TYPECHECK (exit code), COMMIT, NOT_VERIFIED.
</output>
