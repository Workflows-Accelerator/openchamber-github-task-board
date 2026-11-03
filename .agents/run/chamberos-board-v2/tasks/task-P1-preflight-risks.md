<env_preflight>
Repo: /workspace/code/openchamber-github-task-board (root checkout, branch ops/task-board-activation). READ-ONLY investigation: edit NO product files anywhere. The only file you write is the report below.
A separate builder is concurrently working in .worktrees/team-dev-chamberos-board-v2 — do not touch that worktree.
Do not touch: /workspace/releases/board/** (read-only inspection of non-secret files allowed), running processes (no restarts, no kill), /workspace/.openchamber-data/** (you may check that files exist; never print contents of credential files), any .env*/board.env content, /proc/*/environ. Never print a token, key, or password value; check presence/shape only. No git push, no git commit. No GitHub writes of any kind (no POST/PATCH/PUT/DELETE via gh api, no issue edits). Zero emojis.
</env_preflight>

<goal>
De-risk later Board V2 steps by answering, with evidence, four questions the builders will hit. Plan: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/PLAN.md]. Decisions: [@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md].
</goal>

<questions>
Q1 GitHub issue dependencies ("blocked by", native): what REST (or GraphQL) endpoints list/add/remove them today? Verify with a READ-ONLY call against repo Workflows-Accelerator/openchamber-github-task-board using the ambient gh auth (e.g. `gh api repos/Workflows-Accelerator/openchamber-github-task-board/issues/57/dependencies/blocked_by`). Record exact paths, request bodies for add/remove (from GitHub docs or the API's own error/schema responses — do not perform writes), required token permission, and whether the ambient token has it. Note: the board server uses its own token (BOARD_GITHUB_TOKEN) which may differ from gh's; find out (without printing values) whether you can tell which token type/scopes the board uses, e.g. from release config docs or the server code's expectations.
Q2 Repo contents write + GitHub Discussions: does the ambient token have push/contents:write on each repo the board shows (`gh api repos/<o>/<r> --jq .permissions`)? Which board repos have Discussions enabled (`has_discussions`)? GraphQL queries/mutations needed for discussions list/read/reply/create (names + required fields). Which repos the board lists: look at web/server/repositories.ts and config.
Q3 OpenChamber session start from another process: how can the board server start a real OpenChamber/OpenCode session in a given directory with a chosen model, agent and prompt? Inspect what is installed (OpenChamber web server on port 3000 is password-protected; OpenCode server API; `opencode` CLI `run`/`serve`; /workspace/code/openchamber-config/explore/oc_admin.sh or similar helpers; the SDK). Find the exact HTTP routes (e.g. POST /session, POST /session/:id/message, directory query param) and auth method, from source/docs on disk. Is the board server process (release under /workspace/releases/board/current, started by /workspace/config/opencode/tools/board/supervisor.sh) on the same host/container as OpenChamber, so loopback works? Do NOT actually create a session; a read-only GET (e.g. listing sessions/health) to prove reachability is fine if no secret has to be printed. How are worktrees registered in OpenChamber's DB (see worktree skill /workspace/code/openchamber-config/.agents/skills/ship/worktree/management/SKILL.md) and is there an API instead of direct SQLite writes?
Q4 Publishing: how does a new release get built and switched today (supervisor.sh, release dir naming, checksums.sha256, how board.workflows.ac reaches the process — port, proxy)? Which env vars the live process gets and from where (names only, never values). Exact rollback procedure. What would be needed to add BOARD_D1_* and OpenChamber settings to the live env.
</questions>

<skills>
[@/workspace/code/openchamber-config/.agents/skills/verify/investigation/investigate-first/SKILL.md]
[@/workspace/code/openchamber-config/.agents/skills/communication/terse/caveman-lite/SKILL.md]
</skills>

<output>
Write the report to /workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md: one section per question, each with a one-line answer (YES/NO/UNKNOWN + what), the evidence (commands run, file:line), and what the builder must do. Reply with at most 12 lines: the four one-line answers and the report path.
</output>
