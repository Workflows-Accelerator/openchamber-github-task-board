<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
Branch: docs/task-centred-proposal
Base commit: FILL AFTER FIX (fixer commit on top of 9c1a3f8; worktree clean)
State: The fixer revised the draft after a hostile review. You are a fresh independent verifier; you did not author or fix the draft and cannot be the fixer. The first reviewer is finished. Nothing is published or implemented.
Files you own: .agents/run/task-centred-architecture/verifications/final.md only. Read all artifacts; do not modify the draft, companions, proof, review adjudication, mission/decisions/rulings, code, docs, config, skills, agents, credentials, schedules, core DB or GitHub issues.
Test command: targeted documentation/parser review only. You must import or otherwise exercise the actual v1 parsers against the revised body and record the exact title, subtask/question/human-task/test-plan counts. Do not claim application tests beyond what you actually run. No publication.
Do not touch: the review proof at 9c1a3f8, any prior report, existing untracked main-checkout files, or other worktrees.
</env_preflight>
<goal>Verify, hostilely and independently, that the revised architecture draft resolves every blocker and major from the 9c1a3f8 review, uses the v1 contract correctly, keeps every unapproved choice open, is fully sourced in the issue body, and is safe to publish as one draft issue. Return two verdicts and a publication recommendation; do not publish.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/source-receipts.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/revision-notes.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/review-adjudication.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/manager-draft-findings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/research-rulings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/meta/orchestration/subagent-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</context_files>
<skills>
Use doubt-driven-development as the review lens, subagent-driven-development for two-verdict review discipline, and caveman-lite for terse findings. Do not load other skills.
</skills>
<scope>
- Read the revised artifacts at the pinned commit and the prior proof. Check each BLK-01..14 and M-01..09 against a visible change. Missing or merely asserted resolutions are findings.
- Run the actual v1 parser against the revised body. Check: `### Friendly Title:` exact spelling at the first match; no earlier fenced Friendly Title fallback; no false "renders cleanly" claim; known cross-section checkbox counting either fixed or explicitly disclosed; required sections present; all future checkboxes unchecked; human tasks verb-first; open questions self-contained.
- Check headings/levels/punctuation against docs/issue-body-contract.md and panel/core.ts, not the fixer's summary.
- Check that intake, controller hosting, recurrence/run representation, autonomy and fast-path remain open decisions; recommendations must not leak into acceptance criteria, human tasks or test-plan pass conditions. Check the five-decision limit and technical questions moved to proof tasks.
- Check transfer/sub-issue limits: same-owner transfer, private-to-public prohibited, same-owner sub-issues, cross-org fallbacks (copy/link/convert/full URL), one-parent tree, remote cycles/cross-org dependency/node-ID UNKNOWN.
- Check retention: archiving does not free Projects capacity; no automatic deletion/purging; retention/partitioning is a decision.
- Check rate: 80/min and 500/hour are general guidance, 900 REST points/min and 5-point mutation costs are documented, 7.2 s is only arithmetic, no universal safe pacing; response-aware budgets, Retry-After/header limitations, exact thresholds NOT RUN.
- Check sources: issue body has stable official links and repository-relative/version-based references; labels DOCUMENTED / SOURCE-OBSERVED / PROPOSED / UNKNOWN-NOT RUN; NOT RUN list; no unpushed local commit hashes presented as public evidence, no local absolute paths, run-state paths, session internals, credentials or unreviewed raw research.
- Check the false `proof-sdk-headers-dropped.test.js` claim is corrected: file exists, static assertion, anchor corrected to board.md:121; "fabricated/does not exist" removed. Verify the file yourself with git if needed.
- Check reliability/recovery: webhooks not auto-redelivered, offline/degraded mode, lost/duplicate delivery, duplicate claims, crash between spawn and write, spawn/write ordering, restart, cancellation/abort/in-flight effects, transfer/delete/close/revocation, stale approval, bounded retries/cost, one authoritative controller/fencing, no exactly-once.
- Check migration: v1 read compatibility, no mass rewrite, opt-in ownership, rollback/pause, one authoritative phase/approval representation, old/new controllers cannot both own a task, proof gates, current delegate/brief/mission contracts retained.
- Check task body: Decisions, Next Action, action IDs/versioning, secrets/private logs/absolute paths redaction, optional sections for tiny tasks, bounded verifier remediation loop, human authority, proposal-only banner.
- Check concurrency: residual race acknowledged; no automatic merge promise; preserve human text; conflict escalation; no exactly-once.
- Check provenance/native graph/authority: "documented limits" not "verified"; hidden skill registration retained but live invocation NOT RUN; `task.*` proposed; storage API clarified; one-parent; dependency receipt; issue text cannot grant tools; scoped/versioned/expiring approvals; agent never checks human boxes; hiding is not security.
- Check baseline/simpler alternative and the five decisions' tradeoffs are fair; no strawmen.
- Check no implementation/child issue/push/PR/merge/schedule/agent-skill-config authorization; every future checkbox unchecked; no checked human decision.
</scope>
<criteria>
- Return Spec Compliance PASS/FAIL/PARTIAL and Quality & Health APPROVED/NEEDS-FIXES; a publication recommendation (READY or BLOCKED). A single unresolved BLK-01..14 blocker forces BLOCKED.
- Findings must be anchored to file:line or commit and reproducible; do not rely on the fixer's summary or the prior reviewer's conclusions.
- Verify with the actual parser, not a regex guess. Record the exact commands and outputs in the report.
- If a finding is fixed but introduces a new defect, report it as a new blocker/major; do not assume the fix is correct.
- Do not edit the draft or publish. Do not claim runtime proof for scheduler, hidden skills, GitHub mutations, controller leases or multi-device behavior.
</criteria>
<steps>
1. Pin the fix commit and confirm the worktree is clean.
2. Read the prior proof and revision-notes; list every BLK/M and where it is addressed.
3. Run the targeted parser check. Record title, subtasks, questions, human tasks and test-plan counts, plus section presence.
4. Read the revised body end-to-end as a human; check density, fairness, sources, conditional decisions, proposal-only banner and unchecked boxes.
5. Verify the proof-file correction and the GitHub transfer/sub-issue/rate facts against the pinned evidence or official docs; do not re-run mutations.
6. Write `verifications/final.md` with verdicts, blockers/majors, evidence commands, residual unknowns and a publication recommendation.
7. Commit only that file. Return <=12 lines: SPEC and QUALITY verdicts, READY/BLOCKED, blocker IDs, commit, and any residual doubt.
</steps>
<output>
Commit `verifications/final.md` locally. Do not publish. Return <=12 lines: SPEC verdict, QUALITY verdict, publication READY/BLOCKED, unresolved blocker IDs, commit, and residual doubt. No self-approval.
</output>
