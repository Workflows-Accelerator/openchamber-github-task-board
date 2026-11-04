[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_audit.md]

<step>
Step A1, issue #56. Brief: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A1-shell-real-data.md]
Hostile-review findings handed to the builder: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/task-A1-hostile.md]
Proof: .agents/run/chamberos-board-v2/verifications/A1/proof.md (in the worktree)
Commits: 62dd215..b2e0c98 on feat/chamberos-board-v2.
</step>

<extra_focus>
1. "Issues never load" (D66) — the builder documented a theory but did NOT change the server. That is not enough: the live board must actually load. Read web/server/app.ts (aggregate(), concurrency, per-repo error handling), web/server/github.ts (timeouts, pagination, rate-limit handling) and web/server/repositories.ts (discovery of 26 repos). Determine with evidence (a local reproduction against the fake GitHub with 26 repos, some slow, one failing, one rate-limited) whether /api/combined/board can (a) take longer than ~30s, (b) fail entirely because of one repo, (c) hang the client forever. You are AUTHORISED to fix this in the server and client within this audit, minimally: e.g. bounded total time with per-repo results and a partial-failure list returned to the client (the UI shows which repos failed and still shows the rest), raise concurrency sensibly (e.g. 6-8) with rate-limit backoff, short in-memory cache of the last good board per repo so a refresh is fast, client-side fetch timeout with a retry button. Add server tests proving: one failing repo does not fail the board; slow repos do not exceed the time bound; partial results are flagged. Commit with "audit:" prefix.
2. The fake data in screenshots shows projects "Core" and "Studio": confirm these come only from the test fake and that nothing in web/public hardcodes them.
3. The builder "hid" #view-btn — confirm it is removed or truly inert, not just display:none with a live handler that conflicts with the sidebar.
4. Check that the sidebar section label "VIEWS"/"SYSTEM" is translated in French (screenshot board-1280-fr.png shows them in English).
5. Check the 360px layout: the quick-add row and toolbar must not overflow; drawer full width.
6. Two hostile sessions may have run concurrently on this worktree (a duplicate dispatch). Check git log for duplicated or conflicting commits and that the tree is coherent.
</extra_focus>
