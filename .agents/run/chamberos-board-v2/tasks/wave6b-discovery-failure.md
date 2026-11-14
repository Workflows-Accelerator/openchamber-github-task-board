<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
HEAD: d74779b. Tracked tree clean; untracked .agents/run/chamberos-board-v2/verifications/V4-1-L4/ is OFF LIMITS.
Live release: /workspace/releases/board/b85676f-20261113, served by supervisor 1382624 / child 1382667, relaunched detached today with `setsid` and the flag prefix `env -u BOARD_ENABLED -u BOARD_RELEASE_DIR -u BOARD_STATE_DIR -u BOARD_GITHUB_LOGIN -u BOARD_REPO -u BOARD_PASSWORD -u BOARD_PASSWORD_HASH -u BOARD_SESSION_SECRET -u BOARD_GITHUB_TOKEN`.
Supervisor scripts: /workspace/code/openchamber-config/tools/board/start.sh — READ/EXECUTE ONLY, never edit anything under /workspace/code/openchamber-config.
SECRETS, ABSOLUTE: never print, echo, log or commit a token, a password or a hash. You may check presence and length only (`[ -n "$VAR" ] && echo present`, `${#VAR}`).
Forbidden: push, deploy, GitHub writes, deletion, `git remote -v`, delegation, reading board.env contents.
URGENT: the owner reports "Discovery failed — tasks are not refreshed". The board serves but cannot refresh.
</env_preflight>

<goal>
Find why repository discovery fails on the live board, fix it, and prove the board refreshes real issues again. If the cause is authentication, restore the token the service needs without exposing it.
</goal>

<context>
The UI text "Discovery failed — tasks are not refreshed" maps to `web/server/app.ts` (aggregate failures: `discovery.discoveryFailed ? 'Discovery failed; not refreshed'`) and to `DiscoveryUnavailableError` → 503 `discovery_unavailable`. The registry is `web/server/repositories.ts`: 60 s freshness, ETag on single-page lists, `discoveryFailed` retained with last known identities. Discovery is `GET /user/repos` in `web/server/github.ts`.
Leading hypothesis, test it first: today the service was relaunched three times from a worker shell, always with `-u BOARD_GITHUB_TOKEN`, relying on `start.sh` to load the token from board.env or to inherit the container's `GITHUB_TOKEN`. A worker shell may not carry the container's `GITHUB_TOKEN`, and board.env may not contain it at all — so the service could be running with no usable token since the first restart, while health and password login still worked because neither touches GitHub.
</context>

<steps>
1. Reproduce with evidence, no guessing: call the live board's discovery and aggregate endpoints the way the client does (signed out may be enough for `/api/board`; if a session is needed, obtain one by POSTing the board password read from `/workspace/.openchamber-data/board/password-latest.txt` inside the script, and never print it). Record the HTTP status and the exact error body.
2. Read the supervisor and server logs under `/tmp/opencode/board-supervisor/` and the release logs: quote the exact error line and its timestamp.
3. Establish whether the running child has a GitHub token at all, by presence only: check `/proc/<child-pid>/environ` for `GITHUB_TOKEN` and `BOARD_GITHUB_TOKEN` (report present/absent and length, never the value), and check whether `/workspace/.openchamber-data/board/board.env` contains a `BOARD_GITHUB_TOKEN=` or `GITHUB_TOKEN=` line — by counting matches only, never by printing.
4. Distinguish the three candidate causes with evidence: missing token, invalid/expired token (`GET /user` or `GET /rate_limit` with it), or rate limiting (read `x-ratelimit-remaining`/`x-ratelimit-reset` from the board's own last call or reproduce one). Say which it is and quote the proof.
5. Fix minimally:
   - If the token is missing from the service environment, relaunch so it gets one — take the value from the container's own environment (`/proc/1/environ`, presence-checked first) or from board.env, pass it without ever printing it, and keep the detached `setsid` launch.
   - If the token is invalid or expired, do NOT invent a new one: stop and report exactly what is needed and from where, because only the owner can supply a new token.
   - If it is rate limiting, say so and prove the reset time; do not change code.
6. Prove the board refreshes: after the fix, a fresh aggregate call returns real issues (count them), `discoveryFailed` is false, and the rate-limit header shows a healthy remaining budget. Then confirm the public site still serves and health is 200.
7. Make the failure legible, but only if it costs little: check whether the UI already distinguishes `discovery_unavailable`, `github_auth` and `github_rate_limited` (grep `web/public/app.js`). If it shows one generic sentence for all three, report it as a finding; do not change code in this task unless the fix is a one-line message mapping covered by an existing test.
8. Record everything in `.agents/run/chamberos-board-v2/verifications/b85676f-20261113/discovery-failure.md` with the error bodies, the presence checks, the cause, the fix and the proof. Commit as `fix(board): restore repository discovery on the live service`.
</steps>

<output>
At most 12 lines: STATUS (REFRESHING or BLOCKED_ON_OWNER), SYMPTOM (status code + exact error), CAUSE (missing token / invalid token / rate limit / other, with the proof), TOKEN_STATE (present in service yes/no, present in board.env yes/no, presence only), FIX (exact action), PROOF (issues returned, discoveryFailed, rate-limit remaining), UI_LEGIBILITY (distinct messages yes/no), COMMIT, NOT_VERIFIED. Never print a secret.
</output>
