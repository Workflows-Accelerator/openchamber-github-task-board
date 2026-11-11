<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board/.worktrees/team-dev-board-v3
Branch: feat/board-v3
Base commit: [FILL_BASE_SHA] (clean)
Root checkout: /workspace/code/openchamber-github-task-board on branch ops/task-board-activation (DO NOT modify or switch branches in root checkout)
Test commands (RUN SEQUENTIALLY): npm test ; node --test --test-timeout=30000 web/tests/*.test.mjs ; npm run typecheck
Do not touch: panel/**, service/**, /workspace/code/openchamber-config/**, /workspace/releases/**, /workspace/.openchamber-data/**, git push
Do NOT run `git remote -v` or print any credential.
Preflight facts are true and authoritative at dispatch.
</env_preflight>

<goal>
Make human validation on this board mean something again. A task may wait for the human only when the human can settle it by clicking: look at a screenshot, open a link, watch a short video, or answer a question with preset options. Anything that would require the human to write code, run a command, or start a development server must never be a human gate. Then apply that rule to the issues that are currently waiting.
</goal>

<user_words>
"beaucoup des issues actuels sont en mode in review ou alors elles attendent une validation humaine. Je pense que toutes les tâches n'ont pas pour vocation d'avoir une validation humaine... idéalement on peut le faire depuis le board... valider des screenshots ça ça marche bien ou aller sur un lien et faire quelque chose, ça, ça marche bien aussi. Mais tout ce qui nécessite des actions complexes, type faire du code, aller faire une commande, lancer un serveur de dev... c'est trop compliqué, et globalement, les humains ne le feront pas."
User chose: strict rule AND reclassify what already waits.
</user_words>

<part_a_policy_in_the_product>
1. Define, in code, what a human-reviewable artifact is: an image URL rendered inline, a short video URL, or an external link, each paired with a one-line instruction of what to look at. Store it in the issue body in a dedicated, parseable section (follow the existing body-section conventions in `web/server/board.ts`; do not invent a second format) and expose it on the board payload.
2. Enforce it server-side: a transition into `status:needs-human` (or any state the board presents as "waiting for you") is rejected with HTTP 4xx and a precise message naming the missing artifact when the issue body carries none. Tests for accept and reject.
3. Enforce it in the client: a card waiting for the human shows the artifact, the one-line instruction, and one primary action per artifact ("Ouvrir la capture", "Regarder la vidéo", "Ouvrir le lien", "Répondre"). No card in that state without an artifact can exist; if legacy data has one, show it as "needs an artifact" with the precise reason, not as a silent wait.
4. Separate "another agent is reviewing" from "you must decide". The board must not present both under one vague "in review" wording: `status:in-review` is an agent review, and only the artifact-gated state asks anything of the user. Keep labels and data backward compatible; add presentation-level distinction if a new label would break existing contracts (prefer presentation-level unless a label is unavoidable, and say which you chose).
5. Answering with preset options: a human question in this state must offer predefined answers, each with expandable details, and a free-text fallback. Reuse the existing open-question data shape; do not build a parallel one.
</part_a_policy_in_the_product>

<part_b_reclassify_existing_issues>
6. Dry run first, and record it: for every open issue in every repository the board is configured for, list current status label, whether the body contains a clickable human artifact, and the proposed new status. Write the full table to `.agents/run/chamberos-board-v2/verifications/V4-3/reclassification-dry-run.md`.
   - Deterministic rule: `status:needs-human` with no clickable artifact -> `status:todo`. `status:in-review` with no artifact -> `status:todo` only if the review is demonstrably finished or abandoned; if an agent review is genuinely in flight, leave it and mark it "agent review in flight" in the receipt.
   - Anything that does not fit the rule cleanly goes in a separate "needs your call" list. Do not force it.
7. Apply only what the rule settles without interpretation, with `gh issue edit` label operations only (never rewrite a body, never close an issue, never delete a comment). Add exactly one comment per changed issue, in English, stating the new policy in one sentence and the previous status, so the change is auditable in GitHub history.
8. Produce `.agents/run/chamberos-board-v2/verifications/V4-3/reclassification-receipt.md`: one row per changed issue (repo, number, old label, new label, why), a count summary, and the exact reverse mapping so any single change can be undone with one command. Re-read a sample of changed issues from the GitHub API and prove the labels actually changed.
9. If `gh` is not authenticated or a repository rejects the label change, stop that repository, record it, and continue with the others. Never retry destructively. Report every failure verbatim (redact any token).
</part_b_reclassify_existing_issues>

<criteria>
1. Part A implemented with tests: artifact required for a human gate (rejected without it), artifact rendered with one primary action, agent review and human decision visually distinct, preset answers with expandable details.
2. Part B: dry-run table complete for every configured open issue; every applied change follows the deterministic rule; every applied change is auditable via one comment; receipt contains reverse mapping; sample re-read from GitHub proves the labels changed; nothing closed, no body rewritten.
3. Zero issue closed. Zero comment deleted. Zero repository settings touched. No credential printed.
4. `npm test` 618/618, all `web/tests/*.test.mjs`, `npm run typecheck` pass, sequential.
5. `git diff [FILL_BASE_SHA]..HEAD -- panel service` empty; commit on `feat/board-v3`; no push; no deploy.
</criteria>

<output>
Respond in concise structured Markdown with:
- STATUS: PASS | PARTIAL | BLOCKED
- RULE: the deterministic rule you applied, in one paragraph
- DRY_RUN: counts per bucket (will change, stays, needs your call)
- APPLIED: number of issues changed, per repository, with a 5-row sample and the full receipt path
- REVERSE: how to undo a single change
- POLICY_CODE: file:line anchors for the artifact requirement and the UI distinction
- TEST_COUNTS
- NOT_VERIFIED
</output>
