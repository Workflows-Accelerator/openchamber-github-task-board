<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design
Branch: docs/issue-30-31-design; HEAD 22cd6d9; clean tracked state. Proposal revision follows review fcbe9cf; documentation only.
Owned output: .agents/run/issue-30-31-design/revised-review.md only. Product source read-only; other worktrees and root checkout out of scope. No credentials, opencode.db, host activation, GitHub writes, branch changes, merge, push, close or deployment.
Tests: targeted disposable probes under /tmp/opencode if needed. Preflight authoritative; no initial discovery loop. Use grep-targeted source anchors, not whole-file reads.
</env_preflight>
<goal>Determine whether the revised design is accurate and safe to put to the owner, without approving any implementation.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/proposal.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/review.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/response.md]
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/verify/ladder/verification-levels/SKILL.md]
</skills>
<scope>
Conduct a hostile review of any edits or changes that you made to figure out what you might have missed or what might be broken. Don't assume that what you did is right.
Independent bounded review of the revision delta and response map, not another full architecture exploration. Verdicts Design PASS/PARTIAL/FAIL; Evidence APPROVED/NEEDS-FIXES; list Moderate+ blockers with concrete corrections.
Verify earlier findings corrected, especially orthogonal phase/attention (the proposal must not reintroduce mandatory needs-human phase moves for every question), no human approval by silence/defaults, no redundant/new type labels implied by "formalize existing" without approval, and unverified service startup cannot be called a functioning running delivery path.
Attack question identity: lowercasing and stripping link targets must not allow a changed question to retain authority; a URL change can change meaning. An occurrence generation derived only from current body cannot identify delete-and-re-ask across time; either define persistence without a second source of truth or honestly reject ambiguous cases. Distinguish identity from full rendered-text and body-revision equality; require exact safe comparison for answer authorization. Hashes reduce collisions, never eliminate them.
Concurrency: ordinary GET/PATCH/readback cannot detect a remote edit overwritten during PATCH. Ensure no promise of fail-closed or atomic safety remains. PATCH-success/readback-failure must be UNKNOWN, not falsely failed and automatically retried. Question answers must never authorize release/closure.
Verify revised D1–D3 are meaningful owner choices and do not bake in approval. Work Log is a proposal, not mandated format. Confirm the automatic-close report really follows through the shipped code under its required conditions; source-inferred vs live-reproduced must remain distinct. No production probes.
If blockers remain, stop with minimum corrections (no rewrite). Do not call 3–5 developer days empirically measured: it is an estimate.
</scope>
<output>
Commit only revised-review.md; return <=12 lines: verdicts, remaining findings with source anchors, decisions safe to ask, automatic-closure evidence strength, commit, supplied/actual provider/model. No implementation, merge, push, issue comments, closure or deployment.
</output>
