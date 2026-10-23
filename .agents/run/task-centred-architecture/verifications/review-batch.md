# Review batch — prepared skeleton (2026-10-23)

Purpose: one human review ask, not a drip. Fill in only after every member passes independent review.

Members (each must pass L4 before the batch is reviewable):
1. #28 — tasks shown current on opening: membership, repository races, edit preservation. Preview branch `feat/v2-binding-and-ratelimit`.
2. #29 — workers briefed by issue link with append-only write-back: shared instruction exception. No UI surface; human check is whether the wording gives away control.
3. #33 — standalone web board: full task viewing/editing in a browser, no agent control.

Human asks must be plain language, numbered, per issue, with what to click and what should happen. No commit slugs, no ticket mechanics.

Known blind spots to state honestly:
- #28: installed authenticated browser E2E and visual polish not covered by fixtures.
- #29: permission isolation is instruction text, not capability enforcement; native sub-issue linkage unverified; board attention does not read comment-only questions.
- #33: deployment, DNS, TLS and real sign-in not performed; synthetic GitHub fixtures only.

Not in this batch: background coordinator, host startup repair (parked), #30/#31 design (decisions first).
