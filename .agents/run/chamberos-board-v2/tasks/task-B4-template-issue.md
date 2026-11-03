[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step B4 (issue #64, parent #55): one real GitHub issue that shows everything the board can do, so the user can open it and see each feature working.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (U11)
Previous proofs: verifications/A1..B3/proof.md — they define the exact formats (canvas marker with notes, front matter keys, labels, sections, answer format, discussions link chip).
Issue body contract: /workspace/code/openchamber-config/.agents/skills/meta/orchestration/issue-lifecycle/SKILL.md
</context_files>

<live_write_permission>
This step MAY write to live GitHub, limited to repo Workflows-Accelerator/openchamber-github-task-board, using the ambient `gh` auth, and ONLY:
- create the labels from B1 that are missing (never edit/delete existing labels);
- create exactly ONE issue (the template), and edit only that issue afterwards;
- add exactly one native blocked-by link: the template issue is "blocked by #64" (so a wire shows on the canvas);
- add one comment on the template issue.
Never `gh issue develop`. Never pass a body via --body-file or -F; use the API with an inline JSON payload or --body with the text. Do not touch any other issue.
Do not create a discussion unless Discussions are enabled (preflight.md Q2); if enabled, create one discussion titled "Board template discussion" in the most general category and link it from the template body. If disabled, the template says so plainly in its Discussions section.
</live_write_permission>

<scope>
1. Write the template body to .agents/run/chamberos-board-v2/verifications/B4/template-body.md first, and a test that runs it through the board's own parsers (front matter, sections, markers, renderer) proving every block is recognised.
2. Contents (friendly, plain English, zero emoji): Friendly Title "Board feature tour"; Overview explaining what each part shows; a YouTube link (pick a short, stable, official video, e.g. a GitHub official channel video about Issues; verify it exists with a read-only oEmbed request); an image; Acceptance Criteria; Subtasks; Open Questions with options and a Recommended one, one already answered; deep Human Tasks (multi-step, verb-first, with a sub-checklist); a Test Plan; front matter with model/agent/skills/worktree and one custom field; labels status:draft, priority:normal, size:S; a canvas marker with a position and two markdown notes; discussion link; a "Blocked by" text line.
3. Create the issue, then open it on a locally running board against REAL GitHub read-only? NO — the board server needs BOARD_GITHUB_TOKEN which you must not read. Instead: verify on GitHub via `gh issue view` that the body round-trips byte-identical, and verify on the local board by loading the same body into the fake GitHub and screenshotting each feature.
4. Record the issue URL in the proof.
</scope>

<criteria>
- Everything in <common_criteria> that applies.
- Parser test passes; screenshots of every feature from the template on the fake board; issue URL recorded.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/B4/proof.md. Reply includes the template issue URL.</output>
