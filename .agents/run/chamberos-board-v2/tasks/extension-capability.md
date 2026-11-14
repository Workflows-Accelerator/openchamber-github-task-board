<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Mode: READ-ONLY. Write ONLY under `.agents/run/chamberos-board-v2/verifications/extension-capability/`.
Forbidden: never edit any source, never read or print secrets, never push, never restart the board, never spawn subagents.
</env_preflight>

<goal>
Establish, from the INSTALLED OpenChamber in this container, exactly which extension contribution points are available and what the manifest must declare, so we do not ship a manifest the running app cannot load.
</goal>

<checklist>
1. Find the installed app: `/usr/local/lib/node_modules/@openchamber/**` (read `package.json` for its version), and any bundled SDK at `@openchamber/sdk`. Report the exact app version and the SDK version it ships.
2. For each point, prove availability by finding the code that implements it, with file and line: `statusSection` (+ its `source` polling and `/status` response shape), `marks`, `actions`, `commands`, `mentions`, `blocks` (with `answers`), `instructions`, `skills`, `sessionControl`, `sessionEvents`, `service.schedule`, `service.keepRunning`, `service.provides`, `integration`, `filesystem`. If a point exists only in a newer app version than the installed one, say so plainly.
3. Report the exact accepted manifest shape for each available point (key names, required fields, limits) as the installed app validates it — quote the validation code, do not paraphrase from documentation.
4. State the `apiVersion` and `engines.openchamber` values the installed app requires or accepts, and whether the repo's current `apiVersion: 1` / `engines >=1.22.0` is compatible with it.
5. Check whether `bunx openchamber-guest-check` exists on this machine and what it validates; run it read-only against the repo if it is available and report its output verbatim (it must not modify files; if it would, do not run it).
6. Write `.agents/run/chamberos-board-v2/verifications/extension-capability/README.md` with a table: point | available? | proof (file:line) | required manifest keys | limits. Commit only that directory.
</checklist>

<output>
At most 12 lines: APP_VERSION, SDK_VERSION, AVAILABLE (points), UNAVAILABLE (points + nearest version), MANIFEST_RULES (the 3 that matter), ENGINE_COMPAT (yes/no), GUEST_CHECK (present? result), COMMIT, NOT_VERIFIED.
</output>
