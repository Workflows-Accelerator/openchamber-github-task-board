# Owner decision needed — board hosting deployment (later, not now)

Status: NOT A REQUEST YET. This is preparation only; the owner is not being asked to act until the
board slices are accepted and a preview can be shown. Recorded so the eventual ask is complete.

## What the code slice will give us
- Configurable bind with loopback default.
- GET /health liveness without data or secret leakage.
- One documented production start command.
- Honest operations notes in the board README.

## What still needs the owner, by name only
1. `BOARD_GITHUB_TOKEN` — a token that can read the repositories the board should show (#33 one repo,
   #37 all visible). Existing `GITHUB_TOKEN` is NOT approved for reuse.
2. `BOARD_PASSWORD_HASH` and `BOARD_SESSION_SECRET`.
3. `BOARD_BASE_URL` for the public origin.
4. `BOARD_REPO` if the single-repository mode is kept as the base.
5. Decision to publish a board port, which requires container recreation and briefly interrupts
   agents.workflows.ac and live.workflows.ac.
6. Restart supervision: without it the board does not survive a container restart.
7. DNS/TLS route for the chosen hostname through the existing proxy.

## Verification that remains owner-only
Real GitHub token permissions and writes; TLS termination; proxy buffering and header behaviour;
restart persistence; installed-host rendering; a real browser session against the deployed board.

No secret values are ever requested in chat or recorded. Nothing is deployed by an agent.
