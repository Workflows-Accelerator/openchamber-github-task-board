# Human review batch — NOT READY (2026-10-24)

One request only when every included member passes independent hostile review. No master push, issue closure or deployment approval implied by branch integration. This is preparation, not a request to the owner yet.

| Member | Readiness | Human click / expected result (draft) |
|---|---|---|
| #28 — Current tasks on opening | Hostile review PASS; merged/pushed to working branch | Open board, switch repository, refresh. Tasks belong to the chosen repository; a saved edit stays saved. |
| #36 — Only a person closes a task | Hostile review PASS; merged/pushed to working branch | Verify an agent/session change does not close a test task. Explicitly move it to Done, reopen, and archive: human controls still work. Use a disposable owner-approved task. |
| #34 — Answering saves the answer you saw | Fix recovery RUNNING; no proof yet | Answer from Questions, Human Tasks and drawer; check exact line on GitHub. Change the question before submitting: save refuses and shows current text. Failed reads/writes must not report success. |
| #33 — Board in your browser | Independent hostile re-review RUNNING; not merged | Sign in at the approved preview; view/edit tasks on desktop and phone; verify conflict/overwrite warning and absence of agent controls. Deployment still needs owner go. |

Preview: NOT AVAILABLE YET. One integrated working-branch preview required. No L5 verdict exists for the above changes.

## Dependencies and planned additions
- #35 — Other board writes survive refresh: approved bug backlog, after #34 due panel file collisions. Include after its own hostile review; do not quietly waive or call addressed by #28.
- #30/#31 — Existing labels + Work Log, changed-question refusal, attention view/base loop: owner choices aligned, design correction under independent review. Implementation follows #34/#35 in the same panel frontier.
- #31 push — Owner approved standalone PWA push with 60s conditional polling. Requires a separate tested push slice after #33 review; extend this batch only once scoped and hostile-reviewed. Real mobile delivery is NOT yet proven.

## Known blind spots
- #28/#36: installed authenticated OpenChamber end-to-end testing not performed; bundle/harness tests are not installed-host proof.
- #36: original body-phase automatic closure could not be reproduced. Defensive guards tested; review notes some gesture plumbing evidence is harness-based.
- #34: no completed fix yet. Startup failure left no edits; recovery has no empirical result yet.
- #33: synthetic GitHub fakes/browser checks do not prove live repository writes. No route, TLS or board sign-in deployed. Best-effort writes retain the owner-accepted simultaneous-overwrite window.
- Hosting: selected same-container topology exposes board secrets to local agents. Startup persistence and worker/container port path still being checked read-only. Merely binding a bridged container to 0.0.0.0 may not expose a host port.
- Push: OS permission, iOS Home Screen installation/background power behavior and real device delivery require human checks. No push slice has been built.

## Explicitly excluded
#29 live instruction activation, background coordinator and host startup repair remain parked. Private voice/auth/security reports never enter this batch or public receipts.

Only the human records issue-specific pass/bounce and moves tasks to Done. Agent records may cite the owner's verdict but never invent it or check their tasks on the owner's behalf.
