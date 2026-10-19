<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-github
Branch: docs/task-centred-github-research
Base commit: 5f9ddfa43fca347178620aa537d7322624897984 (original research committed, no app edits).
State: original author completed. Preserve original report; add independent findings/corrections.
Files: .agents/run/task-centred-architecture/explore/github.md and github-evidence/, current official GitHub docs/API schemas.
Test command: read-only official documentation/API checks with retained sanitized evidence, no GitHub mutations or application tests.
Do not touch: application/config/skills/agents/schedules, credentials or raw git remotes, original report.
Preflight authoritative: skip initial pwd/ls/status loops. Inspect targeted state for mutation verification, stale resume or failed operation only.
</env_preflight>
<goal>Independently fact-check the GitHub capabilities report so no invented limits, API behavior, compatibility promise or approved design decision reaches the final architecture issue.</goal>
<hostile_prompt>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
You are a new independent reviewer; apply the prompt to the original author's research rather than trusting their reported evidence or self-check.
</hostile_prompt>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/mission.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-github/.agents/run/task-centred-architecture/explore/github.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/build/domain/api-and-interface-design/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>
<scope>
Own ONLY .agents/run/task-centred-architecture/verifications/github-hostile.md and sibling github-hostile-evidence/. Original report and source read-only. No mutations, code/config edits, installs, registration/DB writes, remote push, issue publication, worker spawn or human questions. No credentials inspection/output.
</scope>
<criteria>
- Return Spec Compliance PASS|FAIL|PARTIAL and Quality & Health APPROVED|NEEDS-FIXES for report, with corrected carry-forward facts. Source-documentation proof is not runtime proof.
- Actually retrieve official pages/schemas to verify subissue depth/count/parent cardinality, owner/privacy/access boundaries; issue dependency cardinality, acyclicity and cross-owner constraints; Projects v2 total active/archived count semantics; issue types and organization issue fields availability/limits/permissions/API coverage. Avoid invented CLI flags/API mutation names or /graphql/reference/issues path unless real. HTTP422 alone is NOT proof of cycle validation.
- Transfer identity: verify issue ID/node_id before/after documented behavior (read-only source/evidence only); don't assert Node ID changes unless sourced. URLs redirect but do not eliminate identity rebinding. Native cross-owner dependencies must not be asserted as unlimited/unrestricted without docs.
- Report currently puts Needs Human in proposed Workflow Phase enum despite orthogonality requirement; correct. '100% compatible', clean dual-write migration, automatic field fallback by issue-types 404/empty are suspect: 404 may be unauthorized/not found and issue types != issue fields. Do not silently choose local core OpenCode DB, Project Draft intake or primary field model as user-approved.
- Exact rate-limit policies vary credential/install/endpoint; 80/min and 500/hr are typical content-generating limits, not guarantees. 20 parallel creates do not necessarily hit them; a 1s delay alone still violates 500/hr under sustained writes. Conditional GET primary cost requires actual auth/304 rules. Retries/backoff need response-aware budgets, not fixed debounce dogma.
- Webhooks can reach hosted/relay service; NAT is not categorical impossibility. Redelivery/reconciliation history vs every intermediate event lost must be qualified. GitHub webhooks can be optional accelerator; reliable reconciliation necessary but avoid unsupported mandatory polling-only architecture.
- No CAS documents don't logically mandate LOCAL SQLite; approved single shared coordinator or other transactional host storage may work. Local single-writer cannot protect arbitrary human GitHub body edits, issue metadata revisions are not CAS, expiry doesn't prove worker dead. Keep issue durable contract vs operational execution truth distinct.
- Read evidence to confirm commands returned relevant data not 404 JSON or redirects. Existing-issues-scan context must be accurate: public endpoint defaults open and includes PRs unless filtered, not all open/closed issues; titles/statuses linked as actual URLs with source. Don't claim full dependency graph if 25 partial records only.
- Mark ambiguous numeric/doc claims UNKNOWN or remove rather than force certainty. Provide direct official citation links and evidence provenance for every key corrected claim. No live GitHub mutations allowed.
</criteria>
<output>
Write github-hostile.md with findings by severity and source/report anchors, corrected capabilities table + real official citation URLs/date, unknowns/unexecuted live checks, relevant prior issue receipt corrections, dual verdict and safe facts to pass to synthesis. Preserve author report unchanged. Commit owned artifacts locally. Return <=15 lines: path/commit/verdicts/blockers/provider-model if exposed.
</output>
