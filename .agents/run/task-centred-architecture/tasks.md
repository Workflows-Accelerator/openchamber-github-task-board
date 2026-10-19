# Research and draft delivery

| Item | Status | Session / actual model | Result | Next action |
|---|---|---|---|---|
| Capture user's vision | COMPLETE | Manager | mission.md, decisions.md, scenarios-to-cover.md | Preserve alignment boundary |
| GitHub research | RETURNED; REVIEW RUNNING | author ses_6b9cfac5fb254d350b6c0246 / 9router/engineer; designated review ses_b56f866fa48707aa35b84356 | GitHub worktree explore/github.md at 5f9ddfa | Await review; reject unsupported claims |
| Accidental duplicate GitHub review | COMPLETED; COLLISION RESOLVED BY COMMIT | ses_faa2494e941ea798902a7432 / 9router/engineer | Rewrote same verifications/github-hostile.md at dd78634; designated 57d6933 preserved in history | No further GitHub reviewer; final reviewer checks both corrections |
| Board research | REJECTED AS STANDALONE AUTHORITY | author ses_a3148e31f7413473a465be92; reviewer ses_5ef16829c229ac460dbfcc8e / both 9router/engineer | Board explore/board.md f77a2a9; verifications/board-hostile.md 952cc90 | Synthesis must resolve review findings and research-rulings.md |
| Skills research | RETURNED; REVIEW RUNNING | author ses_0ffb8b71f9acc1ab15ec25ca / 9router/engineer; reviewer ses_ecc76d3e94111ed255874024 | Config worktree explore/skills.md 8615dee | Await review; manager direct report read denied, no bypass |
| Architecture synthesis | RETURNED; NOT ACCEPTED | ses_0dd4a969a59d0055ee0985f2 / 9router/engineer | Proposal worktree issue-draft.md, design-evidence.md, source-receipts.md at 474e7cb | Independent final review against pinned commit |
| Independent final draft review | COMPLETED; BLOCKED | ses_9c5fc24b22a5724ccc1ac96d / 9router/genius | verifications/proof.md at 9c1a3f8; PARTIAL / NEEDS-FIXES / BLOCKED; BLK-01..14 + M-01..09 | All accepted; fix required |
| Draft fix (first pass) | RETURNED; RESIDUALS | ses_1cafec6386df9e0f4fb684f6 / 9router/engineer | Revision at 6b0d8b9; residual-findings.md | Outcome title, local paths/commits, source URLs, settled choices, Open Questions, tests, template, exploration remain |
| Residual fix (2 attempts) | FAILED, no report | ses_38f90000f9b5d74a598e49d1 genius; ses_c413dd1c73991b1742b13ac0 engineer | Partial uncommitted edits kept | Manager audit: R1-R11 mostly present; gaps = Q3 options, Q5 overlap, Human Task 4 missing, parser run, URL check, commit |
| Residual finish (short) | COMPLETED at 41f51f5 | ses_18e2ff24ab2eeeb7c3388058 / worker | Commit 41f51f5, 4 owned files; parser 5/5/17, 58 subtasks; 10 URLs HTTP 200; 0 redaction hits | Committed, not pushed |
| Hostile review of 41f51f5 | COMPLETED — NOT PUBLISHABLE (4 MINOR, 0 blocker) | ses_6017d8ecf64441d76eed24e0 / worker | Findings F1-F4: "workspace-relative links"; Decision 5 cell semi-settles run representation; Stage 5 sandbox test lacks authorization note; companion paths not sanitized | Apply four surgical fixes, then fresh independent verifier |
| Residual draft fix (superseded) | SUPERSEDED | ses_c413dd1c73991b1742b13ac0 / engineer; ses_38f90000f9b5d74a598e49d1 / genius | Partial edits recovered by the short finisher at 41f51f5 | None |
| Minor fixes to 41f51f5 | COMPLETE at cb1c4ab | ses_2651b3a231590dfb16dcdba1 / worker | 4 files, 6+/3-; parser reproduced 5/5/17/58; companions labelled internal | — |
| Independent final verification (1) | BLOCKED — 2 blockers, 1 major, 8 minor | ses_8973bf564e77d98f3e423974 / genius | verifications/final.md at 88999b5; BLK-03 decisions pre-committed; NEW-01 wrong interrupt route | Fix pass dispatched |
| Fix final blockers | COMPLETE at 37243b4 | ses_e68a35328e3f40363b2edda0 / engineer | B1-B11 applied; parser 5/5/17/58, all unchecked | Re-verified, not accepted as done |
| Independent verification (2) | BLOCKED at 35f362a | ses_b2870669d738e6c8d45e480d / 9router/genius reported | verifications/final2.md; NEW-01/storage/minors resolved; BLK-03 residuals | Residual wording fix applied |
| Residual BLK-03 correction | COMPLETE at 4224d1f | ses_868929b474598c435fa8bb3b / engineer | E1-E7 applied; parser 5/5/17/58 | Third verification |
| Q4 alignment | COMPLETE at ce230ab | ses_e9f850d1dfaf459f8ed6e31f / worker | Q4 offers all three phase models; parser unchanged | Third verification |
| Independent verification (3) | BLOCKED at be21ac1 | ses_6cb04a5b72a851e470167b53 / 9router/genius reported | verifications/final3.md; N-07/N-08 blockers; N-06/N-09/N-10 minor | PAUSED FOR HUMAN; reviews/final3-outcome.md |
| Further draft corrections | AWAITING HUMAN | None running | Proposed two rule corrections plus three minor consistency fixes | Ask approval for one bounded correction/review pass; do not dispatch before answer |
| Publish one deep draft issue | BLOCKED | Not dispatched | Issue URL + body readback still absent | Authenticated GET route exists; write permission NOT verified; needs READY and manager gate |
| Human design choices | PENDING | Human | Decisions mirrored to issue | No implementation before approval |

## Evidence and incident policy
All three research authors returned actual provider/model 9router/engineer. Board reviewer same. Remaining reviewer identities deferred to wakes; no polling. Original source research is untrusted until findings resolved in final draft; preserve original reports and reviews as audit trail, do not silently rewrite them. Final independent reviewer gets all caveats, especially source inspection != live proof.

Duplicate incident: two reviewer sessions were mistakenly dispatched to the same GitHub report path. A stop message to the duplicate was rejected because busy. User informed. Do not spawn more GitHub reviewers while either is active. When both complete inspect git history and report contents before treating either as evidence. No application code writes were authorized.

All application tests, live skill activation, schedule mutations, task controller execution and browser proof: NOT RUN (research-only). No application/agent/skill/config changes, branch pushes, PRs or merges approved.
