[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/tasks/_common-build.md]

<goal>
Step C3 (issue #67, parent #55): the Run button starts a REAL OpenChamber session in the repository's folder, using the model, agent and skills from the issue's front matter, with the issue as the prompt. Without configuration, the button explains what is missing instead of pretending.
</goal>

<context_files>
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/decisions.md] (D10, D16)
[@/workspace/code/openchamber-github-task-board/.agents/run/chamberos-board-v2/explore/preflight.md] (Q3: exact OpenChamber/OpenCode routes, auth, reachability; Q4: env injection)
Previous proofs: verifications/A1..C2/proof.md (B1 front matter keys).
OpenChamber panel's existing agent-start logic, for reference ONLY (do not edit): panel/** — find how the panel starts a session for an issue (prompt shape, session title containing #N) and match it so the panel's status reconciler links the session to the issue.
</context_files>

<scope>
In:
1. Config env vars (names may be adjusted to what preflight found, keep the BOARD_ prefix): BOARD_OPENCHAMBER_URL, BOARD_OPENCHAMBER_AUTH (or the auth mechanism preflight identified; secret, server-only), BOARD_REPO_DIRS (JSON or "owner/repo=/abs/path;..." map). Validate at startup; missing config disables Run with a plain reason.
2. Server route POST /api/issues/:n/run (CSRF, signed-in only, plus an explicit per-run confirmation token from the UI to stop accidental double-starts): resolves repo -> folder (reject if not in the map, or folder missing, or not a git repo), reads front matter (model, agent, skills, worktree), builds the prompt (issue URL, friendly title, body without hidden markers, skills listed as @-transclusions only if that is how OpenChamber expects them — follow preflight/panel), creates the session in that directory with that model/agent via the documented API, sends the prompt, returns the session id and a link to open it in OpenChamber. Sets the issue label status:in-progress only after the session start succeeds. Idempotency: refuse if a session for this issue started less than 60s ago (in-memory guard) and show its link.
3. UI: Run button on cards (hover), drawer and List, shown only for ready-to-run issues or behind a "Run anyway" confirm; hidden in Client view. Shows the model/agent/skills that will be used before confirming. After start: "Started in OpenChamber — Open session".
4. Tests with a fake OpenChamber server emulating the exact routes and failure modes (401, 404 directory, 500, timeout).
</scope>

<criteria>
- Everything in <common_criteria>.
- Server and browser tests on fakes.
- ONE real start is allowed ONLY IF preflight shows a loopback route that needs no secret you would have to print, or a secret readable by the server process from config without printing: start a session in /workspace/code/openchamber-github-task-board with model 9router/intern, agent dynamic-agent, prompt "Board V2 run-button smoke test: reply with the single word OK and stop." Record the session id in the proof. If that is not possible without handling a secret in the open, skip it and say so — the live check then happens at the user's morning review.
</criteria>

<output>Proof at .agents/run/chamberos-board-v2/verifications/C3/proof.md.</output>
