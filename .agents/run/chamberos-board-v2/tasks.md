# Tasks: ChamberOS Board V2

URGENT DELIVERY: user selected A1-A5 foundation first on 2026-11-06 (D30/D31), superseding D29's uninterrupted A1-D3 sequence. Advance minimal preview/release preparation after repair/review; B-D stay approved but deferred. Built/reviewed is NOT Done; no merge, live switch or issue closure authorised.

| ID | Issue | Task | Tier | State | Evidence (feature worktree unless noted) |
|---|---|---|---|---|---|
| task-001 | #55 | Setup and discovery | engineer | COMPLETED | explore/discovery.md |
| P1 | #55 | Read-only live preflight | engineer | COMPLETED | explore/preflight.md (root run state) |
| A1 | #56 | V1 shell and real issue loading | engineer | AWAITING BATCH | verifications/A1/proof.md; audited f7a4f73 |
| A2 | #57 | Infinite canvas and position persistence | engineer | AWAITING BATCH | verifications/A2/proof.md; audited dd9e8ac |
| A3 | #58 | Native dependency links | engineer | AWAITING BATCH | verifications/A3/proof.md; audited d0d5b72 |
| A4 | #59 | Markdown notes and Arrange | engineer build/hostile; genius audit | FAIL — late A5 audit found byte-identity loss; repair/reproof pending | verifications/A4/proof.md; build 9317aa0, hostile 1c21069, audit 341ff45 (manager verified all 6 SHAs, diffs, FR connector screenshot). 618 + web 538, typecheck 0. Open carry-overs moved to A5: undo whitespace, unsaved-draft retry, proof wording. NOT RUN: poll/filter stability, combined edit+drag+arrange failure, touch note drag/resize, 200% zoom, live GitHub. |
| A5 build | #60 | Remaining sidebar sections | 9router/engineer verified | COMPLETED, NOT ACCEPTED | Base 341ff45; HEAD 6c1a3a0 plus ~1900-line dirty core build and untracked A5 tests/proof/screenshots. Claims 618 + web 549, typecheck 0; manager found conflict bypass + client internal-data leak. |
| A5 hostile | #60 | Adversarial review and contained repairs | 9router/engineer verified | COMPLETED | a1e368a..6e189c3 verified; claims 618 + 549, typecheck PASS; proof lacks NOT RUN entries |
| A5 audit 1 | #60 | Independent verdict after hostile | 9router/genius verified | COMPLETED: FAIL / NEEDS-FIXES, coverage incomplete | ses_d3f84e16303e0c741908fe23 was NOT dead; late wake: A4 byte identity fails, client drawer/questions unfiltered, planned counted as draft. No commit; 618 + 549 pass, typecheck 0. Stopped due to overlap. |
| A5 audit 2 | #60 | Independent audit after hostile | genius | COMPLETED: FAIL / NEEDS-FIXES at 81ed5b6 | ses_271a024ed37c3f69adc2eda3 reconciled overlap, fixed Operations statusLabel grouping (47bda6d), reran solo: 618 + web 559, typecheck 0. Left 2 P1 + 7 P2 defects across A4/A5. |
| A5/A4 repair | #59, #60 | Fix 9 audit defects + regression tests | 9router/engineer verified | COMPLETED, NOT ACCEPTED | e90415b, all ten commits verified/tree clean; claims 618 + web 566, typecheck/probes pass |
| Repair hostile | #59, #60 | Critique repair and fix contained defects | 9router/engineer verified | COMPLETED | 175af85 verified/tree clean; claims 618 + web 569, typecheck/probes pass; presentation leaks, note overwrite merge and 360px disclaimer fixed |
| Final audit + preview | #59, #60, #68 subset | Independent A4/A5 audit on packaged foundation preview | 9router/genius verified | IN_PROGRESS | sole worker ses_ea29461718af775b9f917f51, base 175af85 clean; tasks/task-A5-final-audit.md |
| B1-B4 | #61-64 | Batch B per PLAN.md | engineer | PENDING | PLAN.md |
| C1-C4 | #65-68 | Batch C; C4 staging only | engineer | PENDING | PLAN.md |
| D1-D3 | #69-71 | Worktree management | engineer | PENDING | tasks/task-D-worktrees.md |
| A delivery | #55, #68 subset | A-only preview and release preparation | engineer | NEXT after A4/A5 PASS | D30/D31; no live switch authorised |
| L5 | #55-60 | Foundation human review first | human only | PENDING | advanced B-D deferred; no publication authorised |

## Current handover

- First A4 audit (ses_21a1ce0095b4b372b79dce26) fabricated SHAs and test files; rejected. Every worker report now carries an env preflight + "SHAs must exist" rule; manager verifies with git before accepting.
- Hostile review completed at `175af85`, commit verified and tree clean. Sole active final auditor `ses_ea29461718af775b9f917f51` (9router/genius verified once via session.list), base `175af85`.
- User confirmed 401 fixed on continuation. Pre-dispatch session check found no stray repair session; corrected surgical-patch transclusion path. Final independent audit + foundation preview now running; await completion wake without polling. Next: manager verification, short packaging hostile check, then one A1-A5 human validation request. Only PASS/APPROVED permits foundation preview presentation. Per D30/D31, do not dispatch B1 before the urgent foundation release.
- Reopen itself is in the approved A5 scope; destination `status:backlog` is left unchanged and noted for the morning review. No live reopening by agents.
- Root checkout keeps manager state; feature worktree owns application changes and reports. Do not edit worker reports from the root session.
- `npm test` covers legacy test/*.test.js only. Require both this and web/tests/*.test.mjs, plus typecheck. A4 builder's claimed totals 618 + 527 await independent reproduction and accounting.
- A4 build dispatch returned aborted but the worker eventually completed. No duplicate was spawned; do not infer termination from idle or an interrupted tool return.
- A4 receipt: https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/59#issuecomment-6642761912
