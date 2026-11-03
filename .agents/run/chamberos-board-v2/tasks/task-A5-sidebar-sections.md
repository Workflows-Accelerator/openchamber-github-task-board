[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step A5 (issue #60, parent #55): every sidebar section works on real data — Decisions, Blocked, Operations overview, Archive/backburner, Client view switch. Discussions keeps an honest placeholder until B3.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D2, D18)
Previous step proofs: verifications/A1..A4/proof.md
V1 sections for look: tmp/chamberos_ai_native_github_openchamber_operating_system.html (Decisions, Blocked, Operations, Discussions workspaces).
Server: web/server/sections.ts (Open Questions, Human Tasks parsing), web/server/board.ts, web/server/app.ts.
Issue body contract: /workspace/code/openchamber-config/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md (sections: Open Questions, Human Tasks).
</context_files>

<scope>
In:
1. Decisions: every unanswered open question across all repos, grouped by issue, newest activity first. Answer inline using the existing answer route (POST /api/issues/:n/questions/:index/answer); the item leaves the list on success.
2. Blocked: issues with status:needs-human and/or unchecked Human Tasks, listing each task; tick a task (server route to toggle a checkbox line by index in Human Tasks if one does not exist — preserve the rest of the body exactly). Also issues blocked by an open native dependency (from A3) in a second group.
3. Operations overview: real counts only — issues per status per project, open/closed, needs-human count, blocked count, recently closed (7 days), oldest open in-progress. Every number computed from data the server actually fetched; show the time it was fetched. No invented metrics (no throughput, agent counts, etc. unless real).
4. Archive/backburner: closed issues (recent first, paged; server must fetch closed issues — add a bounded fetch, e.g. last 100 per repo, with "load more") and open issues with the `backburner` label. Actions: reopen, move off backburner (label removal) — label must exist; if it does not, say so (labels are created in B1).
5. Client view switch: a toggle that hides internal detail across views (front matter, hidden markers, worktree/agent/model info, internal labels like ready-to-run, Run/worktree controls, notes). Saved locally. It is a presentation filter, not a security boundary — say so in the settings text.
6. Sidebar badge counts (Decisions, Blocked) from the same data.
7. Discussions: honest "arrives in a later step" state remains.
</scope>

<criteria>
- Everything in <common_criteria>.
- Tests: section extraction from real-shaped bodies (CRLF, fenced code, missing sections), checkbox toggle preserves body byte-for-byte except the one character, counts match fixtures.
- Browser proof of each section with the fake GitHub, both languages.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/A5/proof.md.</output>
