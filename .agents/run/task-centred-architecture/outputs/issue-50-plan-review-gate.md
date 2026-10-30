# #50 independent plan review — implementation blocked

Date: 2026-10-30
Reviewer ses_87ec0e1d219dd203f59caadf completed actual9router/engineer at07a23c5. Spec PARTIAL / Quality NEEDS-FIXES. Manager read findings.md90lines and verifications/proof.md62lines. Zero app edits.

Accept required corrections:
1. Unresolved product fork: automatic board-open connection request vs explicit user connection check. D58 preparation is not approval for either. User must choose. Automatic request is allowable after explicit approval and only if existing host capability grant permits it; never auto-grant or silently start agents/tasks.
2. Remove unnecessary /status returning ownerId/activeLeases. Minimal authenticated GET /health suffices for supported caller; no process/lease/config disclosure.
3. No silent catch. Distinguish capability-disabled/denied from real service/request failure, with observable sanitized diagnostics. Don't blindly log Error objects (could contain private details); exact error-code meaning must be checked in installed SDK before coding. Minimal failure feedback must not claim a connection succeeded.
4. Strict full-string integer port1..65535 and nonempty token; malformed or missing config fails quickly with sanitized stderr and nonzero exit. Do not use permissive parseInt that accepts trailing text. Validate before coordinator/storage startup.
5. Authentication handles wrong-length/malformed tokens without exceptions; fixed-size SHA256 digests + timingSafeEqual is acceptable and minimal. No bearer values in logs/URL/argv. Body/header/time limits and shutdown must be bounded.
6. Preserve module-import APIs/no listener side effects, existing lease behavior and other-owner unexpired leases; built-artifact tests required. #51 remains sequential.

Qualify reviewer claims: this is a plan flaw, NOT an implemented exploitable cryptographic defect. Node equal-length requirement established; the report's absolute 'zero length-leakage side channels' is not empirically proved by functional examples. SHA hashing is a proposed safe implementation, not a universal cryptographic proof. /health proxy round-trip is source-grounded here; actual authenticated parent is still unverified. 'Under10lines' caller constraint is not binding if it prevents proper errors/tests. Explicit-action alternative may require a narrowly approved UI action; no speculative settings system or arbitrary line limit.

Next: one user question selecting automatic-on-board-open (existing grant required; diagnostics on failure) vs explicit connection check. Recommendation: board-open for seamless use and no new everyday toolbar control, with no agent/task/label automation. Current service only prunes local expired locks. Starting it is a runtime change and must not be hidden behind 'read-only request'. Whichever choice is made applies to local preparation only; runtime activation/publication still awaits batched L5.

After answer: record D59 and issue receipt, dispatch fresh planner correction in same worktree with this ruling+findings. GitHub status updated to status:needs-human on 2026-10-30; body/comment text edits with inline Human Tasks were permission-denied by the shell policy and were not retried. Zero application code until corrected plan passes independent critique and fork settled. #49 accepted84d2e39 awaiting batch, #51 queued; no worker active now, no duplicates/polling.
