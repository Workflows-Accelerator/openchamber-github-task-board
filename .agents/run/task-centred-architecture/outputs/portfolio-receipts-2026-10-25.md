# Portfolio receipts — 2026-10-25

## Queue reconciled without changing implementation
- #28 was incorrectly still in `status:in-review` although accepted review and integration evidence was already committed. Read the issue and outputs/issue-28-integration.md, then reconciled the body: completed agent subtasks/test evidence, unchanged unchecked human acceptance criteria, one batch-preview Human Task, explicit synthetic-vs-installed-host limit. Moved only status to needs-human. Receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/28#issuecomment-6404839573.
- #36 was incorrectly still todo with the disproven body-phase explanation. Read existing builder and independent reviewer reports; the actual pre-fix gap was label-based or unsignalled internal closure, not body-phase parsing. Rewrote the body into the contract, retained human acceptance unchecked, recorded premise correction and pending installed-host check. Moved only status to needs-human. Receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/36#issuecomment-6404829515.
- Both await the batch; neither issue closed, marked Done or human-validated. No new implementation, production deployment or installed-host verification performed.

## Prepared, not dispatched
- Replaced the oversized accidentally expanded #33 residual-hostile draft with a compact pointer-based XML brief. It remains BLOCKED with FILL_AT_DISPATCH until builder ses_2021ba6f89fc4c9bcc636b07 completes; no duplicate review dispatched.
- Corrected hosting draft contradiction: an explicit BOARD_HOST=0.0.0.0 may be necessary for approved in-container topology; default must remain loopback, invalid hosts fail, never silently widen. This is preparation, not a newly deployed binding.
- Corrected hosting draft artifact claim: web/dist is gitignored; require fresh hash/parity, never force-add or call it committed.
- Fixed proof matrix column alignment and latest state: #33 decision16 correction, #35 correction bounded independent re-review. No new accepted invariant inferred from builder claims.

## Attribution verified from completed records
- #35 correction ses_c1b1f4e26f5cdd9270f22e17 actual `9router/engineer` confirmed from its completed assistant record (one bounded retrieval).
- Prior #33 N1–N5 correction ses_7c6609612c200168dfae85d1 actual `9router/engineer` likewise confirmed. Current residual builder/reviewer attribution remains deferred to their completion wakes.
