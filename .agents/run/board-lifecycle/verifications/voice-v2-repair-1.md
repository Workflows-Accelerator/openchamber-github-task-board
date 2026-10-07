# Voice V2 Protocol and Rate-Limit Defense Repair Report (Repair 1)

## Status
STATUS: done

## Results Per Finding
1. **Finding 1: V2 Permission Schema Normalization**
   - **Resolution**: `normalizePermissionRequest` extracts `action` and `resources` from OpenCode V2 permission payloads, correctly setting `permission: raw.action` and `patterns: raw.resources` with clean fallbacks for legacy V1 structures.
2. **Finding 2: Form `multiselect` Type Detection**
   - **Resolution**: `normalizeQuestionRequest` checks `f.type === 'multiselect'` alongside `multichoice`, `checkbox`, and `f.multiple === true`. `replyQuestion` validates and formats multi-select answers as string arrays (`string[]`).
3. **Finding 3: Dead V1 Route Fall-Through on Empty Lists**
   - **Resolution**: `getPendingQuestion` and `getPendingPermission` now treat empty lists from V2 `/api/form` and `/api/permission/request` as definitive terminal `null`. Fall-through to legacy V1 routes occurs strictly when the endpoint returns HTTP 404 (`NOT_FOUND`).
4. **Finding 4: Invented Form Field Keys on Missing Schema**
   - **Resolution**: When replying to a form where `targetSessionId` is known but form schema contains 0 fields, `replyQuestion` throws `HostClientError` with code `SCHEMA_UNAVAILABLE` and aborts before issuing any HTTP POST.
5. **Finding 5: Spoken Label to Option Value Translation**
   - **Resolution**: `replyQuestion` compares tokens against option values and display labels. Unambiguous labels are translated to machine values. Conflicting duplicate labels throw `AMBIGUOUS_OPTION_LABEL`, and unrecognized tokens on strict fields (`custom: false`) throw `INVALID_FIELD_ANSWER`.
6. **Finding 6: Cursor Pagination for Session Rosters**
   - **Resolution**: `fetchAllSessionPages` traverses `cursor.next` across pages, accumulating all sessions. Enforces loop detection via `seenCursors` (throwing `INVALID_CURSOR` on cyclic cursors) and preserves `directory` query parameters across every page request.
7. **Finding 7: Whole-Directory Listing in `getSessionModel`**
   - **Resolution**: `getSessionModel` queries `GET /api/session/:id` directly. Only falls back to full directory listing if the direct route returns 404.
8. **Finding 8: Collision Warning Silenced in All Projects Mode (Issue #17)**
   - **Resolution**: In All Projects mode (`__all_projects__`), `getTask(number)` searches all known repositories sequentially rather than shortcutting to a single repo from cached tasks. Detects collisions across open and closed issues and provides disambiguation warnings. Verified single-repo results are cached with generation protection.
9. **Finding 9: Cache Generation Overwrite from In-flight Reads**
   - **Resolution**: Introduced monotonic `cacheGeneration` counter and in-flight read coalescing via `inflightReads` map in `TaskboardManager`. Cache writes check generation matching at start and completion; stale reads completed after cache clearing or scope switching are discarded. Cache is also cleared on `closeTask`.

## Changed Paths
- `service/host-client.ts`: V2 protocol normalization, cursor pagination, direct session lookup, form label mapping, empty list handling, schema validation.
- `service/taskboard.ts`: Cache generation tracking, in-flight read coalescing, scope switch invalidation, sequential multi-repo collision detection, `closeTask` invalidation.
- `test/taskboard.test.js`: Updated multi-repo cache test to assert all-repo verification before caching.
- `test/v2-ratelimit-repair.test.js`: New regression test suite reproducing and verifying all 9 L4 findings.
- `service/main.js`: Recompiled service bundle via esbuild.
- `panel/main.js`: Rebuilt panel bundle.
- `.gitignore`: Added `.worktrees/` and `.opencode/` ignore entries.

## Local Commits and Base
- **Base commit**: `cd6ab18` (base `235d1ec`)
- **Worktree**: `/workspace/extensions/chambervoice/.worktrees/team-dev-v2-ratelimit-review-repair`
- **Branch**: `fix/v2-ratelimit-review-repair`

## Evidence
- **Reproduction Test Suite**:
  ```bash
  node --test test/v2-ratelimit-repair.test.js
  # Result: 16 passed, 0 failed, 0 skipped (exit 0)
  ```
- **Full Verification Suite**:
  ```bash
  npm run verify # tsc --noEmit && npm test
  # Typecheck: PASS (exit 0)
  # Test Suites: 60 passed
  # Tests: 453 passed, 0 failed, 0 skipped (exit 0)
  ```
- **Build Suite**:
  ```bash
  npm run build # esbuild panel, live, worklet, service
  # Result: PASS (exit 0)
  ```
- **Sanitized Live Read-Only Discovery Proof**:
  - `listSessions('/workspace')`: Discovered 26 sessions; `archived` boolean parsed correctly (`typeof session.archived === 'boolean'`).
  - `getSessionModel(sessionId, '/workspace')`: Returned `{ providerID: '...', modelID: '...', agent: '...' }` via direct route.
  - `getPendingPermission` & `getPendingQuestion`: Returned `null` without error on live idle sessions.

## Not Verified
- Live positive reply to an active host permission prompt or question form on the live operator session, as creating/prompting live host sessions is prohibited under the brief to prevent live operator disruption.

## Blockers
- None. All repair requirements and regression tests are fulfilled within the owned worktree scope.

## Learnings
- **DIDN'T WORK**: Attempting to shortcut `getTask` in All Projects mode based on previously seen issue numbers silenced multi-repo collision detection from Issue #17.
- **FINALLY WORKED**: Searching all configured repositories sequentially in All Projects mode before caching the verified unique issue with cache generation protection guarantees collision safety and eliminates redundant queries on subsequent reads.
