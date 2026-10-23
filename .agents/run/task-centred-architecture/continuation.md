# Current continuation — 2026-10-23 (late)

## Aligned direction
Issues are the durable work record; the board is the human interface. User chose a **standalone web board with no agent control** (GitHub tasks fully viewable/editable in a browser, own sign-in, no OpenChamber change, no agent starting). Background coordinator and host startup work are parked and not prerequisites. Feature vs bug paths and the questions/notification loop are being designed before implementation. "Expiration" in the bug path stays undefined; no destructive semantics. Only the human moves Done and authorizes master/deployment.

## Proven
- **Issue-only briefing works.** Pilot #32: worker A briefed with only the issue URL plus an environment/permission envelope did its check and wrote append-only comments; worker B, briefed identically later, reconstructed scope, completed work and one next action from body and comments alone. Manager spot-check passed (body byte-identical, 3 comments, both worktrees clean). Receipt issuecomment-6374752409. NOT proven: native parent/child links, permission isolation, unattended claiming, any write beyond comments.
- #28 first-round review found and reproduced two Moderate races (older full refresh overwriting a saved edit; older paginated full snapshot overwriting newer incremental fields). Membership/empty/supersession passed. 475 suite tests, 23 targeted, byte-identical rebuild.
- #29 governed exception wording: three instruction files (team, dynamic-agent, xml-briefs) at 9226ce6, 129 + 46 tests green. Two hostile rounds each found attack paths; PARKED, not enabled live. Permission isolation is prose only.
- #27 route resolved: extension-only self-mount falsified (SDK top-level HOST_UNAVAILABLE; frame only talks to window.parent; sandboxed asset URL cannot reach /api). Persistent board-only URL would need a host `/board` route; user rejected that path and chose the standalone app instead.

## Active workers (no polling)
- ses_378f93479ec515c057fc0443 #28 F1 repair of fix A (8625b0a) in .worktrees/team-dev-issue-28-current-board, brief tasks/issue-28-f1-fix.md. F1: cap 400 smaller than a 1000-issue scan and eviction spares no pending write, so a 500-issue incremental can evict ~100 admissions and clobber an in-flight successful edit. Must raise the bound, never evict pending, add three red-first regressions.
- ses_0146ec98be3044100e05b773 #28 hostile review of fix B (9158bd2) in .worktrees/team-dev-issue-28-review-races — STALLED during its 100-seed fuzz run (10-min shell cap); final report still expected, not duplicated. If it never returns, fix A + F1 repair is the survivor on the strength of its completed review.
- ses_99fa07cbd46f55af87bb74db #33 hostile security review in .worktrees/team-dev-issue-33-standalone-board, brief tasks/issue-33-hostile-review.md.
- ses_88388f2f1250dabb57bdde2e #30/#31 design hostile review in .worktrees/team-dev-issue-30-31-design, brief tasks/issue-30-31-design-review.md.
- #28 fix A review COMPLETE (ses_b1bab8b4b2a6812042618ba4, e3fb381): Spec PASS, reviewed-race closure PARTIAL, Quality NEEDS-FIXES, PROCEED-WITH-CONDITIONS. F1 Moderate/gating (above). F2 issue-creation-during-refresh dropped, F3 archive/tag/priority/complexity writes clobbered — both ruled pre-existing and outside #28's literal AC, to become follow-up issues. F4–F6 Low. 100-seed fuzz 0 fail (20/20 fail on 88d3970), chaos 30 seeds clean, 482/482. Review report outputs/issue-28-hostile-review-8625b0a.md.
- #30/#31 design RETURNED at 12c4dc8 (.agents/run/issue-30-31-design/proposal.md): one body field `### Work Type: feature|bug|undecided`, freeform `### Work Log:`, existing statuses/labels/attention unchanged; question identity by content hash + shared answer path with stale rejection; first notification loop = views + rail badge counting distinct blocked issues + one content-free summary toast deduped in host.storage; no OS notification because the emit route is unverified from a panel guest. Decisions D1 body field (rec), D2 quiet loop (rec), D3 reject stale answer (rec). Claims a real answer-integrity defect; reviewer is verifying it before an issue or fix is created. Draft issue text at outputs/draft-issue-answer-integrity.md.
- #33 standalone board DELIVERED at af62a4e (+5ac82c2 docs): web/** only, 68/68 tests, tsc, esbuild, 29/29 Obscura checks, 10 screenshots; manager eyeballed desktop/360/conflict and they hold. Honest residuals: real Tab traversal NOT RUN, GitHub If-Match on PATCH unverified, no real-credential run, binds 127.0.0.1 behind TLS proxy, Overview-only prose editing.
- Deployment probe: workflows.ac on nginx; board.workflows.ac fails TLS chain verification; no DNS/proxy/TLS change made. outputs/deployment-readiness.md.

## Issues
- #26 parent vision (receipts updated). #27 standalone board (user chose no-agent-control shape; receipt issuecomment-6374341925 and later narrowing). #28 current tasks on opening. #29 workers use sub-issues. #30 feature vs bug. #31 questions/notifications. #32 pilot (proven, stays open, body boxes unchecked). #33 standalone web board implementation.
- gh writes intermittently denied ("Permission denied: shell") on some comment bodies and once with a TLS timeout; retry with shorter neutral wording works. Reads always fine.

## Parked
- Host startup repair: branch fix/coordinator-host-contract, 5c22202 impl / 81b8e27 review / 411d919 transport report, worktree .worktrees/team-dev-coordinator-host-contract. Not merged, no installed activation, lease/CAS safety defects remain. Not a dependency.
- #29 live activation of the exception; wording at 9226ce6 only in worktree.
- Voice reference worktrees and their private security reports: stay local, never publish.

## Next
1. Fold #28 replacement result; independent hostile review of the fix in its worktree; no duplicate merge with the original worker's branch.
2. #33 result -> hostile review (auth, credential exposure, lost updates, responsive page) -> then a user-visible local run for their look.
3. #30/#31 design -> present only its genuine decisions.
4. One batched human review ask for #28/#33; #29 wording may be included as a read-only item. No master, no deployment.
