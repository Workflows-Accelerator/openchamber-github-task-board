# How the owner will validate the batch (prepared, not yet requested)

Updated 2026-10-26. The batch stays NOT READY until every member passes its independent review and a usable runtime exists. This page is preparation, not a request.

## What the owner must be able to open

| Member | Where the owner validates it | Ready? |
|---|---|---|
| #28 Current tasks when opening | Installed board panel using the accepted integration-branch bundle | Installed-host behavior NOT RUN. A standalone board uses different refresh code and cannot validate this panel fix. |
| #36 Only a person closes a task | Same panel | Same. |
| #34 Answers match the question | Same panel (answer from Questions, Human Tasks, drawer) | Same. |
| #35 Other board writes keep their edits | Same panel (create, archive, tags, priority, status-none, complexity, All Projects) | Final independent recheck running; not accepted. |
| #33 A board in your browser | Standalone board at its own URL, or a locally launched accepted build | Not deployed. The accepted build can be launched locally for a UI review; production deployment is separate and plan-blocked. |

## What blocks the browser-board validation

1. Deployment is authorized in shape (same container, brief interruption) but the current plan failed independent review. Startup supervision, rollback completeness, private-only exposure and route ownership are being corrected and rechecked.
2. Dedicated board credentials are absent from the inspected stores. Only the owner can provision them through an approved secure store; never chat or an issue.
3. A single-route owner and a working authorized transport must be established before publishing the hostname.
4. Installing the accepted build's assets and bundle in a persistent location with a supervisor is separate reviewed configuration work, not part of the board repository.
5. Real GitHub permissions/writes, production TLS/proxy behavior, restart survival and a real-device browser session remain NOT VERIFIED.

## Two user interfaces, one review request

A standalone web preview is not proof of the panel's refresh/write fixes. The combined request must name both surfaces: an installed extension loading the accepted integration-branch panel bundle for #28/#34/#35/#36, and the standalone web board for #33. Do not ask the owner to validate panel-only changes on the separate web implementation. The installed panel's exact bundle identity still needs verification before requesting its checks.

## What the eventual single request contains

- One numbered, plain-language click list per included member.
- For the board: the URL or exact local launch command, and whether deployment is live or a local preview.
- Secret provisioning as an action naming the variables only, through a secure store; no values in chat.
- The known blind spots below.

No separate maintenance-window question is needed: the owner already authorized the aligned container recreation and brief interruption. The deployment proceeds only after a checkpoint makes the runner recoverable.

## Blind spots to state with the request

- Installed authenticated host behavior has not been run by us for any member.
- No production GitHub write has been exercised; only synthetic upstreams.
- Real keyboard focus, real phone layout, clipboard and screen-reader behavior are unverified.
- Best-effort write limits remain; a simultaneous external edit can still be overwritten by the board's own PATCH.
- Proxied sign-in currently shares one throttling bucket; public behavior under proxy is unverified.
