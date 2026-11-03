[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step B3 (issue #63, parent #55): the Discussions section shows the repositories' GitHub Discussions (the forum tab). Read, reply, start a discussion, and turn a discussion into a linked issue.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D17)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md] (Q2: which repos have Discussions, GraphQL names)
Previous proofs: verifications/A1..B2/proof.md (reuse the markdown renderer).
V1 Discussions workspace for look: tmp/chamberos_ai_native_github_openchamber_operating_system.html. V2 threads for features: tmp/webapp-v2.html (~2280-2300, "turn into issue").
</context_files>

<scope>
In:
1. Server: GraphQL client helper (reuse the existing GitHub client/token). Routes: list discussions per repo (category, title, author, comment count, updated, answered), read one with comments and replies (paged), add comment / reply, create discussion (repo + category picker from the repo's real categories), and "turn into issue": creates an issue whose body links back to the discussion and adds a comment on the discussion linking to the new issue. All CSRF-protected.
2. Repos without Discussions enabled are listed as "Discussions are off in this repository" (no fake threads, no auto-enabling).
3. UI in V1 style: list with filters (repo, category, answered), thread view with markdown, reply box. Linked issues show a "discussion" chip in the drawer when the issue body links a discussion URL.
4. Extend web/tests/fake-github.mjs with a faithful GraphQL emulation for these queries.
</scope>

<criteria>
- Everything in <common_criteria>.
- Server tests for every route incl. disabled discussions, GraphQL errors, pagination.
- Browser proof on the fake: list, read, reply, start, turn into issue. One READ-ONLY live GraphQL query to confirm the shape is allowed; no live writes.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/B3/proof.md.</output>
