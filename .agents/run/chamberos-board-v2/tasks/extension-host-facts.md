<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Branch: ops/task-board-activation
Mode: READ-ONLY. Write ONLY under `.agents/run/chamberos-board-v2/verifications/extension-host-facts/`.
Forbidden: never edit source, never read or print `board.env`, `jwt-secret`, tokens, passwords or cookies, never push, never restart the board, never spawn subagents, never install anything system-wide.
</env_preflight>

<goal>
Answer five blocking factual questions about what the INSTALLED OpenChamber 2.7.1 host actually sends and accepts, because the implementation cannot be written until they are settled. Answer from the installed code (parser and client bundle), not from `API.md`, which is known stale on `sessionEvents`.
</goal>

<context>
Design decisions already made (`.agents/run/chamberos-board-v2/verifications/extension-design/README.md`): a `statusSection.source` section polled at 5000 ms answering `GET /status` with six rows; `marks` set from `sessionEvents`; `instructions`; `skills`.
Threat-model constraints (`.agents/run/chamberos-board-v2/verifications/extension-security/README.md`): `/status` must be scoped to an exact directory, and no snapshot value may reach a mark, an instruction, a session or a prompt.
Installed app: `/usr/local/lib/node_modules/@openchamber/web` (2.7.1). SDK: `node_modules/@openchamber/sdk` in the repo, or the app's bundled copy.
</context>

<checklist>
1. **The status poll request.** Find the client code that polls `statusSection.source.path`. Report verbatim: HTTP method, the exact URL built (query string included), every request header it sets, and the request body if any. State explicitly whether it sends: the project `directory`, a locale or `Accept-Language`, a session id, a window id.
2. **Directory scoping.** If the poll carries no directory, say so plainly and list what project context the host does expose to a status source (if any). This decides whether the section can be per-project or is necessarily All Projects. Quote the code.
3. **Row action click.** What exactly does the host POST when a row `action` button is clicked: path, method, body shape. Does it carry the directory or locale? Can a row action open a panel, a URL, or a session — or only reach the service? Quote the code.
4. **`sessions.status`.** Does it require `sessionControl` in the manifest? Find the check in the SDK parser or host and quote it. Report the exact return shape and the possible state values (e.g. `busy`, `idle`, `waiting`). If it needs no `sessionControl`, say that clearly, because it removes a permission from the approval dialog.
5. **`statusSection` accepted keys.** From the parser source (not docs), list the keys the section object accepts — specifically whether `title`, `defaultExpanded`, `source.path`, `source.interval` are honored or silently stripped (the schema is non-strict, so a parse PASS does not prove a key is used). Same for a row's `content` kinds and `content.chips[].url`: accepted and rendered as a link?
6. **`setMark` localization.** Does the host localize mark text itself (per-locale strings), or is one string shown as-is in every language? Quote the parser or renderer.
7. Write `.agents/run/chamberos-board-v2/verifications/extension-host-facts/README.md` with a table: question | answer | proof (file:line/offset) | consequence for implementation. Commit only that directory.
</checklist>

<output>
At most 12 lines: POLL_REQUEST (method + URL + headers), DIRECTORY (sent? what instead), ACTION_CLICK (what it does), SESSIONS_STATUS (needs sessionControl? yes/no + states), SECTION_KEYS (honored / stripped), CHIP_URL (link? yes/no), MARK_LOCALE (host-localized? yes/no), CONSEQUENCES (max 3 bullets), COMMIT, NOT_VERIFIED.
</output>
