<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
HEAD: be21ac1 (clean except untracked .agents/idle-nontext-state.json — never commit it)
owned files: issue-draft.md, design-evidence.md, revision-notes.md, source-receipts.md under .agents/run/task-centred-architecture/
forbidden: publish, push, gh/API writes, reset, touching verifications/final*.md or proof.md.
</env_preflight>

<goal>
Apply surgical text corrections to resolve blockers N-07 and N-08, and minors N-09, N-10, and N-06 identified in verifications/final3.md. Then run the v1 parser check and commit locally.
</goal>

<edits>
1. (N-07) issue-draft.md (around line 35):
Replace:
`- **Execution Liveness:** Managed as operational runtime metadata by the coordinator in extension storage (.openchamber-data/, subject to host-daemon storage verification); never written as a durable issue phase label.`
With:
`- **Execution Liveness:** Managed as operational runtime metadata by the coordinator in the selected route's authoritative durable store (extension storage for host/plugin routes, or relay storage for the relay route, subject to capability verification); never written as a durable issue phase label.`

2. (N-08) issue-draft.md (around line 61):
Replace:
`Tiny, unambiguous tasks use a minimal plan and may collapse exploration and planning; no mandatory swarm or ceremony is required.`
With:
`If Decision 4 selects the adaptive fast path, tiny unambiguous tasks may collapse exploration and planning using a minimal plan. Otherwise they follow the chosen phase model. Independent hostile review and human sign-off remain mandatory.`

3. (N-09) issue-draft.md (around line 288, Scenario 11):
Replace:
`- [ ] **Scenario 11: Fast Path for Simple Tasks:** Submit single-line documentation typo fix. If Decision 4 selects the fast path, verify task collapses exploration and planning ceremony, progressing directly to execution, verification, and human sign-off; if full phases are selected, verify that a tiny task still completes with proportionate ceremony and no skipped review; verify automation does not auto-close without human validation. *(Status: NOT RUN — Design Phase)*`
With:
`- [ ] **Scenario 11: Fast Path for Simple Tasks:** Submit single-line documentation typo fix. If Decision 4 selects the fast path, verify task collapses exploration and planning ceremony, progressing directly to execution, verification, and human sign-off; if full phases are selected, verify that a tiny task still completes with proportionate ceremony and no skipped review; if human-dispatched advancement is selected, verify that the task halts cleanly between phases awaiting human advancement; verify automation does not auto-close without human validation. *(Status: NOT RUN — Design Phase)*`

4. (N-10) design-evidence.md:
- Line 83 (row B4): Replace `Coordinator technical state strictly isolated to extension storage (.openchamber-data/, subject to host-daemon storage verification), never modifying core opencode.db.` with `Coordinator technical state isolated to the selected route's store (extension storage for host/plugin routes, subject to host-daemon storage verification; relay store for central relay), never modifying core opencode.db.`
- Line 86 (row B7): Replace `Hostile verifier defects route back to execution within a bounded retry budget; human escalation reserved for exhausted budgets.` with `Under the approved autonomy scope, hostile verifier defects route back to execution within a bounded retry budget; for exploration-only autonomy, defects escalate to human attention.`
- Line 104 (row A6): Replace `Search code, past issues, references/templates (exemplars, top-tier sites), and test hypotheses; tiny tasks bypass research ceremony.` with `Search code, past issues, references/templates (exemplars, top-tier sites), and test hypotheses; if the adaptive fast path is selected, tiny tasks bypass research ceremony.`
- Line 106 (row A8): Replace `Reusable schedule definitions with child run records; zero-repo intake; repo creation as gated permission; retention policy is open decision.` with `Recurring tasks follow the representation selected under Decision 5 (definition plus runs or single issue with ledger); zero-repo intake; repo creation as gated permission; retention policy is open decision.`

5. (N-06) revision-notes.md:
- Lines 267-268: Update "all 4 hosting options" to "the 3 eligible hosting options (host extension service, OpenCode plugin daemon, central relay; panel loop evaluated and rejected)".
- Line 278: Replace "All 14 blockers and all 9 majors were accepted and fixed in full alignment with review-adjudication.md." with "All 14 blockers and all 9 majors were accepted; BLK-03 underwent iterative refinement across verifications, with remaining neutrality and consistency items resolved in subsequent fix passes."
- Add section at end:
```markdown
## 8. Final Verification 3 Neutrality and Consistency Fixes Ledger (docs/task-centred-proposal)
- N-07: Execution liveness storage rule made route-neutral (selected route's store: extension storage for host/plugin, relay store for central relay).
- N-08: General tiny-task deliverable collapse rule scoped explicitly to Decision 4 adaptive fast-path selection.
- N-09: Scenario 11 test plan updated to include human-dispatched phase advancement verification branch.
- N-10: design-evidence.md summary rows (B4, B7, A6, A8) aligned with conditional/open architecture options.
- N-06: revision-notes.md audit and Q3/Human Task 3 description aligned with current 3-option eligible coordinator hosting set.
```
</edits>

<steps>
1. Apply Edits 1-5 carefully without touching unrelated text.
2. Run the actual v1 parser check on issue-draft.md using a script in /tmp/opencode importing panel/core.ts:
   - parseFriendlyTitle must be `All Work Runs on the Board`
   - parseOpenQuestions must be 5
   - parseHumanTasks must be 5
   - parseTestPlan must be 17
   - parseSubtasks must be 58
   - human todos must be 5
   - all unchecked
3. Grep issue-draft.md for forbidden leaks: `/workspace/`, `ses_`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `41f51f5`, `cb1c4ab`, `4224d1f`, `ce230ab`, `- [x]`, `/abort`. Confirm 0 matches.
4. Git add and commit only the modified files: `git commit -m "docs(proposal): resolve N-07, N-08 blockers and N-09, N-10, N-06 minors"`.
</steps>

<output>
<=12 lines: commit hash, parser output verbatim, verification that edits 1-5 were completed, grep leak count, anything unresolved.
</output>
