# Review adjudication — hostile proof at 9c1a3f8

Reviewer: `ses_9c5fc24b22a5724ccc1ac96d`, actual `9router/genius`, fresh independent session.
Verdicts: Spec Compliance PARTIAL | Quality & Health NEEDS-FIXES | Publication BLOCKED.
Decision: **Accept all 14 blockers and all 9 majors as must-fix. No blocker is parked.** The draft is not publishable. The review proof is primary; the manager's earlier findings are supplementary.

## Adjudicated corrections to the review

- **BLK-01 heading level:** The reviewer notes `## Friendly Title:` parses, but the canonical contract requires `### Friendly Title:`. Use the contract spelling exactly. Put the real Friendly Title at the very top, before any other `Friendly Title:` text. Remove the fenced `Friendly Title:` example from the parseable body or move it outside the body. Do not claim clean rendering while v1 `parseSubtasks` counts acceptance/test-plan checkboxes; record that known parser limitation and make v2 section isolation a concrete acceptance/test item.
- **BLK-05 rate numbers:** The official rate-limit page does document 900 REST points/min and 5-point mutation costs in its secondary-limit point table. Keep those numbers only with a source link and a "general guidance, not guaranteed safe throughput" caveat. The defect is the universal "enforce/max" framing and the 7.2 s fixed floor, not the existence of the point table. 7.2 s remains only arithmetic at 500/hour.
- **BLK-07 proof file:** Verified: `55ddeaa:.agents/run/board-lifecycle/verifications/board-v2-l4/proof-sdk-headers-dropped.test.js` exists. It is a static shape assertion, not runtime proof. Remove "fabricated"/"does not exist anywhere"; correct the anchor to `board.md:121`; say the file is static and the SDK contract inspection is the stronger evidence.
- **BLK-02 intake:** Keep intake as an open decision. Add same-owner transfer limits, private-to-public transfer prohibition, cross-org copy/link/convert fallbacks, and same-owner native sub-issue limits. Add cross-org/client scenario and test.
- **M-05 questions:** Keep exactly the five user decisions. Move rate/cycle/node-ID technical unknowns to "Later proof tasks"; make Q5 a sub-decision under concurrency, not a sixth top-level choice.
- **M-08 baseline:** Add the simple baseline (existing board + labels/body contract + delegate + existing scheduler) and state why the added controller/task tool complexity is worth it, or reduce scope.
- **M-07 banner:** Add a prominent "Proposal only" block: no implementation, branch push, PR, merge, closure, child execution issue, schedule mutation, agent/skill/config change or credential access is authorized by this draft.
- **M-01:** Explicitly retain current `.agents/run` mission/brief/delegate contracts until the issue-derived worker context and controller are proven.
- **M-02:** Define the exploration deliverable and "enough is known to proceed" gate; per-phase model/tool/skill/file plan; small-task defaults.
- **M-03:** Add liveness/attention acceptance and a test that distinguishes human blocking, dependency waiting, runtime failure, ongoing work and completed work.
- **M-04:** Add one authoritative phase/approval representation, native field/issue-type fallback, and a no-dual-write rule.
- **M-06:** Fix design-evidence traceability (scenario 8/9 anchors), the false proof-file claim, the deletion/7.2 s repetitions, and the primary-quota summary. Update base commit references.
- **M-09:** Add the bounded remediation loop: ordinary verifier/test defects return to execution within a bound; human escalation after exhausted budget or a real fork.
- **Reviewer's BLK-08/09/10/11/12/13/14:** Add the reliability/recovery section, migration rollback/pause/ownership/proof gates, `Decisions`/`Next Action`/action IDs/redaction, concurrency residual-race language, provenance labels, native one-parent/cross-org fallbacks, and authority/approval/cancellation policy.

## Constraints for the fixer
- Base on review commit `9c1a3f8`; do not edit or amend the review proof.
- Rewrite the issue body as needed. Preserve the four-axis model, the correct GitHub facts, the fast path, the human authority boundary, and the ten-scenario intent.
- Use exact v1 contract headings. Remove all false compatibility/rendering claims.
- Keep all future checkboxes unchecked. Keep the issue proposal-only.
- No publication, implementation, branch push, PR, merge, schedule mutation, child issue, agent/skill/config edit or credential access.
- Add a `revision-notes.md` mapping every BLK and M to its resolution. If any item cannot be fixed, return it explicitly to the manager; do not silently drop it.
- Commit only the owned proposal artifacts. Return two verdicts and the commit.
