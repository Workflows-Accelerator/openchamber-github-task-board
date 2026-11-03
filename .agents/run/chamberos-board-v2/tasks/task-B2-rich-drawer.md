[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step B2 (issue #62, parent #55): the issue drawer renders the body as proper markdown, has a link viewer, plays YouTube links in place, and lets you answer open questions and tick human tasks and acceptance criteria in place, all saved to GitHub.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md]
Previous proofs: verifications/A1..B1/proof.md (A4 created the markdown renderer module; reuse and extend it).
V2 drawer features for reference: tmp/webapp-v2.html (link cards, YouTube, questions with options/recommended, human tasks).
Server: web/server/sections.ts, existing routes PUT /api/issues/:n/section and POST /api/issues/:n/questions/:index/answer, the Human Tasks toggle route from A5.
Issue body contract: /workspace/code/openchamber-config/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md (answer format `- [x] question *(Answer: ...)*`; check what sections.ts actually writes and stay consistent with it).
</context_files>

<scope>
In:
1. Body rendering: full GitHub-flavoured subset (headings, emphasis, lists, task lists, tables, blockquotes, code with no highlighting needed, images from https and from the repo's board-assets branch, autolinks, #123 issue refs linking within the board). Hidden markers and front matter are not shown (front matter is in its own editor). Safe against XSS (test payloads).
2. Sections recognised by sections.ts become interactive blocks: Open Questions (each with options if written as sub-bullets, "Recommended" highlighted, answer box or option click -> existing answer route), Human Tasks (tick -> toggle route), Acceptance Criteria and Subtasks (tick -> same safe toggle). Ticking never rewrites other lines.
3. Link viewer: links in the body and comments are collected into a "Links" panel with title/domain; clicking opens a preview pane for YouTube (embedded player via https://www.youtube-nocookie.com/embed/ID — widen CSP frame-src for that origin ONLY, and img-src for i.ytimg.com thumbnails), images (lightbox), GitHub issue/PR links (open in board if known, else new tab), others open in a new tab. No fetching of arbitrary third-party pages by the server.
4. Edit body: a plain markdown editor with preview tab, saving the body while preserving hidden markers and front matter exactly (they are re-attached by the server, not editable in the textarea). Conflict check: if the body changed on GitHub since load, show a diff-free warning and let the user reload or overwrite.
5. Comments: show issue comments (read-only list, markdown rendered) and add a comment.
</scope>

<criteria>
- Everything in <common_criteria>.
- Tests: renderer XSS suite, section toggles byte-preservation, body save preserves markers/front matter, conflict detection.
- Browser proof: YouTube plays inside the drawer (CSP log clean), answer a question, tick a human task, edit body, add a comment; reload persists.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/B2/proof.md.</output>
