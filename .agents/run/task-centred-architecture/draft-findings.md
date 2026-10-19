# Manager findings — synthesis draft at 474e7cb

Status: pre-adjudication. Independent review `ses_9c5fc24b22a5724ccc1ac96d` is running. These are manager gate observations, not accepted proof and not a substitute for the reviewer. No publication until the review and a revised draft pass the gate.

## A. Parser and format blockers

- A1. Body line 3 uses `## Friendly Title` with no colon. Contract and `parseFriendlyTitle` require `### Friendly Title:`. The draft will not expose a friendly title in the simplified views.
- A2. Lines 68, 80, 102 and 109 use `## Acceptance Criteria`, `## Actionable Subtasks Checklist`, `## Open Questions` and `## Human Tasks`; the contract requires level-3 headings with a trailing colon: `### Acceptance Criteria:`, `### Actionable Subtasks Checklist:`, `### Open Questions:`, `### Human Tasks:`. `## Overview` and `## Test Plan (Issue)` are correct.
- A3. The “Compatibility Shell Note” asserts parser compatibility that is false as written. Remove the claim or replace it with an exact, testable statement after a parse check. Do not claim current rendering until evidence exists.
- A4. Line 1 (`Title: ...`) is publication metadata, not body. The publisher must strip it; the reviewed body must start at `### Friendly Title:`. Make this explicit.
- A5. The task-body template (lines 40–58) must add `### Decisions:` and `### Next Authorized Action:` (or equivalent) and must not imply that a session ID is durable public evidence.

## B. Unapproved choices presented as settled

- B1. Acceptance C2 says Quick Add captures into “a private intake repository”. Intake home is an open decision. Make the criterion conditional on the selected intake home.
- B2. Acceptance C9 and the Stage 2 checklist assume a host background daemon. Hosting is an open decision. State the outcome generically (“the chosen single-authoritative controller”) and keep the hosting route as a decision.
- B3. Human Task 2 directs creation of `org/intake`. Make it conditional: “Approve an intake home (candidate: dedicated private repository) and authorize its creation only if selected.”
- B4. Test Plan Scenarios 1, 2 and 6 assume the private intake repository and per-run child issues. Make each scenario conditional or state which option it exercises.
- B5. Stage 2 “Create host background coordinator daemon”, Stage 4 “purging deleted items”, and Stage 5 scheduler adapter read as authorized implementation. Label the whole checklist “Proposed migration slices — not authorized until the design decisions and pilot scope are approved.”
- B6. Keep the Section 2 table as recommendations, not selections. Replace strawman alternatives (“Full Autonomy: rejects user control”; “Panel Iframe Loop: dies”; “Unverified Auto-Closure: fatal”) with fair tradeoffs.

## C. Evidence and API overclaims

- C1. `task.claim`, `task.update`, `task.ask`, `task.record_evidence`, `task.handoff` are invented API names. Describe the semantic operations instead and say the tool name/interface is undecided.
- C2. `host.storage` is an unverified host capability. Say “a supported extension-owned storage route, exact API to be verified”; `.openchamber-data/` may be named only as a source-observed path, never as an approved schema.
- C3. “Detects crashes” and “recover idempotently” overclaim. Say reconciliation is best-effort, lease expiry is not proof of death, and arbitrary side effects are not exactly-once. Name the residual duplicate/orphan risk and the fencing requirement where effects can be checked.
- C4. “Detect external human edits” overclaims. Read-hash-patch-verify reduces the lost-update window; it does not prevent a concurrent write. Preserve human edits, escalate conflicts, and state the residual race.
- C5. “Zero leakage risk” must be removed. A private repository reduces exposure; permissions, transfer, redirects, links and human sharing still create risk.
- C6. Rate text must follow the rulings: 80 content-creates/min and 500/hour are documented general guidance, not universal hard caps; 7.2 seconds is only an arithmetic illustration, never a safe constant. Use response-aware adaptive budgets per auth/endpoint/shared token, honour `Retry-After`, and state that exact quotas are NOT RUN. Remove the “900 REST points/min / mutations cost 5” claim unless the reviewer verifies an exact official source.
- C7. “Retention requires active deletion” and “purging deleted items” prescribe destructive cleanup. Keep the fact that archiving does not free Projects capacity; make retention/partitioning a decision and prohibit automatic destructive deletion.
- C8. Native hierarchy facts are documented limits; remote cycle handling, cross-org private dependency behaviour and transfer node-ID stability remain UNKNOWN. Say so.
- C9. Skill metadata is source-observed only. Invocation by ID is not live-proven, aliases are unsupported, the current dynamic agent denies the skill tool, and solo has an allowlist. Keep transclusion as the fallback and state that hiding a skill is not a permission boundary.
- C10. Scheduler methods must be capability-checked. The current advertised contract includes `schedule.update` while an older installed plugin enum lacks it; do not prescribe delete/recreate or claim catch-up/overlap/edit semantics as proven.
- C11. Distinguish documented, source-observed, proposed and NOT RUN in the issue body itself, not only in the companion.

