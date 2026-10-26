# Human review batch — NOT READY (2026-10-26)

Owner decision17 final corrections: #33 CLEARED and merged/pushed (6b1603f/bf745aa), status:needs-human; hosting preparation slice merged/pushed (4f39e26/54816f6, gate799eda2 PROCEED) and included in the #33 preview member; #35 final R1–R9 correction built at3b4eced and its single authorized independent recheck is running (ses_7eb4eb7c0413e2b80ef3b063), further failure parks the issue. Batch still NOT READY pending #35 and a usable combined preview.

One request only when every included member passes independent hostile review. No master push, issue closure or deployment approval implied by branch integration. This is preparation, not a request to the owner yet.

| Member | Readiness | Human click / expected result (draft) |
|---|---|---|
| #28 — Current tasks on opening | Hostile review PASS; merged/pushed to working branch | Open board, switch repository, refresh. Tasks belong to the chosen repository; a saved edit stays saved. |
| #36 — Only a person closes a task | Hostile review PASS; merged/pushed to working branch | Verify an agent/session change does not close a test task. Explicitly move it to Done, reopen, and archive: human controls still work. Use a disposable owner-approved task. |
| #34 — Answering saves the answer you saw | L4 PASS 0e1a6be; merged c44ed58/proof a2d3fe1, pushed aea7031; awaiting batch | Answer from Questions, Human Tasks and drawer; check exact line on GitHub. Change/delete question before submitting: save refuses and keeps original answer as a separately labelled recoverable draft. Two repositories sharing issue numbers do not share answers/drafts. Failed reads/writes must not report success. |
| #33 — Board in your browser | L4 PASS/APPROVED e4b0091 (actual9router/genius); merged6b1603f/proofbf745aa accepted and pushed; awaiting batch | Sign in at approved preview; view/edit tasks on desktop/phone; malformed/uncertain save replies give refresh guidance, preserve last valid view and typed drafts, and never retry. Confirm overwrite warning, mixed-indent code not offered as question, meaningful Markdown whitespace and no agent controls. Deployment needs owner go. |

## Preview: NOT AVAILABLE YET. One combined request must identify the accepted working branch on both runtimes: installed extension panel for #28/#34/#35/#36, standalone web board for #33. These are distinct implementations; a web-only preview cannot prove the panel fixes. No L5 verdict exists for the above changes.
Preview prerequisites, deployment blockers and the eventual single-request shape are recorded in `L5-preview-plan.md`. Do not request validation before every member passes L4.

## Dependencies and planned additions
- #35 — Other board writes survive refresh: approved bug backlog, after #34 due panel file collisions. Two earlier build attempts and two independent HALT reviews. Decision17 approved one final full R1–R9 correction and one independent recheck, now running. Cannot join the batch until that passes. Do not quietly waive or call addressed by #28.
- #30/#31 — Existing labels + Work Log, changed-question refusal, attention view/base loop: owner choices aligned, design correction under independent review. Implementation follows #34/#35 in the same panel frontier.
- #31 push — Owner approved standalone PWA push with 60s conditional polling. Requires a separate tested push slice after #33 review; extend this batch only once scoped and hostile-reviewed. Real mobile delivery is NOT yet proven.

## Known blind spots
- #28/#36: installed authenticated OpenChamber end-to-end testing not performed; bundle/harness tests are not installed-host proof.
- #36: original body-phase automatic closure could not be reproduced. Defensive guards tested; review notes some gesture plumbing evidence is harness-based.
- #34: independent final review and merged tree passed targeted26/full517/types/build/parity; former draft-isolation defects closed. Real browser rendering, installed authenticated host, clipboard usability and production GitHub writes NOT RUN. Synthetic-host proof is not L3; L5 remains pending, no waiver.
- #33: final independent and merged-tree synthetic proof passed, including 201 browser and 165 HTTP cases; does not prove live repository writes. No route, TLS or board sign-in deployed. Best-effort writes retain the owner-accepted simultaneous-overwrite window. Real keyboard/focus-visible and fresh XSS/DoS remain untested.
- Hosting: selected same-container topology exposes board secrets to local agents. Read-only preflight found bridged container publishes only existing app ports; publishing board port requires container recreation, brief downtime and a start hook. Merged slice now offers loopback-default bind, GET /health and a documented start command with honest limits; secrets are still not provisioned, no port is published, and no proxy/TLS/restart supervision is proven. Actual deployment needs explicit owner go.
- #37: owner confirmed picker includes all token-visible repositories, archived marked and empty selectable. GitHub cannot enumerate hidden private repositories. Known lost-access repositories must be unavailable, not empty. Multi-repository implementation not started.
- Push: OS permission, iOS Home Screen installation/background power behavior and real device delivery require human checks. No push slice has been built.

## Explicitly excluded
#29 live instruction activation, background coordinator and host startup repair remain parked. Private voice/auth/security reports never enter this batch or public receipts.

Only the human records issue-specific pass/bounce and moves tasks to Done. Agent records may cite the owner's verdict but never invent it or check their tasks on the owner's behalf.
