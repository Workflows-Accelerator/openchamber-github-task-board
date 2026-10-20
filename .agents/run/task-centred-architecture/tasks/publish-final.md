<env_preflight>
repo: /workspace/extensions/github-task-board
worktree: /workspace/extensions/github-task-board/.worktrees/team-research-task-centred-proposal
branch: docs/task-centred-proposal
Base commit: e9cb1ac (re-verification 4 report committed; worktree clean except untracked `.agents/idle-nontext-state.json`, never commit it)
State: READY. Final verifier returned READY in verifications/final4.md at e9cb1ac. Manager gate passed.
Authorized action: Publish exactly one deep draft proposal issue to Workflows-Accelerator/openchamber-github-task-board; read back title, body, state, labels; record receipt in publication.md. Implementation, child execution issues, branch pushes, PRs, merges, schedules, agent/skill/config changes and closure remain strictly forbidden.
Files: issue-draft.md (body), title: "All work runs from the task board"
Labels: ["status:draft"]
Target repo: Workflows-Accelerator/openchamber-github-task-board
Do not touch: code/config/skills/agents, credentials, schedules, existing issue bodies, labels, repository settings, other worktrees. Own only publication.md under .agents/run/task-centred-architecture/.
</env_preflight>

<goal>
Publish exactly one reviewed architecture draft issue to Workflows-Accelerator/openchamber-github-task-board and prove that its remote title, body, open state, and draft label match the reviewed artifact, without exposing authentication material or creating any duplicate.
</goal>

<scope>
1. Security & Redaction:
   - Check auth availability in the environment (process.env.GITHUB_TOKEN) without printing the token or exposing it in command argv, shell tracing, logs, headers, or files.
   - Target repository is public. Confirm zero private paths (/workspace/), session IDs (ses_), unpushed commit hashes, or checked boxes in the payload.
2. Duplicate Check:
   - Search the target repo Workflows-Accelerator/openchamber-github-task-board for any existing issue with title "All work runs from the task board" before sending a POST.
   - If an issue already exists with that title, adopt it and read it back instead of creating a duplicate.
3. Creation:
   - Target issue title: "All work runs from the task board"
   - Target issue body: exact content of issue-draft.md (starts at line 1: "### Friendly Title: All Work Runs on the Board").
   - Labels: ["status:draft"]
   - Use Node.js script (using native fetch or https) passing Authorization: Bearer $GITHUB_TOKEN and User-Agent: openchamber-task-board.
   - Do not pass token in command line arguments. Run script reading token from process.env.GITHUB_TOKEN.
4. Readback Verification:
   - Read back the created/adopted issue via GET https://api.github.com/repos/Workflows-Accelerator/openchamber-github-task-board/issues/<number>.
   - Verify title matches "All work runs from the task board".
   - Verify body matches issue-draft.md (accounting for standard git/github CRLF/LF normalization).
   - Verify state is "open".
   - Verify label "status:draft" is attached.
5. Record:
   - Write .agents/run/task-centred-architecture/publication.md with:
     - Issue number and public URL (https://github.com/Workflows-Accelerator/openchamber-github-task-board/issues/<number>)
     - Creation timestamp and author
     - Exact title match verification
     - Body equality verification (SHA-256 hash of remote vs local body)
     - State verification ("open")
     - Label verification (["status:draft"])
     - Pinned commit (e9cb1ac)
   - Commit only publication.md locally with message: "docs(publication): record receipt for task-centred architecture proposal issue"
</scope>

<steps>
1. Verify worktree HEAD is e9cb1ac and clean (except untracked .agents/idle-nontext-state.json).
2. Run duplicate check against GitHub API.
3. If no duplicate exists, POST to /repos/Workflows-Accelerator/openchamber-github-task-board/issues.
4. GET the issue back and verify all fields.
5. Write and commit publication.md.
</steps>

<output>
<=10 lines: PUBLISHED, URL, issue number, title/body/state/label equality status, commit hash. Zero credential leaks.
</output>
