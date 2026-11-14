<env_preflight>
Repo: /workspace/code/openchamber-github-task-board
Worktree: /workspace/code/openchamber-github-task-board
Branch: ops/task-board-activation
Mode: READ-ONLY. Write ONLY under `.agents/run/chamberos-board-v2/verifications/extension-render-safety/`.
Forbidden: never edit source, never read or print `board.env`, `jwt-secret`, tokens, passwords or cookies, never push, never restart the board, never spawn subagents, never install anything system-wide.
</env_preflight>

<goal>
Settle one open question from the threat model (`verifications/extension-security/README.md`, NOT_VERIFIED: "host renderer source absent — renderer escaping is unproven"). We plan to show ONE GitHub issue title inside a Work Status row and a count-only tooltip on a sidebar mark. Prove, from the INSTALLED OpenChamber 2.7.1 code, whether those strings are rendered as inert text or as markup — so the implementation knows whether an issue title may appear at all.
</goal>

<context>
- Installed app: `/usr/local/lib/node_modules/@openchamber/web` (version 2.7.1). It is minified/bundled; find the compiled client assets and the server proxy.
- The section body we would return is `{ "rows": [...] }` with rows of `kind: "line" | "note"`, fields `label`, `value`, `text`, `dot`, `content`, `actions`. The schema is `guestStatusViewSchema` in `@openchamber/sdk`.
- A mark is `{ icon, tone, text }` set through `setMark`; the tooltip shows the extension name then `text`.
- Prior finding: the schema is strict and string-only (`b1c84ed`, `0fd4f44`). Schema validity is not the same as render safety: a valid string can still be inserted as HTML by a careless renderer.
</context>

<checklist>
1. Locate the client code that draws a status section: search the installed bundle for the section title, row kinds, or the `/status` poll path. Name the asset file and the offsets/lines you found. If the bundle is minified, quote the surrounding code.
2. Determine the DOM insertion method for each of these strings: row `label`, row `value`, row `content` text, note `text`, action `label`, and the section `title`. State for each: `textContent`/`createTextNode` (inert) or `innerHTML`/`dangerouslySetInnerHTML`/template string (markup). Quote the code.
3. Do the same for the sidebar mark tooltip `text`, and for the mark's click target (does a mark with a `url` open it, and is the URL taken from the service?).
4. Say whether a GitHub issue title (arbitrary user content: quotes, `<`, `&`, newlines, 300+ chars) can safely be shown in a row `value`, in a note `text`, and in a mark `text`. Answer per location with the code that proves it.
5. Report any length or newline handling you find: does the renderer truncate, wrap, or drop a row over N characters, and does a newline break a row's layout.
6. State the residual risk if a future app version changed the renderer, and the one-line rule the implementation should follow so it stays safe either way.
7. Write `.agents/run/chamberos-board-v2/verifications/extension-render-safety/README.md` with a table: string | renderer call (file:line/offset) | inert or markup | may hold an issue title (yes/no). Commit only that directory.
</checklist>

<output>
At most 12 lines: SECTION_RENDERER (file + method), INERT (fields), MARKUP (fields, if any), ISSUE_TITLE_OK (row value / note text / mark text), LENGTH_LIMITS, RULE_FOR_IMPLEMENTATION, COMMIT, NOT_VERIFIED.
</output>
