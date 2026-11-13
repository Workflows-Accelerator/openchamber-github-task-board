# b85676f — "Discovery failed — tasks are not refreshed" on the live board

Date: 2026-11-13
Branch: `feat/board-v3` (worktree `team-dev-board-v3`, HEAD `d74779b`)
Live release: `/workspace/releases/board/b85676f-20261113` (`current` symlink)
Public endpoint: `https://board.workflows.ac` (origin `127.0.0.1:8787`)
Scope: read-only diagnosis of the live service. No GitHub repository was mutated, no secret was
printed, no release or supervisor file was edited.

---

## 1. Symptom and where the text comes from

`web/public/app.js:6315` renders the sentence when `/api/repos` reports `discoveryFailed: true`:

```js
var message = view.discoveryFailed ? 'Discovery failed — tasks are not refreshed.' : ...
```

The server sets that flag when a discovery refresh throws: `web/server/repositories.ts:91-93`
(`catch { this.failed = true; }`). The aggregate path repeats it as
`'Discovery failed; not refreshed'` (`web/server/app.ts:1628`) and write paths refuse with
`503 discovery_unavailable` (`web/server/app.ts:456`, `542`).

## 2. Reproduction

Probe: sign in with the board password read inside the script, then call the two endpoints the
client calls. A forced call at 18:31:09Z was healthy; the first non-forced refresh after the 60 s
freshness window failed:

```
18:35:20Z  GET /api/repos            status 200  discoveryFailed false  fetchedAt 18:35:20.930Z
18:36:22Z  GET /api/repos (after 62s) status 200 discoveryFailed true  fetchedAt 18:35:20.930Z
           error: "Repository discovery failure; refresh later. Last known identities retained."
18:37:54Z  GET /api/repos (next TTL)  status 200 discoveryFailed false  fetchedAt 18:37:54.029Z
```

The failed attempt is the *conditional* refresh: the registry sends `If-None-Match` with its cached
page-1 ETag (`repositories.ts:69-70`). A single failed attempt is then served to every client for up
to 60 s because `attemptedAt` is set before the request (`repositories.ts:67`) and non-forced calls
return the failed snapshot until the TTL expires (`repositories.ts:48-50`).

The exact failure cause is not recoverable: `catch { this.failed = true; }` discards the error and
nothing writes it to a log. `board.log` contains only the startup line.

## 3. Token state — presence only, never the value

| Check | Result |
|---|---|
| `/proc/1/environ` `GITHUB_TOKEN` | present, length 40 |
| `/proc/74/environ` (supervisor) `BOARD_GITHUB_TOKEN` | present, length 40 |
| `/proc/112/environ` (board child) `BOARD_GITHUB_TOKEN` | present, length 40 |
| child token equals container `GITHUB_TOKEN` | yes (compared in memory, no value printed) |
| `board.env` lines matching `BOARD_GITHUB_TOKEN=` | 0 |
| `board.env` lines matching `GITHUB_TOKEN=` | 0 |
| token class | classic PAT (prefix mapped, value not printed) |
| `GET https://api.github.com/user` with the child's token | `200` |
| `GET /rate_limit` with the child's token | core 4777/5000 remaining, graphql 4880/5000 |

`board.env` holding no token is by design: `start.sh` states the token comes from the container
environment and copies `GITHUB_TOKEN` into `BOARD_GITHUB_TOKEN`.

## 4. Which candidate cause it is

- **Missing token — ruled out for any running server.** `web/server/config.ts:248-251` calls
  `requireValue(..., 'BOARD_GITHUB_TOKEN', ...)`, which throws on empty, so a tokenless board does
  not start and `/health` would not answer. `start.sh` step 5 also skips startup when the variable
  is empty.
- **Rate limit — ruled out.** The service token had 4777 core requests remaining; twenty concurrent
  conditional list requests all returned `304`, none `403`/`429`; the live payload reported
  `rateLimit.remaining 4980/5000`.
