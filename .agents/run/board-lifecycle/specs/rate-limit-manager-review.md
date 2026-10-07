# Manager review of rate-limit-audit.md (2026-10-07)

Checked against the l4r worktree with grep (main.ts). Corrections to the worker's report:

1. NO timer polling exists. No setInterval and no periodic fetch. GitHub reads happen only on:
   panel open/init (818, 963), repo switch (1152), manual Refresh button/menu (5936-5945, 6015),
   after creating an issue (5642), and **whenever any agent session goes idle (534-538) -> full forced
   refetch of every page of every repo**. The visibilitychange handler (6142) does not fetch on its own
   (only one `document.hidden` reference found).
   => Option E ("adaptive polling") throttles something that does not exist. It is dropped.
2. Option B understates the loss. The idle refetch is how the board picks up the agent's OWN edits to
   issues (ticked subtasks, Human Tasks, labels) at the end of a turn. Deleting it would break that.
   Better variants to offer:
   - B1 incremental: on idle, GET issues?state=all&since=<lastSync> (only changed issues; usually
     1 small page), with If-None-Match -> 304 when nothing changed. Intended: no feature loss. UNVERIFIED.
   - B2 targeted: on idle, refetch only the issue linked to that session. Edits made by other people on
     github.com would then show up only on manual refresh or reopen.
3. Option A's claim (304 does not count against the quota) matches GitHub's documentation for
   authenticated conditional requests. Not yet verified: whether the panel's fetch inside the OpenChamber
   webview can read the ETag header and send If-None-Match.
4. All req/hr figures are estimates from the code, not measurements. The worst case (about 1,950 req/hr,
   with 10 repos and 5 looping agents) depends on the assumption of 60 idles/hr per agent.

## Proposed bundles for the user
- Zero-loss: A (conditional requests) + C (comment cache, merge the double PATCH, no full refetch after
  create) + F (#18 retry on every call site) + voice looks up the repo from known issues instead of
  fanning out to every repo.
- Decision needed: idle refresh B1, B2 or keep as is; voice 30s cache yes or no.
