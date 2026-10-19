<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal (HEAD 6b0d8b9)
state: DIRTY on purpose — 4 files hold partial residual edits. KEEP them. Never reset, checkout, stash, or restore.
owned files (only these may be edited/committed), all under .agents/run/task-centred-architecture/:
  issue-draft.md, design-evidence.md, revision-notes.md, source-receipts.md
do-not-touch: verifications/proof.md, .agents/idle-nontext-state.json (untracked, never commit), any application code, anything outside the worktree.
forbidden: push, PR, gh issue/pr writes, publishing, schedule calls, agent/skill/config edits, printing credentials.
</env_preflight>

<goal>
Finish the residual fix of the draft issue with a few small edits, prove the parser counts by actually running them, check the URLs, then make one local commit.
</goal>

<scope>
Edit only these sections of issue-draft.md. Do not rewrite anything else.

E1. `### Open Questions:` Q3: list all four hosting options from the Decision 3 table (host extension service, OpenCode plugin, panel loop, central relay), worded neutrally, with no "daemon" assumed. Keep exactly 5 questions, Q1-Q5.
E2. `### Open Questions:` Q4 and Q5: Q5 must also ask the overlap/concurrency policy for recurring runs (skip, queue, or allow parallel runs when a run overlaps the previous one). Q4 stays as it is.
E3. `### Human Tasks:` must be exactly 5 items, one per decision 1-5, in order. Today Decision 4 (phase fast path) is missing and item 5 is a sandbox probe. Replace item 5 with "Decide on phase fast path ..." in the right position. Move the sandbox probe into `### Later Proof Tasks (NOT RUN):` as Proof Task E. Human Task 3 must list all four hosting options, as in E1.
E4. Do not change anything else in the body unless the grep in step 2 finds a leak.
</scope>

<steps>
1. Make edits E1-E3.
2. Grep issue-draft.md for: `/workspace/`, `ses_`, `55ddeaa`, `df8d3ff`, `9c1a3f8`, `6b0d8b9`, `474e7cb`, `- [x]`. Expect zero hits. Remove any hit.
3. Run the real v1 parsers on the body. Import from panel/core.ts in the main repo or in this worktree, whichever exists (this worktree should have panel/core.ts). Use a throwaway script under /tmp/opencode, not inside the repo. Use node's TS type stripping (`node --experimental-strip-types`) or whichever method the repo's tests use (check package.json). Record the exact output for: parseFriendlyTitle (expect `All Work Runs on the Board`), parseOpenQuestions length (5), parseHumanTasks length (5), parseTestPlan length (expect 17), and parseSubtasks length (cross-count; report the number).
4. Update the Compatibility Shell Note in issue-draft.md `## Overview` so its counts match step 3 exactly.
5. Check every https URL in `### 6. Sources & Evidence` with a GET (curl -sI -L or similar) and record the status codes in source-receipts.md. If a URL fails, replace it with the correct official docs URL (do not invent one), or mark it UNVERIFIED.
6. Update the companion files (design-evidence.md, revision-notes.md, source-receipts.md): parser counts, Human Task/Proof Task E change, and "Base commit: 6b0d8b9 + residual completion" (no future hash). Local commit hashes may stay in these private companions only.
7. Commit only the 4 owned files: `git add` each path explicitly, then `git commit -m "docs(proposal): complete residual fixes R1-R12"`. Confirm with `git status --short` that only `.agents/idle-nontext-state.json` is left untracked.
</steps>

<criteria>
- Parser output pasted verbatim: title, 5, 5, 17, N.
- 0 leak hits.
- Every source URL has a recorded status.
- One commit, 4 files, nothing pushed.
</criteria>

<output>
Under 25 lines: commit hash, files changed, the parser output verbatim, URL status table, the grep result, and anything you could NOT do.
</output>
