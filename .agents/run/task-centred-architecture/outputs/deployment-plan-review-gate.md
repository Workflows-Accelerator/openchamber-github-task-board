# Deployment plan gate — HALT, 2026-10-26

Independent reviewer ses_936460fe0bd87f959b191af0 actual9router/engineer returned Security NEEDS-FIXES / Spec PARTIAL / Quality NEEDS-FIXES / HALT. Manager read complete191-line private report, which remains untracked in the ops worktree. Deployment is not approved for execution from this plan. No production changes, master merge or issue closure occurred.

## Accepted required corrections
- Dedicated credentials via a secure store only, never chat, public issue or command arguments. Username is a required non-secret identity pin, not another credential; verify the securely supplied token belongs to the approved bot rather than simply accepting any returned login. All-repository target must not be replaced by single-repo staging coverage.
- Genuine bounded crash supervision and non-blocking startup in a separate configuration-repository worktree; no live checkout edits. Immutable accepted artifact and associated assets/dependencies must survive recreation. Explicit opt-in and safe disable required. No master merge without the human.
- Private-only port exposure and inspected single route ownership with an actually usable authorized transport. Missing transport is a blocker, not authority to collect new keys or bypass access controls.
- Complete checkpoint and reversible startup/environment/network rollback before container recreation terminates the runner. Adjacent-service baselines must be accurately recorded; a prior failing service must neither be called healthy/dormant without evidence nor silently repaired outside scope.
- Direct-peer login throttling means all proxied users share a bucket. Verify practical public behavior and return any necessary behavioral/security change to alignment; do not silently trust arbitrary forwarding headers.

## Reviewer claims not accepted as written
- GET /health is deliberate; HEAD returns405 with Allow: GET, proven in accepted hosting checks. Proposed curl -I /health expecting200 is wrong.
- Actual current endpoints include /api/session and /api/board; reviewer /api/login and /api/issues are not accepted startup/readiness commands. Exact HTTP commands must follow current source, not be invented.
- Artifact may reside in an immutable release directory with the required relative layout; it is not technically required to run from the mutable main checkout. Choose only a plan that preserves assets/dependencies and reviewed identity, never deploy whichever source HEAD happens to contain.
- 'No router', 'dormant', specific failure cause and exact Docker container name are not established by HTTP503/502 or app UUID alone. Do not publish private topology or represent these as observed current infrastructure state.
- Reversal must restore captured originals and remove only newly introduced board material, not blanket-delete unrelated/pre-existing keys. Disable before restart; no rebase/reset/force commands.
- Initial manager assertion that hosting absent from ops worktree was DISPROVEN by git log:40952c6 descends54816f6/4f39e26. Brief corrected. Private reviewer context did not depend on that false claim.

## Next
One report-only plan correction against these findings, then an independent recheck. Config implementation can proceed after a corrected plan passes, while actual deployment remains blocked on dedicated credentials, tested transport/recovery and reviewed configuration. No automatic production mutation follows a report PASS.
