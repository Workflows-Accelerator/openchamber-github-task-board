# Board scope — all repositories (owner instruction, 2026-10-24)

Owner, in answer to the credentials question: "The board is meant to be for all repos."

## Ruling
The board is not a single-repository tool. Target shape:

- The board lists every repository the supplied GitHub token can read, including private ones the token is granted. No hardcoded `BOARD_REPO` as the only source.
- One repository picker, remembered between visits, plus one combined view across repositories. This mirrors the panel's existing All Projects behavior so the two do not teach different mental models.
- Writes (body sections, answers, status, labels the board already supports) work on any issue the board shows, routed by that issue's repository. No cross-repository copy, move or transfer.
- The token is supplied by the owner and entered as the board app's environment value. Scope is the owner's choice; the board only shows what the token can read. The board never widens its own access and never displays the token.
- The selection is per issue, never per installation: a stale issue object must carry its repository with it so a write cannot land in the wrong repository. This is a hard invariant for the implementation and its tests.

## Consequences
- #33 stays bounded as the single-repository secure board: it is mid-remediation and close to review. Multi-repository becomes the next slice on the same branch, reviewed separately.
- That slice needs: repository enumeration, aggregate issue fetching with a bounded concurrency/rate strategy, repository-qualified issue identity in every cache and write path, a picker and combined view, and regressions proving a write cannot cross repositories.
- `BOARD_REPO` becomes one entry/fallback, not the universe. Existing single-repository deployments keep working.
- Deployment for "all repos" needs the owner to create a token that covers those repositories. The board must not fall back silently to a narrower token scope; a missing repository is reported as unavailable, not empty.

## Confirmed 2026-10-25
- Token identity: Workflows Accelerator bot token, not permission to reuse the container's current token. Actual scope/identity checked safely at deployment; no token value recorded.
- Show all token-visible repositories in picker. Archived repositories marked; empty repositories selectable with no tasks. No exclude-by-default policy.
- Honest access boundary: GitHub cannot enumerate invisible private repositories. Explain this limit. Previously known repositories whose access is lost display unavailable; never fabricate hidden repo names or show errors as empty.
- #37 body updated to these owner answers. Earlier unchecked inline exclude-default answer was unapproved and removed.

## Not decided here
Exact visual layout of picker/combined view; fetch scheduling detail must be bounded/disclosed and must not silently omit repositories. No agent-control change. No public-only restriction. No sub-issue redesign.
