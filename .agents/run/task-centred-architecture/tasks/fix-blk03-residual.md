<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
HEAD: 35f362a (verifier commit) on draft 37243b4; clean except untracked .agents/idle-nontext-state.json (never commit)
owned files: issue-draft.md, design-evidence.md, source-receipts.md, revision-notes.md under .agents/run/task-centred-architecture/
forbidden: publish, push, gh/API writes, reset, touching verifications/final.md, final2.md or proof.md.
</env_preflight>

<goal>
Close the three residual BLK-03 blockers and three minors in verifications/final2.md. Smallest text change per item; no rewrite.
</goal>

<edits>
E1 (BLK-03a / N-01) Scenario 7. Remove the unconditional "human attention is NOT alerted" pass condition. New meaning: under the approved autonomy scope, an ordinary remediable defect returns to the permitted execution mode within the bounded retry budget; if the approved scope is exploration-only, verify the defect is raised to human attention instead of looping autonomously; verify the retry budget is enforced either way.
E2 (BLK-03b / N-02) Scenario 8. Replace "verify non-overlapping runs" with: verify the overlap policy selected under Q5 is honoured, including the skip, queue and parallel cases (a run starting while the previous run is still active behaves as selected).
E3 (BLK-03c / N-03) Decision 3. The panel loop genuinely fails the unattended requirement, so stop offering it as a live choice: keep it in the Decision 3 table but label it explicitly "Evaluated and rejected: cannot satisfy unattended execution because it dies when the panel closes." Remove "panel loop" from Q3 and Human Task 3, leaving three options: host extension service, OpenCode plugin daemon, central relay.
E4 (N-03, storage neutrality) Stage 2 and Scenario 9 must not assume extension storage, because the central relay has its own storage. Stage 2: "technical state lives in the selected route's durable store (extension storage for host/plugin routes; the relay's own persistent store for the relay route), subject to verification." Scenario 9: replace "durable attempt receipts in extension storage" with "durable attempt receipts in the selected route's store". Apply the same neutrality to the `.openchamber-data/` mention in Stage 2 and to the acceptance criterion on unattended execution if it names a store. Leave the host-storage capability gap (item 6) as is — it is accurate for the host route.
E5 (N-04) Q5 and Human Task 5 retention options: add the third alternative "manual retention review".
E6 (N-05) design-evidence.md:25,26,27,29 — align the wording with the conditional AC 8/9/11 language: remediation "under the approved autonomy scope"; recurring representation "under the representation selected in Decision 5"; fast path "under the taxonomy selected in Decision 4"; reboot recovery "selected route's store".
E7 (N-06) revision-notes.md:5 — stop claiming ALL BLOCKERS RESOLVED. Say: blockers BLK-01,02,04-14 resolved; BLK-03 corrected in three further passes (37243b4 and this commit); resolution is subject to the next independent verification. Add a row listing E1-E7.
</edits>

<steps>
1. Read verifications/final2.md sections 2.2, 2.3, 6 and the four owned files.
2. Apply E1-E7.
3. Re-run the actual v1 parsers as the verifier did; record title, questions, human tasks, test plan, subtasks, unchecked counts. If removing "panel loop" changes Q3 text only, counts must stay 5/5/17/58.
4. Grep public body for `/workspace/`, `ses_`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `41f51f5`, `cb1c4ab`, `- [x]`, `/abort`. All zero.
5. Commit the four files: `docs(proposal): neutralize residual decision pre-commitments`.
</steps>

<output>
<=12 lines: commit, parser output verbatim, E1-E7 done/not-done, grep result, anything unresolved.
</output>
