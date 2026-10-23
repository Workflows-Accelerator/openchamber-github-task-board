<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design
Branch: docs/issue-30-31-design; HEAD fcbe9cf (review); proposal 12c4dc8; tracked state clean.
Files owned: .agents/run/issue-30-31-design/proposal.md and a new response.md in the same directory. Product source is read-only reference.
Tests: none required; targeted probes under /tmp/opencode only if you need to recheck a source claim. Do not add repo tests.
Do not touch: product code, docs/, test/, other worktrees/branches, shared config/skills, credentials, opencode.db, host settings, installed extension, real GitHub writes, production, master, root checkout. No push, no issue edits.
</env_preflight>
<goal>
Revise the #30/#31 design so it is true against the code, proportionate to what already exists, and honest about what cannot be guaranteed — without growing its scope.
</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/proposal.md]
[@/workspace/extensions/github-task-board/.worktrees/team-dev-issue-30-31-design/.agents/run/issue-30-31-design/review.md]
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/30
https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/31
</context_files>
<skills>
[@/workspace/config/opencode/.agents/skills/architecture/spec/spec-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/review/adversarial/doubt-driven-development/SKILL.md]
[@/workspace/config/opencode/.agents/skills/meta/composition/context-engineering/SKILL.md]
</skills>
<scope>
The independent review returned Design PARTIAL, Evidence NEEDS-FIXES at fcbe9cf. Revise, do not rewrite. For every review item, either correct the proposal with exact anchors or rebut it with new evidence; a response.md table maps each item to the change or the rebuttal.
Proven live defects the review reproduced and that the revision must carry as the first deliverable (issue #34 already exists for them): wrong-question fallback, false success toast on a failed PATCH, optimistic body kept after a failed PATCH, failed fresh read continuing against the cached body. Keep the shared-answer-path fix.
Failed design claims to correct:
1. "No work type": `resolveIssueSkills` already routes bug/enhancement and 9/20 open issues use labels. Reconcile the Work Type proposal with existing label routing and GitHub native issue types (`type: null` today): what is genuinely missing, what a body field adds that labels do not, whether a body field and native issue type would duplicate each other. If the honest answer is "formalize existing labels plus native issue type", say that and drop the body field.
2. "Questions are not in the Human Tasks view" and "no reproduction requirement" and "no delivery channel": the review contradicts each with anchors. Re-verify and correct. For notifications, examine the host service route the review found before declaring it unavailable; if it is still unverified from a panel guest, keep it as a spike, but say what exists and what is unproven.
3. "Done only when closed/status:done": the review found panel and reconciler paths that can produce done. Establish the truth with anchors. Do not restate human-only closure as an invariant if it is not one. If an agent-reachable path can move an issue to done without a human, record it as a separate defect to file, and keep the design's requirement (no autonomous closure) as a goal rather than a description.
4. Lost update: replace "closes the variant" with the exact residual: GET→PATCH window, two-window last-writer-wins, rate-limit retry widening it, PATCH-succeeds/readback-fails misreport, no revision binding; GitHub refuses conditional unsafe PATCH.
Question identity: adopt the review's hardening — scope to repository + issue + generation, use a 64-bit or SHA-256 prefix, normalize Unicode (NFC) before hashing, define explicit re-ask and delete semantics, bind an answer to the revision it was shown for. Keep it dependency-free.
Decisions D1–D3: update options and recommendations from the corrected evidence. D1 must include GitHub native issue types and the existing label reality. D2 must include the capability spike and a status-quo option, not only views+badge+toast. D3 keeps reject-stale and gains the revision binding. Still at most three decisions, each with a recommendation.
Keep: no new daemon, no new status, attention orthogonal to phase, no destructive expiration, no claim of delivery that is not proven, small first slice.
Update the change table and effort honestly after removing work that already exists; the first slice should shrink or stay equal, not grow.
</scope>
<criteria>
Every "exists" claim carries a file/function anchor verified at the current base; every proposal is marked proposed; review item → change or rebuttal is complete with no silent omissions; no new scope beyond the review's corrections; the three decisions are still genuine and now evidence-based; the design remains implementable without a daemon or new dependency.
</criteria>
<output>
Commit proposal.md (revised) and response.md in the design directory. Return at most 15 lines: what changed, which review claims you rebutted and why, the revised D1–D3 options, the new first-slice effort, the follow-up defect found (if any), commit, actual and supplied model. Do not edit issues, product code, merge, push or deploy.
</output>
