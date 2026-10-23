# #28 competing fixes — integration rule

## RESULT (2026-10-23): fix A survives, fix B is halted

- **A (8625b0a, .worktrees/team-dev-issue-28-current-board):** independent review e3fb381 — Spec PASS, race closure PARTIAL, Quality NEEDS-FIXES, PROCEED-WITH-CONDITIONS. One gating defect F1 (tracker cap 400 smaller than a 1000-issue scan, eviction spares no pending write). F1 repair dispatched (ses_378f93479ec515c057fc0443). Everything else verified: red-first, 100-seed fuzz clean, chaos clean, 482/482.
- **B (9158bd2, .worktrees/team-dev-issue-28-review-races):** independent review 1270070 — Spec PARTIAL, Quality NEEDS-FIXES, machine HALT. New High: a failed body/status edit is published to display and cache when a refresh completes during the in-flight PATCH (pre-fix PASS). R1 not fully closed; two further Moderates (slow successful PATCH still reverted by a refresh started mid-write; incremental guards overwrite fresher full-page fields). Fuzz: edit-lost 16/100, failed-edit-shown 22/100.
- **Decision:** integrate A after its F1 repair and a bounded re-review. Do not merge B; keep its branch and worktree until A lands for audit, then remove.
- Follow-ups (not part of #28): issue creation during refresh dropped (A F2); archive/tag/priority/complexity write paths still clobbered (A F3); All Projects aggregate clobbers a successful edit (B review, pre-existing). These become one follow-up bug issue after A lands.

---

| Candidate | Branch / worktree | Code | Tests | Mechanism (builder claim) | Builder-declared gaps |
|---|---|---|---|---|---|
| A | fix/issue-28-current-board / .worktrees/team-dev-issue-28-current-board | 8625b0a (+658e970 docs) | 7 new, 482 total | bounded admission records (TTL 5 min, cap 400, repo#number) settle on PATCH outcome; overlay only newer local fields; snapshot authoritative for membership; watermark max(request start, existing) | archive/tag add-remove/priority/complexity label writes and issue creation not wired; no browser L3 |
| B | fix/issue-28-review-races / .worktrees/team-dev-issue-28-review-races | 9158bd2 (+2958b1b docs) | 6 new, 481 total | bounded per-request field-guard windows at publication in publishIssueSnapshot/streamRemainingPages/fetchIssues; incremental field reconciliation; non-regressing watermark; guards released on failed PATCH | All Projects aggregate path unguarded; guards only title/body/state/labels; failed edit releases that window's guard; no browser L3 |

Reviews ran blind to each other: ses_b1bab8b4b2a6812042618ba4 (A), ses_0146ec98be3044100e05b773 (B).

Decision order, applied to the two review reports:
1. Disqualify any candidate with a standing Critical/High, or a Moderate that the reviewer reproduced inside #28 acceptance criteria.
2. Prefer the candidate that closes R1/R2 for both body and status, in-flight PATCH and failed PATCH, while preserving empty/absent membership deletion and repository-switch admission.
3. Prefer the smaller residual class: an unguarded secondary view (All Projects) is less dangerous than unguarded label/archive/priority write paths, and both must be recorded as follow-up issues rather than silently dropped.
4. If both pass, prefer smaller diff and stronger user-visible regressions; do not merge both.
5. The survivor is merged into feat/v2-binding-and-ratelimit and pushed. master stays human-gated. The other branch is left unmerged and its worktree removed after the survivor lands.

Any Moderate+ fix round goes to a fresh worker in the survivor's worktree with the review's exact remediation, then one bounded re-review.
