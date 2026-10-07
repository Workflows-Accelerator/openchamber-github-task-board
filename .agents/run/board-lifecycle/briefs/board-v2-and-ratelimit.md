# V2 session-binding fix + rate-limit bundle — board

## HOLD
Do not dispatch until the views merge (branch issue-lifecycle-issue-contract-l4r) has landed on
board master. This work touches panel/core.ts and panel/main.ts, the same files the merge touches.

## Scope
Repo /workspace/extensions/github-task-board. Local commits on a feature branch off master, no push,
no PR. `panel/main.js` is generated: run `npm run build` after source changes, never hand-edit it.
Tests: `node --test test/*.test.js` (~241 after the merge) and `npm run typecheck`.

## Part 1 — V2 session binding (verifications/v2-compat-audit.md finding 5)
The V2 host projects guest session items down to `{ id, data }` and drops the top-level `url`.
`buildIssueAttachPayload` (panel/core.ts ~925-941) attaches `{ url, data: { issueNumber } }` with no
repo inside `data`, so `getSessionIssueRepo()` (~1810-1845) returns null, `sessionRepoKeys()` is
empty, and session-to-issue binding silently fails in All Projects mode. Fix: put the repo inside
data, `data: { issueNumber: issue.number, repo }`, and keep the existing readers backward compatible
with older stored items.

## Part 2 — rate-limit bundle (decision D11 in specs/rate-limit-manager-review.md)
1. Conditional requests: send `If-None-Match` with stored ETags on the issue-list calls and treat 304
   as "no change". FIRST verify inside the panel's fetch context that the ETag header is readable and
   can be sent back (CORS). If it cannot, report that as a blocker and fall back to a time-based
   short-circuit — do not silently drop this item.
2. Idle refresh becomes incremental: on a session going idle (main.ts ~531-539) fetch only the issues
   changed since the last sync using `issues?state=all&since=<lastSync>`, instead of
   `fetchIssues(true)` across every repo. Keep a full refresh behind the Refresh button and on load.
3. Drawer: `renderDrawer()` (~4241) calls `loadComments()` (~4518) with no cache on every render and
   checkbox tick. Cache comments briefly, and stop triggering a comment refetch from a checkbox edit.
4. Priority drag-and-drop sends two PATCHes back to back (~1451 then ~2569). Coalesce to one.
5. Issue create (~5633) should not force a full multi-page refetch afterwards.
6. Issue #18: the 14 call sites that use bare `githubRequest` instead of `githubRequestWithRetry`
   must all go through the retry wrapper so a 403/429 does not kill the panel.

## Evidence required before you report done
- typecheck clean, full suite green (count reported), `npm run build` output reported.
- ETag readability verified or reported as a blocker, with the probe output.
- `since=` incremental refresh proven: a test showing the idle path requests only changed issues and
  does NOT call the full refetch, plus one that fails if the fix is reverted.
- A before/after request-count estimate for one idle event, one-repo and all-projects.

## Output
status; results (per item: what changed, file:line); evidence (counts, probe output); learnings.
