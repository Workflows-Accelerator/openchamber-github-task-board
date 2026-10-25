# How the owner will validate the batch (prepared, not yet requested)

Nothing here is a request yet. The batch stays NOT READY until every member passes L4 (#33 final check, #35 hostile review). This page exists so the eventual single request is executable without further preparation.

## What the owner must be able to open

| Member | Where the owner validates it | Ready? |
|---|---|---|
| #28 Current tasks when opening | Installed board panel (agents.workflows.ac) OR standalone board when deployed | Panel path likely available; installed-host behavior NOT RUN by us. Standalone not deployed. |
| #36 Only a person closes a task | Same panel | Same. |
| #34 Answers match the question | Same panel (answer from Questions, Human Tasks, drawer) | Same. |
| #35 Other board writes keep their edits | Same panel (create, archive, tags, priority, status-none, complexity, All Projects) | Implementation running. |
| #33 A board in your browser | The standalone board at its own URL | Needs a published port + TLS + secrets; not deployed. |

## What blocks the browser-board validation

`board.workflows.ac` currently cannot serve the board. Read-only preflight found:

1. The container is bridged and publishes only `3000:3000,8477:8477`; a process on `8787` is unreachable from the Traefik host.
2. Adding `8787:8787` requires container recreation, which briefly stops agents.workflows.ac, live.workflows.ac and running sessions. The owner already accepted a brief interruption in principle, but not a specific window.
3. Nothing restarts the board after a crash or container restart; a start hook in `/workspace/config/opencode/entrypoint.sh` (outside this repository) is required and needs owner approval.
4. Board secrets (`BOARD_GITHUB_TOKEN`, `BOARD_PASSWORD_HASH`, `BOARD_SESSION_SECRET`, `BOARD_BASE_URL`) are not provisioned anywhere; reusing the container's existing token or UI password is not approved.
5. The board binds loopback only today; `BOARD_HOST` and `/health` do not exist yet.

## Repo-side preparation that is still unbuilt

- Configurable bind host plus a `/health` endpoint and a scripted start command, so a supervisor can start and health-check it.
- A documented deployment shape (Coolify app with its own port mapping and Traefik route, or the approved in-container hook) with restart behavior stated honestly.
- PWA push (#31) stays out of this batch; it needs TLS and real-device checks.

## Recommended single request when the batch is ready

One message containing: a maintenance window choice for container recreation, who provisions each secret (names only), confirmation of the domain/TLS route, and the numbered click list per member. No secret values in chat or issues.

## Blind spots to state with the request

- Installed authenticated host behavior has not been run by us for any member.
- No production GitHub write has been exercised; only synthetic upstreams.
- Real keyboard focus, real phone layout and clipboard behavior are unverified.
- Best-effort write limits remain; a simultaneous external edit can still be overwritten by the board's own PATCH.
