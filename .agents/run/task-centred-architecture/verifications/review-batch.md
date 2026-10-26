# Human review batch — NOT READY (2026-10-26, updated)

One request only when every included member passes independent hostile review and a usable runtime exists. No master push, issue closure or L5 verdict is implied by branch integration or by the owner's deployment permission.

| Member | Readiness | Human click / expected result (draft) |
|---|---|---|
| #28 — Current tasks on opening | Hostile review PASS; merged/pushed to working branch | Open board, switch repository, refresh. Tasks belong to the chosen repository; a saved edit stays saved. |
| #36 — Only a person closes a task | Hostile review PASS; merged/pushed to working branch | Verify an agent/session change does not close a test task. Explicitly move it to Done, reopen, and archive: human controls still work. Use a disposable owner-approved task. |
| #34 — Answering saves the answer you saw | L4 PASS 0e1a6be; merged c44ed58/proof a2d3fe1, pushed aea7031; awaiting batch | Answer from Questions, Human Tasks and drawer; check exact line on GitHub. Change/delete question before submitting: save refuses and keeps the original answer as a separately labelled recoverable draft. Two repositories sharing issue numbers do not share answers/drafts. Failed reads/writes must not report success. |
| #35 — Other board writes survive refresh | PARKED — final recheck HALT; excluded from the batch | Not part of the batch. Four reproduced ordering defects remain (uncertain state cleared by older reads, older rollback restoring stale labels, malformed aggregate dropping tasks, false uncertain after a successful archive). Owner decision needed before any further work. |
| #33 — Board in your browser | Accepted single-repository web base merged/pushed through54816f6; deployment authorized in shape, plan currently HALT | Sign in at the approved preview; view/edit tasks on desktop/phone; malformed/uncertain save replies give refresh guidance, preserve the last valid view and typed drafts, never retry. Confirm the overwrite warning, mixed-indent code excluded, meaningful whitespace preserved, no agent controls. |

## Preview: NOT AVAILABLE YET

One combined request must identify the accepted working branch on both runtimes: the installed extension panel for #28/#34/#35/#36 and the standalone web board for #33. These are distinct implementations; a web-only preview cannot prove the panel fixes. No L5 verdict exists for any member.

The web base is still single-repository and is NOT the completed all-repository goal. #37 must pass review and integration before that is claimed.

## Active frontier
- #30 — work type from the existing label plus one Work Log sentence; building now on the panel frontier freed by the #35 park.
- #37 — multi-repository build at 5b231ff under independent hostile review; no acceptance yet.
- Deployment — plan recheck returned HALT with seven open plan defects; a corrected runbook follows the startup supervisor build. Readiness stays HALT until dedicated credentials, a tested transport and a reviewed, human-merged startup hook exist.
- #31 — queued behind #37; its resume boundary still needs the owner's choice.
- Sign-in throttling behind the proxy shares one bucket; this needs an owner decision before public exposure.
- #35 — parked under the decision17 ceiling; excluded from this batch.

## Known blind spots
- #28/#36: installed authenticated OpenChamber end-to-end testing not performed; bundle/harness tests are not installed-host proof.
- #36: original body-phase automatic closure could not be reproduced. Defensive guards tested; review notes some gesture plumbing evidence is harness-based.
- #34: independent review and merged tree passed targeted26/full517/types/build/parity. Real browser rendering, installed authenticated host, clipboard usability and production GitHub writes NOT RUN.
- #33: final independent and merged-tree synthetic proof passed, including 201 browser and 165 HTTP cases; does not prove live repository writes. Best-effort writes retain the owner-accepted simultaneous-overwrite window. Real keyboard/focus-visible and fresh XSS/DoS remain untested.
- #35: panel-only changes cannot be validated on the standalone web implementation.
- #37: GitHub cannot enumerate hidden private repositories; no real multi-repository token has been exercised. Known lost-access repositories must show unavailable.
- Hosting: deployment shape and interruption are authorized. Not deployed. No proxy route, TLS, restart survival or real sign-in is proven; secrets are not provisioned.
- #31 push: OS permission, iOS Home Screen installation/background power and real device delivery require human checks. No push slice has been built.

## Explicitly excluded
#29 live instruction activation, the background coordinator and host startup repair remain parked. Private voice/auth/security reports never enter this batch or public receipts.

Only the human records issue-specific pass/bounce and moves tasks to Done. Agent records may cite the owner's verdict but never invent it or check their tasks on the owner's behalf.
