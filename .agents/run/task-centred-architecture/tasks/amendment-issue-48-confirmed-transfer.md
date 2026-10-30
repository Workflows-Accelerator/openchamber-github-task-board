<env_preflight>
Repo: /workspace/extensions/github-task-board
Panel review worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-panel-simple-views, branch feat/issue-48-panel-simple-views, candidate253f9f23e4b4eda7f39ca0a059dff3a21e33eb84. Reviewer ses_8a6ddd2fbedfdd4581cadc93 already has read-only brief.
Web review worktree: /workspace/extensions/github-task-board/.worktrees/team-dev-issue-48-web-simple-views, branch feat/issue-48-web-simple-views, candidatee630a9ddd044389787a66f458b1ee49c944db250. Reviewer ses_ca48a1f70a74aef3aa647615 already has read-only brief.
No new worker, tests or writes authorised by this amendment. Existing do-not-touch/storage/credential boundaries unchanged. This is an aligned scope update only.
</env_preflight>
<goal>
Apply the newly approved saved-draft project-transfer contract to the ongoing reviews and future corrections.
</goal>
<alignment>
D55: On2026-10-29 user selected "Confirm then move (Recommended)" to the question of changing the project for an already-saved draft. BOTH surfaces should ask for confirmation then native-transfer the GitHub issue preserving history. The question disclosed that issue number/link may change and GitHub permission restrictions apply. No copy+close fallback is approved. This is not release approval.
</alignment>
<context_files>
[@/workspace/extensions/github-task-board/.agents/run/task-centred-architecture/decisions-batch-simplify-views.md]
</context_files>
<scope>
Reviewer: native transfer itself is no longer an unapproved product fork. Do not edit application code; verify cancel0writes, confirm exactly one transfer, allowed target repositories, fresh node IDs, canonical returned identity, permission failure/source retention, unknown outcome and re-selection/retry without duplicates, source and target cache invalidation, open drawer and in-flight edit races, same-number issue safety, history/body/labels preserved. No live transfer. Report mock-only boundaries honestly.
Web correction: replace create/comment/close with native GitHub transfer, including server authority and explicit client confirmation. Must fail safely without fallback or blind retry. No new auth scopes/settings or real credential access. New drafts still select destination before creating. If transfer unsupported by existing token, show permission error; do not broaden credentials.
Ordering rule clarification: moved-item-only restriction is superseded where it prevents user's free reorder. Lazy neighbour marker initialisation/rebalance is permitted with conflict/UNKNOWN handling for each touched issue. Do not accept refused destinations as compliant.
</scope>
<criteria>
No automatic task closure/recreation and no mutation upon cancel. Native transfer is only marked proven through fake runtime tests, not real GitHub. Existing hostile review criteria still apply; updated proof should cite D55 and distinguish defects from obsolete scope warnings.
</criteria>
<output>
Include this ruling in the existing proof/report. No separate chat acknowledgement required if still working. If update delivery fails, manager will include this amendment in the fresh correction/recheck brief.
</output>