- **Invalid or expired token — not on the running service.** `GET /user` with the child's own token
  returns `200` and discovery lists 27 private repositories.

What remains is a transient upstream/network failure on one refresh, or an unusable token in the
process that ran before the container was recreated at **18:19:45Z**. The brief names supervisor
`1382624` / child `1382667`; neither PID exists, and PID 1 (`tini`) and the supervisor both started
at 18:19:45-46Z, so the container was recreated after the report. That earlier process, and the
error it swallowed, are gone.

## 5. Fix

None was needed on the running service, and none was applied: a relaunch would have been an
unnecessary outage. The live child (PID 112, started 18:19:46Z by supervisor PID 74) already carries
the container's valid token, as the table above shows.

## 6. Proof that the board refreshes real issues

Captured at 18:53:29Z (`.agents/run/chamberos-board-v2/verifications/b85676f-20261113/proof.json`):

| Check | Result |
|---|---|
| `GET /api/repos?refresh=1` | `200`, `discoveryFailed false`, `stale false`, 27 repositories, `error null` |
| `GET /api/combined/board?refresh=1` | `200`, 345 issues, `discoveryFailed false`, `partial false`, `complete true`, 0 failures |
| newest GitHub issue (`GET /repos/.../issues?sort=created&direction=desc`) | `#71`, present in `/api/board` payload |
| rate-limit budget after the refresh | graphql remaining 4980/5000 |
| `GET /health` | `200 {"status":"ok","version":"1.2.1"}` |
| `https://board.workflows.ac/` | `200` |

Stability runs, all `discoveryFailed: false`:

- 10 consecutive `/api/repos` polls at 30 s spacing (18:43:40Z-18:48:12Z), each TTL refresh successful.
- 3 full UI sequences `/api/repos` then `/api/combined/board` at 61 s spacing (18:49:58Z-18:52:09Z),
  345 issues and 0 failures every cycle.
- A replica of the release with the registry `catch` instrumented, 4 conditional refreshes: all
  `etag=sent`, all successful, no exception. This rules out a deterministic ETag/304 defect.

## 7. UI legibility — finding, not changed

`app.js` shows one sentence for every discovery failure. The payload has no cause code: the registry
returns a fixed string (`repositories.ts:104`). Distinct codes exist only on write paths
(`github_unauthorized` 502 / `github_rate_limited` 503, `app.ts:295-308`) and `discovery_unavailable`
503. So a missing token, a rejected token and a rate limit are indistinguishable to the user, and
"refresh later" is the only advice. Changing this needs a server-side cause field and a UI mapping,
which is outside this task's one-line-message allowance.

## 8. Residual risk

1. A relaunch from a shell that does not inherit `GITHUB_TOKEN` makes `start.sh` skip silently and
   leaves the previous child serving. If that child's token is stale, discovery fails while health
   and password login still pass — the reported signature.
2. A discovery failure leaves no diagnostic trace: the registry discards the error, so neither the
   supervisor log nor `board.log` can say whether the cause was auth, rate limit or network.

## 9. Commands used (secrets never printed)

- `node` probe: `POST /api/session` with the password read from
  `/workspace/.openchamber-data/board/password-latest.txt`, then `GET /api/repos`,
  `/api/combined/board`, `/health`.
- `tr '\0' '\n' < /proc/<pid>/environ | awk ...` to report presence and length only.
- `grep -c '^BOARD_GITHUB_TOKEN=' /workspace/.openchamber-data/board/board.env` (count only).
- `node` fetch of `https://api.github.com/user` and `/rate_limit` with the child's token, printing
  status and rate-limit headers only.
- `esbuild` bundle of `web/server/github.ts` into `/tmp/opencode` to exercise the conditional list
  directly; instrumented replica of the release in `/tmp/opencode/board-replica` on port 8799.

Untouched: `.agents/run/chamberos-board-v2/verifications/V4-1-L4/`, the release directory,
`/workspace/code/openchamber-config`, `board.env`.
