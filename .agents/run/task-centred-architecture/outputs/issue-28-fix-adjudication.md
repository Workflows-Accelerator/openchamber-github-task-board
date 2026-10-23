# #28 competing fixes — integration rule

Two independent fixes for the same two reviewed races exist. Exactly one branch lands.

| Candidate | Branch / worktree | Code | Tests | Mechanism (builder claim) | Builder-declared gaps |
|---|---|---|---|---|---|
| A | fix/issue-28-current-board / .worktrees/team-dev-issue-28-current-board | 8625b0a (+658e970 docs) | 7 new, 482 total | bounded admission records (TTL 5 min, cap 400, repo#number) settle on PATCH outcome; overlay only newer local fields; snapshot authoritative for membership; watermark max(request start, existing) | archive/tag add-remove/priority/complexity label writes and issue creation not wired; no browser L3 |
| B | fix/issue-28-review-races / .worktrees/team-dev-issue-28-review-races | 9158bd2 (+2958b1b docs) | 6 new, 481 total | bounded per-request field-guard windows at publication in publishIssueSnapshot/streamRemainingPages/fetchIssues; incremental field reconciliation; non-regressing watermark; guards released on failed PATCH | All Projects aggregate path unguarded; guards only title/body/state/labels; failed edit releases that window's guard; no browser L3 |

Reviews running blind to each other: ses_b1bab8b4b2a6812042618ba4 (A), ses_0146ec98be3044100e05b773 (B).

Decision order, applied to the two review reports:
1. Disqualify any candidate with a standing Critical/High, or a Moderate that the reviewer reproduced inside #28 acceptance criteria.
2. Prefer the candidate that closes R1/R2 for both body and status, in-flight PATCH and failed PATCH, while preserving empty/absent membership deletion and repository-switch admission.
3. Prefer the smaller residual class: an unguarded secondary view (All Projects) is less dangerous than unguarded label/archive/priority write paths, and both must be recorded as follow-up issues rather than silently dropped.
4. If both pass, prefer smaller diff and stronger user-visible regressions; do not merge both.
5. The survivor is merged into feat/v2-binding-and-ratelimit and pushed. master stays human-gated. The other branch is left unmerged and its worktree removed after the survivor lands.

Any Moderate+ fix round goes to a fresh worker in the survivor's worktree with the review's exact remediation, then one bounded re-review.
