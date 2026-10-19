<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
HEAD: 88999b5 (verifier report commit) at cb1c4ab draft; worktree clean except untracked .agents/idle-nontext-state.json (never commit it)
owned files: .agents/run/task-centred-architecture/{issue-draft.md,design-evidence.md,source-receipts.md,revision-notes.md}
forbidden: push, PR, publish, gh/API writes, reset, touching verifications/final.md or proof.md, any file outside the four above.
</env_preflight>

<goal>
Resolve the two publication blockers, one major and eight minors from verifications/final.md (read it first, at the pinned commit). Make the smallest text changes that make each finding true. Keep the parser at title / 5 questions / 5 human tasks / 17 scenarios / 58 subtasks unless a change below necessarily alters a count — if it does, update the Overview note and report the new numbers.
</goal>

<edits>
B1. BLK-03 — open decisions must not be pre-committed. In issue-draft.md:
- AC "Proportionate Exploration & Fast Path" (currently ~:216): make it phase-taxonomy-neutral. Required meaning: phase depth is proportional to task risk under whichever taxonomy Decision 4 selects; no task, fast path or not, skips independent hostile review or human sign-off.
- AC "Bounded Remediation & Human Authority" (~:217): make it conditional on the autonomy scope chosen in Decision 2. Required meaning: under the approved autonomy scope, ordinary defects return to the permitted execution mode within a bounded retry budget; if the approved scope permits no autonomous edits, they return to human attention instead.
- AC "Recurrence & Run History" (~:219): replace "based on a reusable definition issue" with the run representation selected in Decision 5 (definition issue plus run records, OR single issue plus run ledger). Keep run history/evidence and no-automatic-deletion.
- Scenario 11 (~:287): make it conditional: verify the fast path if, and only if, Decision 4 selects it; if full phases are selected, verify that a tiny task still completes with proportionate ceremony and no skipped review.
- Scenario 8 (~:284): remove "the definition issue and run records" as an assumption; say "the recurring-task representation selected under Decision 5".
- Q5 (~:259) and Human Task 5 (~:266): make the recurring-task decision cover three parts in one decision — run representation (definition plus run records, or single issue plus run ledger), retention/capacity policy, and overlap policy (skip, queue, parallel). Keep them one question and one human task.
B2. NEW-01 — replace every `/api/session/:id/abort` with `POST /api/session/:sessionID/interrupt` in issue-draft.md (~:103, ~:119), design-evidence.md (~:32,148,171) and source-receipts.md (~:48,69). Wording: the route is SOURCE-OBSERVED in the installed OpenCode v2.0.32 protocol; whether interruption stops in-flight tool side effects is NOT RUN, so fencing is still required. Do not claim interruption equals a clean stop.
B3. MAJOR-01 — add a sixth item to "OpenChamber Capability Gaps to Verify": host-daemon storage availability. State that the inspected `@openchamber/sdk@2.4.0` storage API is the guest/panel host API, that a persistent coordinator outside the panel would need a storage route for leases and attempt receipts, and that this is NOT VERIFIED. Also make the `.openchamber-data/` mentions say "subject to that verification".
B4. Minor 1 — the fenced example body still contains `### Friendly Title: <3-6 word outcome>`, which the parser would pick up if it ever preceded the real title. Remove that line from the fence and put the instruction in prose immediately above the fence.
B5. Minor 2 — `POST .../transfer` in Decision 1 (~:44) is not a GitHub mechanism; use the `transferIssue` GraphQL mutation.
B6. Minor 3 — do not assert HTTP 301 for the old issue URL (~:105, ~:186). Say "redirects to the new location (status code not stated in the cited doc)".
B7. Minor 4 — SDK anchor `dist/contract.js:139-141` is stale; `clampStartSessionRequest` starts at line 145 in 2.4.0. Fix in issue-draft.md (~:193) and source-receipts.md (~:47). Keep the behavior claim.
B8. Minor 5 — design-evidence Scenario 6 maps to "Acceptance Criterion 7 (Collision Safety)", which does not exist. Point it at Section 3 "Parallelism & Collision Isolation" and the correct AC (Concurrency & Residual Race Defense).
B9. Minor 6 — design-evidence.md and source-receipts.md base-commit lines: state review base `9c1a3f8` and current fix commits `6b0d8b9`, `41f51f5`, `cb1c4ab`, this one. Do not claim M-06 fully resolved unless the anchors are now right.
B10. Minor 7 — Q1/Human Task 1 must include the third intake option (existing general repository); Q2/Human Task 2 must include the third autonomy option (policy-bounded allowlist including trivial doc auto-merge).
B11. Minor 8 — Decision 4's fast-path sequence must include human verification: `draft -> execution -> verification -> human_verification -> done`, and keep "review and human sign-off never skipped".
</edits>

<steps>
1. Read verifications/final.md and the four owned files at HEAD.
2. Apply B1-B11 only. Do not rewrite unrelated prose.
3. Re-run the actual v1 parsers exactly as the verifier did (`node` type-stripping import of panel/core.ts) and record title, questions, human tasks, test plan, subtasks, unchecked counts.
4. Grep the public body for `/workspace/`, `ses_`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `41f51f5`, `cb1c4ab`, `- [x]`, `/abort`. Zero expected for the first seven and for `- [x]`; `/abort` must only survive inside `rebase/merge` context if at all.
5. Append a short row to revision-notes.md mapping each B-number to the change.
6. Commit the four files: `docs(proposal): resolve final verification blockers`.
</steps>

<output>
<=15 lines: commit hash, parser output verbatim, a B1-B11 checklist done/not-done, grep result, anything you could not fix.
</output>
