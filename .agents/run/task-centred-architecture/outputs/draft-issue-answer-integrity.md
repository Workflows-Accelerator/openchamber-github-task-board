### Friendly Title: Answering a question saves the answer you see

## Overview
A question answer must either be saved exactly to the question the human answered, or fail visibly. Today the board can report success when nothing was written, and the optimistic matcher can attach an answer to a different question after the body changed.

Source evidence (read at `feat/v2-binding-and-ratelimit`, before any fix):
- `panel/core.ts:1241` `resolveOptimisticQuestionAnswer` falls back to matching a completed question and passes that index to `answerOpenQuestionInMarkdown`, which indexes only unresolved questions. A wrong or missing target can result.
- `panel/main.ts:4434` (Questions view) and `:6126` (drawer) call `resolveOptimisticQuestionAnswer` without checking `result.found`; the success toast is shown regardless. The Human Tasks copy at `:3834` does check `found` at `:3870`.
- `panel/main.ts:2021` `reloadIssueBeforeMutation` returns `null` when the fresh read fails, and the answer flows continue against the cached body, so the whole stale body can be PATCHed over a newer remote edit.
- `panel/main.ts:2048` `updateIssueBody` sets the local body before the PATCH and keeps it when the PATCH fails.

Status: reported from source reading by the #30/#31 design; reproduction and exact counts are being verified by an independent review. Not yet proven by a failing test.

### Work Type:
bug

## Acceptance Criteria:
- [ ] Answering a question either writes the answer to that exact question or fails with a visible message; success is never shown for an unwritten or misdirected answer.
- [ ] A question that was reworded, withdrawn or already answered between render and submit is rejected, and the current question is shown.
- [ ] A failed refresh before an answer aborts the write instead of PATCHing the cached body.
- [ ] A failed PATCH restores the previous body and reports the failure.
- [ ] A regression test fails on the current revision for each of these paths and passes after the fix.

### Actionable Subtasks Checklist:
- [ ] Reproduce the wrong-question and false-success paths with the shipped-bundle harness.
- [ ] Reproduce the stale-body write after a failed refresh.
- [ ] Implement one shared answer path used by all three entry points.
- [ ] Add regressions and run the full suite, typecheck and build.
- [ ] Independent hostile review before integration.

### Open Questions:
None blocking. Whether question identity should be a content hash (design #30/#31 §8.2) is part of a separate decision and is not required to fix this defect.

## Test Plan (Issue)
- [ ] Asking a question, editing the body remotely, then answering writes nothing and shows the changed-question message.
- [ ] Answering with the fresh read unavailable writes nothing and shows an error.
- [ ] A rejected PATCH leaves the previous body and no success message.
- [ ] Answering an unresolved question writes the marker to that line only.
- [ ] Full regression suite, typecheck and build pass.
