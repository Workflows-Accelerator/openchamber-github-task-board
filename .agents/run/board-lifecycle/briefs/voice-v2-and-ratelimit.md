# V2 breakage + rate-limit bundle — chambervoice

## Scope
Repo /workspace/extensions/chambervoice only. Local commits on a feature branch, no push, no PR.
Run `npm run verify` (427 tests expected) before and after.

## Part 1 — V2 compatibility (from verifications/v2-compat-audit.md)
Three confirmed breakages in service/host-client.ts. The routes moved in OpenChamber V2.
1. `listSessions()` (host-client.ts ~405-412, 428-430, 633-640; server.ts ~684-704): V2 `/api/session`
   returns `{ data: [...], cursor }` and puts the directory at `entry.location.directory`. Today the
   check `!Array.isArray(raw)` returns `[]`, so the voice roster and `pollSessionActivity` see no
   sessions at all. Fix: unwrap `Array.isArray(raw?.data) ? raw.data : raw`, and read
   `entry?.directory ?? entry?.location?.directory`.
2. Questions (host-client.ts ~727-764, 805-819): V2 replaced questions with `forms`.
   `/api/sessions/status` exposes `entry.forms`, and `GET /api/question` +
   `POST /api/question/:id/reply` 404. The live routes are
   `POST /api/session/:id/form/:id/reply` with body `{ answer: { [field]: value } }`.
   Fix `get_pending_question` and `answer_session_question` to read `forms` and use these routes.
3. Permissions (host-client.ts ~854-868, 890-900): `GET /api/permission` and
   `POST /api/permission/:id/reply` 404. Live: listing `GET /api/permission/request`, reply
   `POST /api/session/:sessionID/permission/:requestID/reply` with body
   `{ decision: "once"|"always"|"reject" }` (not `{ reply }`). Fix `approve_permission` /
   `deny_permission`.

## Part 2 — rate-limit bundle (decision D11 in specs/rate-limit-manager-review.md)
In service/taskboard.ts, `getTask` (~513, 562-564) fans out to every registered repo in parallel,
so with N repos one call costs N requests and N-1 return 404. Fix: resolve the issue's repo from the
cached/known issue list first and call that repo alone; only fan out when the issue is unknown.
Also: cache task list/get responses for up to 30 seconds (the human approved this), and serialise the
remaining multi-repo `getTasks` (~354) calls instead of firing them unthrottled.

## Evidence required before you report done
- `npm run verify` green, count reported.
- For each of the three V2 fixes: a live probe against the running V2 host showing the endpoint
  exists and the payload shape is what you coded against (curl or node fetch; report the status code
  and a trimmed response). A test that mocks the host does NOT count — that is exactly how these
  breakages survived the suite.
- A new test per fix that fails against the old code and passes against the new one.

## Output
status; results (per fix: what changed, file:line, the live-probe result); evidence (suite count);
learnings (anything else in the voice client still calling a pre-V2 route).
