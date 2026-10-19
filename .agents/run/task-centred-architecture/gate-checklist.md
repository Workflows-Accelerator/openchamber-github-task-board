# Manager gate checklist — architecture draft

For use when synthesis returns. Each item must be answerable from pinned artifacts, not the worker's summary.

## A. Scope and authority
1. One issue only; no execution child issues, no implementation, no schedules, no agent/skill/config edits, no pushes or PRs.
2. Future acceptance criteria unchecked; no claim of current runtime behavior from design text.
3. Human Tasks contains only decisions the user actually must make; no invented approvals and no already-granted approval disguised as a task.
4. Architecture choices remain choices: intake home, controller hosting/always-on, multi-device authority, autonomy budget, phase granularity, schedule run representation, hidden-skill enablement. Recommendations allowed; silent selection not.

## B. Requirement coverage
5. All ten scenarios and every mission bullet have a visible disposition in design-evidence.md; no requirement dropped for brevity.
6. Output-focused title and body: desired output first, plain language, dense but scannable, no conventional-commit prefix.
7. Phase vs attention vs runtime liveness vs dependency readiness vs recurrence are distinct in both text and examples.
8. Optional question vs blocking condition correctly separated; idle/crash/dependency wait not automatically human-blocked.
9. Tiny-task fast path retains independent review, proof and human release/closure. Ordinary found defects return to bounded execution.
10. Exploration is proportionate and concrete: code/past work, references/templates, new tools, hypotheses, models/tools/skills/files/limits only when useful.
11. Child tasks, dependency graph and checklists are distinct; file/shared-resource collisions constrain parallelism; cross-repo/transfer/private limits explicit.

## C. Evidence integrity
12. Provenance labels correct and dated: DOCUMENTED, SOURCE-OBSERVED, PROPOSED, UNKNOWN/NOT RUN.
13. No fabricated proof artifact; no unmeasured latency; no universal quota; no invented host API or file:// navigation; no stopShell-as-session-abort.
14. GitHub facts survive review: tree/one-parent/counts/owner bounds documented; cycles/cross-org/node-ID unknown; archive counts toward cap; draft project item not full issue/org fields absent; no mutation CAS.
15. Skills facts survive review: catalog hiding source-observed only; current dynamic-agent/solo permissions block generic native loading; no live load proof; transclusion fallback retained; routers incremental proposal.
16. Schedules: current advertised contract vs older plugin enum distinguished; no claimed proven catch-up/overlap/edit semantics; no destructive schedule operations.
17. Migration: read compatibility, opt-in ownership, one authoritative phase, pilot coordinator, rollback/pause, old/new controllers cannot both own a task; disk briefs/delegate not retired before proof.

## D. Independent review
18. Final reviewer is fresh, not the author; returns Spec Compliance and Quality & Health verdicts; findings are anchored.
19. All blocker findings are resolved in a new draft revision or explicitly parked by the manager with a reason; cannot self-approve.
20. No publication until review and manager gate pass; publication readback compares title/body exactly and confirms open/draft state.

## E. Reporting to user
21. Answer-first, <=5 decisions, plain language, one concrete next action; state what was not verified.
