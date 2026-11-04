# Tasks: ChamberOS Board V2

User approved sequential A1-D3 with one combined human review (D29). Built/reviewed is NOT Done; no merge, live switch or issue closure authorised.

| ID | Issue | Task | Tier | State | Evidence (feature worktree unless noted) |
|---|---|---|---|---|---|
| task-001 | #55 | Setup and discovery | engineer | COMPLETED | explore/discovery.md |
| P1 | #55 | Read-only live preflight | engineer | COMPLETED | explore/preflight.md (root run state) |
| A1 | #56 | V1 shell and real issue loading | engineer | AWAITING BATCH | verifications/A1/proof.md; audited f7a4f73 |
| A2 | #57 | Infinite canvas and position persistence | engineer | AWAITING BATCH | verifications/A2/proof.md; audited dd9e8ac |
| A3 | #58 | Native dependency links | engineer | AWAITING BATCH | verifications/A3/proof.md; audited d0d5b72 |
| A4 build | #59 | Attached markdown notes and Arrange | 9router/engineer verified | COMPLETED, NOT ACCEPTED | verifications/A4/proof.md; 9317aa0 |
| A4 hostile | #59 | Break/fix notes and Arrange | engineer, fidelity pending | IN_PROGRESS | tasks/task-A4-hostile.md (root); ses_c2ba5ad900ba26e46590a91d |
| A4 audit | #59 | Independent specification/quality verdicts | engineer | PENDING | after hostile completion |
| A5 | #60 | Remaining sidebar views | engineer | PENDING | tasks/task-A5-sidebar-views.md (verify filename before dispatch) |
| B1-B4 | #61-64 | Batch B per PLAN.md | engineer | PENDING | PLAN.md |
| C1-C4 | #65-68 | Batch C; C4 staging only | engineer | PENDING | PLAN.md |
| D1-D3 | #69-71 | Worktree management | engineer | PENDING | tasks/task-D-worktrees.md |
| L5 | #55-71 | One combined human review | human only | PENDING | no publication authorised |

## Current handover

- Only one active code worker: A4 hostile, ses_c2ba5ad900ba26e46590a91d.
- Root checkout keeps manager state; feature worktree owns application changes and reports. Do not edit worker reports from the root session.
- `npm test` covers legacy test/*.test.js only. Require both this and web/tests/*.test.mjs, plus typecheck. A4 builder's claimed totals 618 + 527 await independent reproduction and accounting.
- A4 build dispatch returned aborted but the worker eventually completed. No duplicate was spawned; do not infer termination from idle or an interrupted tool return.
- A4 receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/59#issuecomment-6642761912
