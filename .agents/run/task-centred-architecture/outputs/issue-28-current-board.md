# Issue #28 current-board implementation

Status: implementation committed for independent hostile review; issue remains open, not declared Done. Provider/model: 9router/engineer (Engineer).

Canonical issue read using `gh issue view 28 --repo Workflows-Accelerator/openchamber-github-task-board --json title,body,state,url` (exit 0). No live issue writes, panel launch, deployment, merge or push.

## Changed paths

- `panel/main.ts`: repository/epoch admission after awaited cache/page results; provisional cache always revalidated; completed full snapshots replace membership (including empty); page streaming retains unseen prior members until completion; pagination failure/cap preserves prior completed cache and watermark; empty cached 304 bodies supported; startup settings fallback fetch; hidden-to-visible revalidation while not loading; visible freshness and separate full-sync timestamps; superseded incremental results rejected before watermark/cache publication; idle refresh no longer manufactures full-sync success.
- `panel/index.html`: always-visible accessible freshness notice.
- `panel/main.js`: regenerated shipped bundle.
- `test/test-app-harness.js`: settings-ready input and deferred asynchronous recording-host responses.
- `test/current-board.test.js`: nine shipped-bundle regressions covering empty membership, settings startup, warm visibility activation, A-to-B race, overlapping refresh, provisional pagination/failure/completion, empty 304, superseded incremental watermark, offline/idle freshness.
- `test/issue-page-size.test.js`: later-page failure now expected to reject to full-refresh owner, which records stale state. Existing assertions for one request and preservation of 20 rows retained; no matcher weakened.
- This report.

## Red-first evidence

`node --test test/current-board.test.js` against original shipped bundle: 0 passed, 6 failed. `/tmp/opencode/issue28-red.log`.

Concrete empty reproduction: issue count expected 0 after successful empty refresh, actual 1. Settings startup expected one GET, actual zero. Delayed A and overlapping refresh each retained obsolete issue 1 with new issue 2. Warm cache expected second request, actual one. Pagination notice absent (initial assertion encountered undefined notice); later green exercises complete pagination and failure.

Additional red runs:
- `/tmp/opencode/issue28-incremental-red.log`: 7 passed, 1 failed; superseded incremental response incorrectly created old-repository watermark.
- `/tmp/opencode/issue28-idle-red.log`: 8 passed, 1 failed; failed idle refresh advanced zero full-sync timestamp.

## Final verification

All commands below exited 0:

- `npm run typecheck`.
- `npm run build` (panel and service scripts; service output byte-identical, no service diff).
- `node --test test/current-board.test.js test/d12-origins-cache.test.js test/v2-binding-and-ratelimit.test.js`: 23 passed, 0 failed/skipped. `/tmp/opencode/issue28-final-targeted.log`.
- `npm test`: 475 passed, 0 failed/skipped. `/tmp/opencode/issue28-final-suite.log`.
- `git diff --check`.

Earlier focused compatibility run: `node --test test/current-board.test.js test/issue-page-size.test.js test/residual-repairs.test.js`: 25 passed before three additional tests were added.

Generated build file list: `panel/main.js` changed; `service/main.js` rebuilt unchanged. No dependencies added; worktree uses root node_modules symlink.

## Residuals and proof boundary

- Supported activation event: document `visibilitychange`, actual hidden-to-visible transition, suppressed while loading. No timer/polling daemon or host modification. Settings-ready path tested with recording host; workspace discovery in this harness reports missing workspace data, so actual installed discovery/subscription lifecycle is not live-proven.
- Recording-host refresh regression waits through reconciler debounce and asserts no non-GET issue requests for its fixture. Existing full-snapshot label reconciliation scheduling retained; no new automatic write mechanism. Linked running-session reconciliation and session subscription callbacks remain existing potential automatic-write behavior, not universally certified read-only. No real token or live writable panel used. Separate policy work would be needed to disable all opening-related reconciliation.
- All Projects aggregation freshness/session-coverage overhaul excluded; new notice is driven by single-repository refresh. Existing All Projects partial-source shortcomings remain follow-up scope, not solved here.
- Pagination is bounded at 1,000 raw entries. Full final page at cap is conservatively incomplete rather than authoritative. GitHub pagination itself is not an atomic server snapshot.
- No actual installed-browser rendering, real GitHub fetch comparisons, authenticated host subscription delivery, screenshots or independent review performed. Manager dispatches independent hostile review next.
- DB registration intentionally omitted under no-opencode.db boundary. Shared agent/skill configuration, credential files and other worktrees untouched.

## Learnings

DIDN'T WORK: first full suite exposed startup fallback triggering extra fetches in tests that manually set repository before host-ready. FINALLY WORKED: fallback limited to settings-provided startup repository, preserving epoch guard.

DIDN'T WORK: empty-304 test expected conditional header through host proxy, which does not forward custom headers. FINALLY WORKED: synthetic direct-fetch boundary records actual conditional headers; no production transport scope expansion.

DIDN'T WORK: fixed 30ms settings-startup wait flaked under full-suite concurrency. FINALLY WORKED: bounded state-based wait; request-count assertion unchanged.

DIDN'T WORK: direct stream caller expected swallowed failure. FINALLY WORKED: rejection asserted while preserving request-count and retained-row checks; full-refresh owner handles visible stale state.