## D. Requirement gaps visible in the issue body

- D1. Exploration/alignment must visibly define outputs, tools, per-phase model, relevant skills, files, limits, decomposition and parallelism; the current body mentions exploration but not these outputs.
- D2. Add web search for new tools, past similar GitHub work, templates/inspiration and testable hypotheses, with the “only when useful” rule.
- D3. Add `Decisions` and `Next Authorized Action` to the repeatable body template; the current template lacks both.
- D4. State one authoritative phase/approval representation and no dual write; the four axes alone do not settle this.
- D5. State that current delegate, disk-brief and mission contracts remain binding until a replacement is implemented and empirically proven.
- D6. State that issue text cannot grant tools or permissions; untrusted issue, web and skill content is data; secrets and private context stay out of public issues.
- D7. State that agents never check human boxes; approvals are human, scoped and versioned, and a changed plan invalidates stale approval.
- D8. Add event-triggered runs (not only schedules), overlap/catch-up/edit/cancel/recovery, trigger authentication, dedupe, bounded retries and no automatic destructive schedule operations.
- D9. Add cross-repo work, transfer identity, same-owner child limits, full-URL cross-repo dependency syntax, and the unknown ownership/permission cases.
- D10. Add offline/GitHub outage, lost response, webhook not automatically redelivered, reconnect and reconciliation behaviour.
- D11. Add claimed task deleted/closed/transferred, permission revoked, cancellation and in-flight side effects.
- D12. Keep the human-attention orthogonality and blocking definition; make clear that optional questions do not freeze unrelated work.
- D13. Keep the small-task fast path but require independent hostile review, proof and human release; ordinary verifier defects return to bounded execution.
- D14. Add usable source links to the published body, or a durable evidence appendix that the issue links to. A companion file that will not be published is not enough.
- D15. Reconsider the title/friendly title for outcome language: “All work runs from the task board” / “Work runs from the board” rather than an imperative. Do not use a conventional commit prefix.

## E. Quality and gate

- The 125-line density is good; do not inflate it. Keep the architecture readable and put unknowns next to the claims they qualify.
- Keep every acceptance/test/human checkbox unchecked.
- Human Tasks must ask only for decisions/probes the user must make; do not ask them to approve a pilot deployment that has not been scoped.
- Test Plan must add cross-repo/transfer, offline/rate-limit, concurrent human edit, permission revocation, cancelled/closed task and untrusted-issue-text cases.
- Sources must be public URLs or repo-relative paths; no local absolute paths, session internals or credentials.
- The Section 2 “five decisions” count is right; do not add more decision forks without a strong reason.

## F. Next gate

1. Read the independent review; adjudicate every blocker.
2. Dispatch a fresh fixer in the same proposal worktree with this file and the review proof.
3. Require the fixer to preserve the proposal’s good parts, fix the parser headings first, and commit a new revision.
4. Dispatch a fresh verification reviewer (not the fixer) against the new commit.
5. Only then run the manager gate, publish one issue, read it back and link it to the session.
