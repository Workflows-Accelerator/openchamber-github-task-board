<env_preflight>
Repo: /workspace/extensions/github-task-board
Worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
Branch: docs/task-centred-proposal
Base commit: 6b0d8b9 plus uncommitted partial edits in `issue-draft.md` from a failed fixer session (`ses_38f90000f9b5d74a598e49d1`). Do not reset or discard them: inspect `git diff`, keep the correct partial edits (outcome title, exploration deliverable, bounded explorers, scheduler path removal, template resource plan), and finish the remaining residual findings.
State: The first fix resolved most blockers but left the targeted defects in `residual-findings.md`. A second fixer stopped before committing; it produced useful partial edits but no report. You are a fresh fixer; the prior fixers and reviewer are finished. Nothing is published or implemented.
Files you own: issue-draft.md, design-evidence.md, source-receipts.md, revision-notes.md. You may read the review proof, residual findings, adjudication and manager inputs. Do not modify `verifications/proof.md`, mission/decisions/rulings, application code, docs contract, config, skills, agents, credentials, schedules, core DB, GitHub issues or other worktrees.
Test command: targeted documentation/parser review only. Run the actual v1 parsers against the revised body and record title, open-question, human-task, test-plan and subtask counts. Do not claim app tests beyond what you run. No publication.
Do not touch: the prior review proof, existing untracked main-checkout files, or other worktrees.
</env_preflight>
<goal>Apply the remaining targeted corrections so the draft is genuinely ready for a fresh independent publication review: outcome title, no sensitive/local evidence in the public body, clickable official sources, no settled decisions in migration/tests, five parsed user questions, honest reliability/authority claims, complete edge-case tests, and a usable task-body template.</goal>
<context_files>
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/issue-draft.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/design-evidence.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/source-receipts.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/revision-notes.md]
[@/workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal/.agents/run/task-centred-architecture/verifications/proof.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/residual-findings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/review-adjudication.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/research-rulings.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions.md]
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/explore/scenarios-to-cover.md]
[@/workspace/extensions/github-task-board/docs/issue-body-contract.md]
</context_files>
<skills>
Use doubt-driven-development as the review lens, subagent-driven-development for the two-verdict fixer discipline, and caveman-lite for dense prose. Do not load other skills.
</skills>
<scope>
- Edit only the four owned artifacts. This is a targeted revision, not a rewrite. Preserve the structure that passed the first review except where the residual findings require a change.
- R1 title: change `### Friendly Title:` to `### Friendly Title: All Work Runs on the Board`; change the proposed issue title to `All work runs from the task board`; keep title references consistent. Re-run the parser.
- R2/R3 evidence: remove all `/workspace/...`, `ses_...`, and local-only commit hashes (`55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`) from `issue-draft.md`. Convert GitHub docs paths to full `https://docs.github.com/...` links; add the issue-dependencies REST doc. Keep package-relative source paths and version strings only as SOURCE-OBSERVED. For the static SDK header test, state it is a static private-research assertion, not live proof; no private path/commit. For the installed plugin, say "installed OpenChamber plugin (local runtime; path omitted)".
- R4 no settled choices: make Stage 2 host creation refer to the chosen Decision 3 route; make Stage 4 retention refer to the approved Decision 5 policy; make Test Plan Scenarios 8 and 9 conditional on the selected recurrence representation/host; remove the `schedule.create/delete fallback` prescription and say detect supported methods, use `schedule.update` if available, do not delete/recreate without capability proof and explicit approval. Scan for other selected-choice leaks.
- R5 questions: keep exactly five strategic questions under `### Open Questions:`; move Technical Proof Tasks A-D to a separate `### Later Proof Tasks (NOT RUN):` section outside that parsed block; `parseOpenQuestions` must return 5.
- R6 acceptance: fix "solely issue body and native links" to include native labels/fields and approved controller metadata; replace "recover idempotently" with best-effort recovery, residual duplicate/orphan risk, no exactly-once, chosen host independent of panel; qualify recurrence capacity with approved retention/no automatic deletion. Add concise Authority & Provenance, Single Authority & Migration, and Event & Recovery criteria. Keep all unchecked.
- R7 tests: make Scenarios 8/9 conditional; add Scenarios 13-17 for outage/rate/lost response/webhook replay, stale approval/cancel/transfer/revocation, untrusted issue/web/skill content, concurrent human/agent edit, and single-authority/read-compatibility. Mark all NOT RUN — Design Phase. Update parser counts/anchors.
- R8 exploration: add a short `#### Exploration & Planning Deliverable` after the decision table with desired output, code/past-work findings, references/templates/exemplars, optional new-tool/web search, hypotheses, alternatives/recommendation/confidence, per-phase model/tier, skills/router IDs, tools, files/boundaries, limits/budget/retry, decomposition/parallelism, open decisions and the enough-is-known gate; small tasks use a minimal plan. Add bounded ephemeral exploration/verification workers under an authorized team/exploration lead, capped and task-scoped; durable state stays on the issue.
- R9 template: add `### Friendly Title: <3-6 word outcome>` at the top of the example, add `### Resource Plan:` with model/tier, skills, tools, files/boundaries, limits and parallelism, keep Decisions/Next Action; state in prose that substantial tasks add `## Test Plan (Issue)`; never put `/workspace/...` even in the example.
- R10/R11 provenance: keep 900/5 with caveat and link; keep primary quota distinctions; keep 7.2 s illustrative only; update companion base commit, title, scenario/acceptance numbering and parser counts; remove remaining "fabricated/does not exist" language; keep local commits only in private companion if useful and label internal.
- Do not implement, publish, push, open PRs, create child issues, mutate schedules, edit agents/skills/config, or access credentials.
</scope>
<criteria>
- The revised body starts with `### Friendly Title: All Work Runs on the Board`; the proposed issue title is `All work runs from the task board`; no earlier fenced `Friendly Title:` collision; no false clean-render claim.
- Actual parser check: friendly title correct; `parseOpenQuestions` = 5; `parseHumanTasks` = 5; `parseTestPlan` includes all scenarios; `parseSubtasks` count is recorded and the v1 cross-count limitation is documented.
- No `/workspace/`, `ses_`, or local-only commit hashes in the public issue body; no checked boxes; no secrets or private logs.
- Every migration/test/acceptance mention of intake, host route, recurrence representation or scheduler is conditional or an explicit recommendation; no choice is presented as decided.
- Official sources are full URLs; source-observed facts are labelled and version/interface-based; NOT RUN list is complete.
- Scenarios 13-17 and the exploration/resource plan are present; agent/skill section includes bounded ephemeral explorers; template includes title and resource plan.
- All four owned artifacts are committed on docs/task-centred-proposal; prior review proof untouched; worktree clean. Return two verdicts and a clear READY-FOR-VERIFICATION or HOLD.
</criteria>
<steps>
1. Read residual-findings.md and the current artifacts; list each R1-R12.
2. Apply R1-R11 with minimal, surgical edits. Preserve the review-passed structure.
3. Run the parser check with the actual v1 functions; record counts and title. Grep for forbidden paths/commits/session IDs and checked boxes.
4. Update design-evidence and revision-notes traceability; update source-receipts base/title and remove the false fabricated language; do not touch the review proof.
5. Re-read the public body as a human: outcome title, five decisions, fair alternatives, sources, edge cases, no settled choices, no implementation authorization.
6. Commit only the four owned artifacts. Return <=15 lines: commit, files, parser counts, R1-R12 status, remaining doubts and READY/HOLD. No publication.
</steps>
<output>
Commit the targeted revision locally. Return <=15 lines: commit hash, files changed, parser counts/title, R1-R12 fixed/parked, remaining doubts, READY or HOLD for fresh verification. Do not publish.
</output>
