# Integration Merge — Standalone Board Hosting

- **Target branch:** `feat/v2-binding-and-ratelimit`
- **Source branch:** `feat/board-hosting` (HEAD `799eda2f20ddd49c1fd863b984d13dd572b1b268`)
- **Merge commit:** `4f39e264e2211dab54b3bda67251d4328bf75bd5` (`git merge --no-ff feat/board-hosting`)
- **Parent 1:** `ae9418f3667824b6e39173c61858261e9a653bc6`
- **Parent 2:** `799eda2f20ddd49c1fd863b984d13dd572b1b268`
- **Conflicts:** None (0 conflicts, clean automatic merge)

## Verification Gates (Merged Tree)

| Gate / Suite | Command | Exit | Result | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Web Test Suite** | `node --test web/tests/*.test.mjs` | 0 | **349/349 pass**, 0 fail, 0 skipped, 0 cancelled | Includes all 11 hosting tests |
| **Root Test Suite** | `npm test` | 0 | **517/517 pass**, 0 fail, 0 skipped, 0 cancelled | Full root extension regression suite |
| **Web Typecheck** | `npx tsc -p web/tsconfig.json` | 0 | **0 errors** | Clean TypeScript compilation |
| **Root Typecheck** | `npm run typecheck` | 0 | **0 errors** | Clean TypeScript compilation |
| **Root Build** | `npm run build` | 0 | `panel/main.js` (645.1kb), `service/main.js` (31.3kb) | Shipped panel parity verified via `test/shipped-parity.test.js` (18/18 pass) |
| **Web Server Bundle** | `npx esbuild web/server.ts --bundle --platform=node --format=esm --target=node20 --packages=external --outfile=web/dist/server.mjs` | 0 | **101.1kb**, SHA-256 `c385ced6c8fee23852350aa817937ec8ddf5a871dc43bed5be8af0e587674b5d` | Generated bundle gitignored |

## Live TCP Proof (Merged Tree Execution)

Verified via standalone subprocess execution (`/tmp/antigravity/live-hosting-proof.mjs`) running `web/dist/server.mjs` against synthetic GitHub API backend:

1. **Process Liveness & Stability:** Process starts cleanly, binds the socket, and remains up without exiting (`exitCode: null`, PID active).
2. **Default Bind:** When `BOARD_HOST` is unset in the environment, the server binds to `127.0.0.1` by default (observed startup log: `board: listening on http://127.0.0.1:35323 ...`).
3. **Explicit Bind:** When `BOARD_HOST="0.0.0.0"` is provided, the server honours the configured host (observed startup log: `board: listening on http://0.0.0.0:36411 ...`).
4. **GET `/health` (Unauthenticated):** Returns HTTP 200 with JSON payload `{"status":"ok","version":"1.2.1","uptime":0}` without session cookie or authentication headers.
5. **No Secret or Sensitive Data Leaked:** JSON response strictly audited: contains zero token strings, zero password hashes, zero session secrets, zero repository identifiers, and zero issue text.
6. **HEAD `/health` Method Handling:** Rejects with HTTP 405 Method Not Allowed and includes `Allow: GET` response header.
7. **Auth Refusal on Data Routes:** Requests without session cookies to `/api/board` and `/api/issues/42` are rejected with HTTP 401 Unauthorized.

## Tracked State Discipline

- Tracked working tree clean (`git status --porcelain -uno` is empty).
- `web/dist` remains untracked and gitignored.
- Pre-existing untracked files outside scope remained unread, uncopied, unstaged, and untouched.

## Blind Spots & Limits

- **No Reverse Proxy / TLS Termination:** No live Traefik, Caddy, nginx, or TLS certificate validation exercised.
- **No Container Lifecycle & Port Publishing:** No Docker host port mapping or container recreation executed.
- **No External Restart Supervision:** No systemd, supervisord, or init restart persistence tested.
- **No Real GitHub Upstream:** Synthetic local test harness used for all network tests; live GitHub API rate limits and authentication not queried.
- **Model Attribution:** `9router/engineer`.
